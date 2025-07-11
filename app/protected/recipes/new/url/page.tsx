'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ButtonLoading } from '@/components/ui/loading-states'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
// import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { 
  Link as LinkIcon, 
  AlertCircle, 
  Clock, 
  Users,
  Check,
  X,
  ExternalLink
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { BackButton } from '@/components/ui/back-button'

interface ExtractedIngredient {
  amount?: string
  unit?: string
  ingredient: string
  notes?: string
}

interface ExtractedRecipe {
  title: string
  description: string
  ingredients: ExtractedIngredient[]
  instructions: string[]
  prepTime?: number
  cookTime?: number
  servings?: number
  sourceName?: string
  sourceUrl: string
  imageUrl?: string
  // tags: string[]  // Tags feature temporarily disabled
  metadata?: {
    category?: string
    cuisine?: string
    yield?: string
    nutrition?: {
      calories?: string
      protein?: string
      fat?: string
      carbohydrates?: string
    }
  }
}

export default function UrlRecipePage() {
  const router = useRouter()
  const recipePreviewRef = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editedRecipe, setEditedRecipe] = useState<ExtractedRecipe | null>(null)

  // Scroll to recipe preview when extraction is complete
  useEffect(() => {
    if (extractedRecipe && recipePreviewRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        recipePreviewRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        })
      }, 100)
    }
  }, [extractedRecipe])

  const handleExtract = async () => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    setIsExtracting(true)
    setError(null)
    setExtractedRecipe(null)
    setEditedRecipe(null)

    try {
      const response = await fetch('/api/recipes/url/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to extract recipe')
      }

      // Parse ingredients from strings to structured objects
      const parsedRecipe = {
        ...data.recipe,
        ingredients: data.recipe.ingredients?.map((ing: string | ExtractedIngredient) => {
          if (typeof ing === 'string') {
            // Simple parsing of ingredient strings
            // Match patterns like "1 cup flour", "1/2 tsp salt", "2 tablespoons sugar"
            const match = ing.match(/^(\d+(?:\/\d+)?(?:\.\d+)?)\s*([a-zA-Z]+\.?)?\s+(.+)$/)
            if (match) {
              // Handle fractions like 1/2
              let amount = match[1]
              if (amount.includes('/')) {
                const [num, den] = amount.split('/')
                amount = (parseFloat(num) / parseFloat(den)).toString()
              }
              return {
                amount: parseFloat(amount),
                unit: match[2] || '',
                ingredient: match[3]
              }
            }
            return { ingredient: ing }
          }
          return ing
        }) || []
      }

      setExtractedRecipe(parsedRecipe)
      setEditedRecipe(parsedRecipe)
    } catch (err) {
      console.error('Error extracting recipe:', err)
      setError(err instanceof Error ? err.message : 'Failed to extract recipe from URL')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleSave = async () => {
    if (!editedRecipe) return

    setIsSaving(true)
    setError(null)

    try {
      // Transform ingredients and instructions to the expected format
      const ingredients = editedRecipe.ingredients.map((ing) => ({
        amount: ing.amount,
        unit: ing.unit,
        ingredient: ing.ingredient.trim()
      })).filter(ing => ing.ingredient)
      const instructions = editedRecipe.instructions.map((inst) => inst.trim()).filter(Boolean)

      // Create the recipe via API
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editedRecipe.title,
          description: editedRecipe.description,
          prepTime: editedRecipe.prepTime,
          cookTime: editedRecipe.cookTime,
          servings: editedRecipe.servings,
          sourceName: editedRecipe.sourceName || new URL(editedRecipe.sourceUrl).hostname,
          sourceNotes: `Imported from: ${editedRecipe.sourceUrl}`,
          ingredients,
          instructions,
          // tags: editedRecipe.tags,  // Tags feature temporarily disabled
          categoryId: null
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save recipe')
      }

      const newRecipe = await response.json()

      // Add photo if available
      if (editedRecipe.imageUrl && newRecipe.id) {
        try {
          const photoResponse = await fetch(`/api/recipes/${newRecipe.id}/photos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: editedRecipe.imageUrl,
              caption: 'Recipe image from original source',
              isPrimary: true
            }),
          })

          if (!photoResponse.ok) {
            console.error('Failed to add photo')
          }
        } catch (photoError) {
          console.error('Failed to add photo:', photoError)
          // Continue without photo
        }
      }

      // Navigate to the new recipe
      router.push(`/protected/recipes/${newRecipe.id}`)
    } catch (err) {
      console.error('Error saving recipe:', err)
      setError(err instanceof Error ? err.message : 'Failed to save recipe')
      setIsSaving(false)
    }
  }

  const updateRecipeField = (field: keyof ExtractedRecipe, value: unknown) => {
    if (editedRecipe) {
      setEditedRecipe({ ...editedRecipe, [field]: value })
    }
  }

  const totalTime = (editedRecipe?.prepTime || 0) + (editedRecipe?.cookTime || 0)

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-4">
          <BackButton href="/protected/recipes/new" label="Back to Creation Options" />
        </div>
        
        <h1 className="text-3xl font-bold mb-2">Import Recipe from URL</h1>
        <p className="text-muted-foreground">
          Paste a link to any recipe webpage and we&apos;ll extract the recipe details for you
        </p>
      </div>

      {/* URL Input */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Recipe URL
          </CardTitle>
          <CardDescription>
            Enter the full URL of the recipe you want to import
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Input
                  type="url"
                  placeholder="https://example.com/recipes/chocolate-cake"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleExtract()}
                  disabled={isExtracting}
                  className={cn("w-full", url && "sm:pr-0 pr-10")}
                />
                {/* Clear button - visible on mobile when there's text */}
                {url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUrl('')}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 sm:hidden"
                    disabled={isExtracting}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button 
                onClick={handleExtract} 
                disabled={isExtracting || !url.trim()}
                className="w-full"
              >
                <ButtonLoading isLoading={isExtracting} loadingText="Extracting recipe">
                  Extract Recipe
                </ButtonLoading>
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="text-sm text-muted-foreground">
              <p className="mb-2">Supported sites include:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Most major recipe websites (AllRecipes, Food Network, etc.)</li>
                <li>Food blogs with properly formatted recipes</li>
                <li>Any site using Schema.org Recipe markup</li>
                <li>Most other recipe sites will work, too</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isExtracting && (
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </CardContent>
        </Card>
      )}

      {/* Extracted Recipe Preview/Edit */}
      {editedRecipe && !isExtracting && (
        <Card ref={recipePreviewRef}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <CardTitle>Recipe Preview</CardTitle>
                <CardDescription>
                  Review and edit the extracted recipe before saving
                </CardDescription>
              </div>
              {extractedRecipe?.sourceUrl && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={extractedRecipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View Original
                  </a>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={editedRecipe.title}
                  onChange={(e) => updateRecipeField('title', e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editedRecipe.description}
                  onChange={(e) => updateRecipeField('description', e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>

              {/* Time and Servings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="prepTime">Prep Time (minutes)</Label>
                  <Input
                    id="prepTime"
                    type="number"
                    value={editedRecipe.prepTime || ''}
                    onChange={(e) => updateRecipeField('prepTime', parseInt(e.target.value) || undefined)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="cookTime">Cook Time (minutes)</Label>
                  <Input
                    id="cookTime"
                    type="number"
                    value={editedRecipe.cookTime || ''}
                    onChange={(e) => updateRecipeField('cookTime', parseInt(e.target.value) || undefined)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="servings">Servings</Label>
                  <Input
                    id="servings"
                    type="number"
                    value={editedRecipe.servings || ''}
                    onChange={(e) => updateRecipeField('servings', parseInt(e.target.value) || undefined)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Recipe Stats */}
              {(totalTime > 0 || editedRecipe.servings) && (
                <div className="flex gap-4 text-sm text-muted-foreground">
                  {totalTime > 0 && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{totalTime} min total</span>
                    </div>
                  )}
                  {editedRecipe.servings && (
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{editedRecipe.servings} servings</span>
                    </div>
                  )}
                </div>
              )}

              {/* Ingredients */}
              <div>
                <Label>Ingredients</Label>
                <div className="mt-2 space-y-3">
                  {editedRecipe.ingredients.map((ingredient, index) => (
                    <div key={index} className="flex gap-2 p-3 bg-muted/30 rounded-lg border border-muted">
                      <div className="flex-1">
                        {/* Mobile: Two rows layout */}
                        <div className="sm:hidden space-y-2">
                          {/* First row: Amount and Unit */}
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={ingredient.amount || ''}
                              onChange={(e) => {
                                const newIngredients = [...editedRecipe.ingredients]
                                newIngredients[index] = {
                                  ...ingredient,
                                  amount: e.target.value ? parseFloat(e.target.value) : undefined
                                }
                                updateRecipeField('ingredients', newIngredients)
                              }}
                              step="0.25"
                              className="h-9"
                            />
                            <Input
                              placeholder="Unit"
                              value={ingredient.unit || ''}
                              onChange={(e) => {
                                const newIngredients = [...editedRecipe.ingredients]
                                newIngredients[index] = {
                                  ...ingredient,
                                  unit: e.target.value
                                }
                                updateRecipeField('ingredients', newIngredients)
                              }}
                              className="h-9"
                            />
                          </div>
                          {/* Second row: Ingredient */}
                          <Input
                            placeholder="Ingredient"
                            value={ingredient.ingredient}
                            onChange={(e) => {
                              const newIngredients = [...editedRecipe.ingredients]
                              newIngredients[index] = {
                                ...ingredient,
                                ingredient: e.target.value
                              }
                              updateRecipeField('ingredients', newIngredients)
                            }}
                            required
                            className="h-9 w-full"
                          />
                        </div>
                        
                        {/* Desktop: Single row layout */}
                        <div className="hidden sm:grid sm:grid-cols-12 sm:gap-2">
                          <div className="col-span-2">
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={ingredient.amount || ''}
                              onChange={(e) => {
                                const newIngredients = [...editedRecipe.ingredients]
                                newIngredients[index] = {
                                  ...ingredient,
                                  amount: e.target.value ? parseFloat(e.target.value) : undefined
                                }
                                updateRecipeField('ingredients', newIngredients)
                              }}
                              step="0.25"
                              className="h-9"
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              placeholder="Unit"
                              value={ingredient.unit || ''}
                              onChange={(e) => {
                                const newIngredients = [...editedRecipe.ingredients]
                                newIngredients[index] = {
                                  ...ingredient,
                                  unit: e.target.value
                                }
                                updateRecipeField('ingredients', newIngredients)
                              }}
                              className="h-9"
                            />
                          </div>
                          <div className="col-span-8">
                            <Input
                              placeholder="Ingredient"
                              value={ingredient.ingredient}
                              onChange={(e) => {
                                const newIngredients = [...editedRecipe.ingredients]
                                newIngredients[index] = {
                                  ...ingredient,
                                  ingredient: e.target.value
                                }
                                updateRecipeField('ingredients', newIngredients)
                              }}
                              required
                              className="h-9"
                            />
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newIngredients = editedRecipe.ingredients.filter((_, i) => i !== index)
                          updateRecipeField('ingredients', newIngredients)
                        }}
                        className="mt-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateRecipeField('ingredients', [...editedRecipe.ingredients, { ingredient: '' }])}
                    className="w-full"
                  >
                    Add Ingredient
                  </Button>
                </div>
              </div>

              {/* Instructions */}
              <div>
                <Label>Instructions</Label>
                <div className="mt-2 space-y-2">
                  {editedRecipe.instructions.map((instruction, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <Textarea
                        value={instruction}
                        onChange={(e) => {
                          const newInstructions = [...editedRecipe.instructions]
                          newInstructions[index] = e.target.value
                          updateRecipeField('instructions', newInstructions)
                        }}
                        rows={4}
                        className="flex-1 min-h-[100px] sm:min-h-[80px]"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newInstructions = editedRecipe.instructions.filter((_, i) => i !== index)
                          updateRecipeField('instructions', newInstructions)
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateRecipeField('instructions', [...editedRecipe.instructions, ''])}
                    className="w-full"
                  >
                    Add Step
                  </Button>
                </div>
              </div>

              {/* Tags - Temporarily disabled */}
              {/* {editedRecipe.tags.length > 0 && (
                <div>
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editedRecipe.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                        <button
                          onClick={() => {
                            const newTags = editedRecipe.tags.filter((_, i) => i !== index)
                            updateRecipeField('tags', newTags)
                          }}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )} */}

              {/* Additional Metadata */}
              {editedRecipe.metadata && (
                <div className="border-t pt-4 space-y-2 text-sm text-muted-foreground">
                  {editedRecipe.metadata.category && (
                    <p>Category: {editedRecipe.metadata.category}</p>
                  )}
                  {editedRecipe.metadata.cuisine && (
                    <p>Cuisine: {editedRecipe.metadata.cuisine}</p>
                  )}
                  {editedRecipe.metadata.yield && (
                    <p>Yield: {editedRecipe.metadata.yield}</p>
                  )}
                </div>
              )}

              {/* Source Attribution */}
              <div className="border-t pt-4 text-sm text-muted-foreground">
                <p>Source: {editedRecipe.sourceName || new URL(editedRecipe.sourceUrl).hostname}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSave}
                disabled={isSaving || !editedRecipe.title || editedRecipe.ingredients.length === 0}
                className="flex-1"
              >
                <ButtonLoading isLoading={isSaving} loadingText="Saving recipe">
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Save Recipe
                  </>
                </ButtonLoading>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setExtractedRecipe(null)
                  setEditedRecipe(null)
                  setUrl('')
                }}
                disabled={isSaving}
              >
                Start Over
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}