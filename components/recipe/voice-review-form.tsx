'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ChevronLeft, Save, Loader2, Plus, X, GripVertical, AlertCircle } from 'lucide-react'

interface ExtractedRecipe {
  title: string
  description?: string
  ingredients: Array<{
    ingredient: string
    amount?: string
    unit?: string
  }>
  instructions: string[]
  prepTime?: number
  cookTime?: number
  servings?: number
  sourceName?: string
  sourceNotes?: string
}

interface VoiceReviewFormProps {
  extractedData: ExtractedRecipe
  transcript: string
  onRecipeCreated: (recipeId: string) => void
  onBack: () => void
}

export function VoiceReviewForm({
  extractedData,
  transcript,
  onRecipeCreated,
  onBack
}: VoiceReviewFormProps) {
  const [formData, setFormData] = useState(extractedData)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateField = (field: keyof ExtractedRecipe, value: ExtractedRecipe[keyof ExtractedRecipe]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const updateIngredient = (index: number, field: keyof ExtractedRecipe['ingredients'][0], value: string) => {
    const newIngredients = [...formData.ingredients]
    newIngredients[index] = { ...newIngredients[index], [field]: value }
    updateField('ingredients', newIngredients)
  }

  const addIngredient = () => {
    updateField('ingredients', [...formData.ingredients, { ingredient: '', amount: '', unit: '' }])
  }

  const removeIngredient = (index: number) => {
    updateField('ingredients', formData.ingredients.filter((_, i) => i !== index))
  }

  const updateInstruction = (index: number, value: string) => {
    const newInstructions = [...formData.instructions]
    newInstructions[index] = value
    updateField('instructions', newInstructions)
  }

  const addInstruction = () => {
    updateField('instructions', [...formData.instructions, ''])
  }

  const removeInstruction = (index: number) => {
    updateField('instructions', formData.instructions.filter((_, i) => i !== index))
  }

  const moveInstruction = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= formData.instructions.length) return
    
    const newInstructions = [...formData.instructions]
    const temp = newInstructions[index]
    newInstructions[index] = newInstructions[newIndex]
    newInstructions[newIndex] = temp
    updateField('instructions', newInstructions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          // Ensure ingredients have the right format
          ingredients: formData.ingredients.filter(ing => ing.ingredient.trim()),
          // Filter out empty instructions
          instructions: formData.instructions.filter(inst => inst.trim()),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create recipe')
      }

      const recipe = await response.json()
      onRecipeCreated(recipe.id)
    } catch (err) {
      console.error('Error creating recipe:', err)
      setError(err instanceof Error ? err.message : 'Failed to create recipe')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Review Your Recipe</h1>
          <p className="text-muted-foreground">
            Check and edit the recipe details we extracted from your voice input
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Recipe Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="prepTime">Prep Time (minutes)</Label>
              <Input
                id="prepTime"
                type="number"
                min="0"
                value={formData.prepTime || ''}
                onChange={(e) => updateField('prepTime', e.target.value ? Number(e.target.value) : undefined)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cookTime">Cook Time (minutes)</Label>
              <Input
                id="cookTime"
                type="number"
                min="0"
                value={formData.cookTime || ''}
                onChange={(e) => updateField('cookTime', e.target.value ? Number(e.target.value) : undefined)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="servings">Servings</Label>
              <Input
                id="servings"
                type="number"
                min="1"
                value={formData.servings || ''}
                onChange={(e) => updateField('servings', e.target.value ? Number(e.target.value) : undefined)}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ingredients */}
      <Card>
        <CardHeader>
          <CardTitle>Ingredients</CardTitle>
          <CardDescription>Review and edit the ingredients list</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.ingredients.map((ingredient, index) => (
            <div key={index} className="space-y-2">
              {/* Mobile: 2-row layout, Desktop: single row */}
              <div className="flex gap-2 sm:hidden">
                {/* Mobile: Amount and Unit on first row */}
                <Input
                  placeholder="Amount"
                  value={ingredient.amount || ''}
                  onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                  className="w-24"
                />
                <Input
                  placeholder="Unit"
                  value={ingredient.unit || ''}
                  onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                  className="w-24"
                />
              </div>
              {/* Mobile: Ingredient on second row with delete button */}
              <div className="flex gap-2 sm:hidden">
                <Input
                  placeholder="Ingredient *"
                  value={ingredient.ingredient}
                  onChange={(e) => updateIngredient(index, 'ingredient', e.target.value)}
                  className="flex-1"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeIngredient(index)}
                  aria-label="Remove ingredient"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* Desktop: All fields in one row */}
              <div className="hidden sm:flex gap-2 items-start">
                <div className="w-24">
                  <Input
                    placeholder="Amount"
                    value={ingredient.amount || ''}
                    onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                  />
                </div>
                <div className="w-24">
                  <Input
                    placeholder="Unit"
                    value={ingredient.unit || ''}
                    onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Ingredient *"
                    value={ingredient.ingredient}
                    onChange={(e) => updateIngredient(index, 'ingredient', e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeIngredient(index)}
                  aria-label="Remove ingredient"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addIngredient}>
            <Plus className="h-4 w-4 mr-1" />
            Add Ingredient
          </Button>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
          <CardDescription>Review and edit the cooking steps</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.instructions.map((instruction, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex flex-col gap-1 pt-2">
                <button
                  type="button"
                  onClick={() => moveInstruction(index, 'up')}
                  disabled={index === 0}
                  className="p-1 hover:bg-muted rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>
              <div className="flex-1">
                <Textarea
                  placeholder="Instruction *"
                  value={instruction}
                  onChange={(e) => updateInstruction(index, e.target.value)}
                  rows={2}
                  required
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeInstruction(index)}
                aria-label="Remove instruction"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addInstruction}>
            <Plus className="h-4 w-4 mr-1" />
            Add Step
          </Button>
        </CardContent>
      </Card>

      {/* Source Info */}
      <Card>
        <CardHeader>
          <CardTitle>Source & Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sourceName">Recipe Source</Label>
            <Input
              id="sourceName"
              value={formData.sourceName || ''}
              onChange={(e) => updateField('sourceName', e.target.value)}
              placeholder="e.g., Grandma Mary"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sourceNotes">Family Notes & Memories</Label>
            <Textarea
              id="sourceNotes"
              value={formData.sourceNotes || ''}
              onChange={(e) => updateField('sourceNotes', e.target.value)}
              rows={3}
              placeholder="Any special notes or memories about this recipe"
            />
          </div>
        </CardContent>
      </Card>

      {/* Original Transcript */}
      <Card>
        <CardHeader>
          <CardTitle>Original Voice Transcript</CardTitle>
          <CardDescription>Your original spoken recipe for reference</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted rounded-lg max-h-48 overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap">{transcript}</p>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Recipe...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Recipe
            </>
          )}
        </Button>
      </div>
    </form>
  )
}