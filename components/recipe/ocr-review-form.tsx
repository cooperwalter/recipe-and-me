"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DuplicateCheckDialog } from "@/components/recipe/duplicate-check-dialog";
import { useDuplicateCheck } from "@/lib/hooks/use-duplicate-check";

interface ExtractedIngredient {
  amount?: string;
  unit?: string;
  ingredient: string;
  notes?: string;
  orderIndex: number;
}

interface ExtractedInstruction {
  stepNumber: number;
  instruction: string;
}

interface ExtractedRecipe {
  title: string;
  description?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  ingredients: ExtractedIngredient[];
  instructions: ExtractedInstruction[];
  sourceName?: string;
  sourceNotes?: string;
  categories?: string[];
  // tags?: string[];  // Tags feature temporarily disabled
  confidence: {
    overall: number;
    fields?: Record<string, number>;
  };
}

interface OCRReviewFormProps {
  extractedRecipe: ExtractedRecipe;
  imageUrl: string;
  onSubmit: (recipe: ExtractedRecipe) => Promise<void>;
  onCancel: () => void;
}

export function OCRReviewForm({
  extractedRecipe,
  onSubmit,
  onCancel,
}: OCRReviewFormProps) {
  const [recipe, setRecipe] = useState<ExtractedRecipe>(extractedRecipe);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDuplicateCheck, setShowDuplicateCheck] = useState(false);
  const duplicateCheck = useDuplicateCheck();

  const updateField = (field: keyof ExtractedRecipe, value: unknown) => {
    setRecipe((prev) => ({ ...prev, [field]: value }));
  };

  const updateIngredient = (index: number, field: keyof ExtractedIngredient, value: string) => {
    const newIngredients = [...recipe.ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    updateField("ingredients", newIngredients);
  };

  const addIngredient = () => {
    const newIngredients = [...recipe.ingredients, {
      ingredient: "",
      orderIndex: recipe.ingredients.length,
    }];
    updateField("ingredients", newIngredients);
  };

  const removeIngredient = (index: number) => {
    const newIngredients = recipe.ingredients.filter((_, i) => i !== index);
    updateField("ingredients", newIngredients);
  };

  const updateInstruction = (index: number, value: string) => {
    const newInstructions = [...recipe.instructions];
    newInstructions[index] = { ...newInstructions[index], instruction: value };
    updateField("instructions", newInstructions);
  };

  const addInstruction = () => {
    const newInstructions = [...recipe.instructions, {
      stepNumber: recipe.instructions.length + 1,
      instruction: "",
    }];
    updateField("instructions", newInstructions);
  };

  const removeInstruction = (index: number) => {
    const newInstructions = recipe.instructions
      .filter((_, i) => i !== index)
      .map((inst, i) => ({ ...inst, stepNumber: i + 1 }));
    updateField("instructions", newInstructions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Validate required fields
      if (!recipe.title.trim()) {
        throw new Error("Recipe title is required");
      }
      if (recipe.ingredients.length === 0) {
        throw new Error("At least one ingredient is required");
      }
      if (recipe.instructions.length === 0) {
        throw new Error("At least one instruction is required");
      }

      // Check for duplicates first
      const recipeData = {
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients.map(ing => ({
          ingredient: ing.ingredient,
          amount: ing.amount,
          unit: ing.unit,
        })),
        instructions: recipe.instructions.map(inst => inst.instruction),
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
      };

      const result = await duplicateCheck.mutateAsync(recipeData);
      
      // Only show dialog if duplicates found
      if (result.duplicates && result.duplicates.length > 0) {
        setShowDuplicateCheck(true);
      } else {
        // No duplicates, proceed directly
        await submitRecipe();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save recipe");
    }
  };

  const handleDuplicateCheckContinue = async () => {
    setShowDuplicateCheck(false);
    await submitRecipe();
  };

  const submitRecipe = async () => {
    setIsSubmitting(true);

    try {
      await onSubmit(recipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save recipe");
      setIsSubmitting(false);
    }
  };

  const handleDuplicateCheckCancel = () => {
    setShowDuplicateCheck(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return "High";
    if (confidence >= 0.6) return "Medium";
    return "Low";
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Confidence Alert */}
      {recipe.confidence.overall < 0.8 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            The OCR extraction confidence is{" "}
            <span className={cn("font-medium", getConfidenceColor(recipe.confidence.overall))}>
              {getConfidenceLabel(recipe.confidence.overall)}
            </span>{" "}
            ({Math.round(recipe.confidence.overall * 100)}%). Please review and edit the fields below carefully.
          </AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Review and edit the recipe details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={recipe.title}
              onChange={(e) => updateField("title", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={recipe.description || ""}
              onChange={(e) => updateField("description", e.target.value)}
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
                value={recipe.prepTime || ""}
                onChange={(e) => updateField("prepTime", e.target.value ? parseInt(e.target.value) : undefined)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="cookTime">Cook Time (minutes)</Label>
              <Input
                id="cookTime"
                type="number"
                min="0"
                value={recipe.cookTime || ""}
                onChange={(e) => updateField("cookTime", e.target.value ? parseInt(e.target.value) : undefined)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="servings">Servings</Label>
              <Input
                id="servings"
                type="number"
                min="1"
                value={recipe.servings || ""}
                onChange={(e) => updateField("servings", e.target.value ? parseInt(e.target.value) : undefined)}
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
          <CardDescription>Review and edit the ingredient list</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recipe.ingredients.map((ingredient, index) => (
            <div key={index} className="space-y-2">
              {/* Mobile: 2-row layout, Desktop: single row */}
              <div className="flex gap-2 sm:hidden">
                {/* Mobile: Amount and Unit on first row */}
                <Input
                  placeholder="Amount"
                  value={ingredient.amount || ""}
                  onChange={(e) => updateIngredient(index, "amount", e.target.value)}
                  className="w-24"
                />
                <Input
                  placeholder="Unit"
                  value={ingredient.unit || ""}
                  onChange={(e) => updateIngredient(index, "unit", e.target.value)}
                  className="w-24"
                />
              </div>
              {/* Mobile: Ingredient on second row with delete button */}
              <div className="flex gap-2 sm:hidden">
                <Input
                  placeholder="Ingredient *"
                  value={ingredient.ingredient}
                  onChange={(e) => updateIngredient(index, "ingredient", e.target.value)}
                  className="flex-1"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeIngredient(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {/* Desktop: All fields in one row */}
              <div className="hidden sm:flex gap-2">
                <Input
                  placeholder="Amount"
                  value={ingredient.amount || ""}
                  onChange={(e) => updateIngredient(index, "amount", e.target.value)}
                  className="w-24"
                />
                <Input
                  placeholder="Unit"
                  value={ingredient.unit || ""}
                  onChange={(e) => updateIngredient(index, "unit", e.target.value)}
                  className="w-24"
                />
                <Input
                  placeholder="Ingredient *"
                  value={ingredient.ingredient}
                  onChange={(e) => updateIngredient(index, "ingredient", e.target.value)}
                  className="flex-1"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeIngredient(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addIngredient}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
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
          {recipe.instructions.map((instruction, index) => (
            <div key={index} className="flex gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                {instruction.stepNumber}
              </div>
              <Textarea
                placeholder="Instruction *"
                value={instruction.instruction}
                onChange={(e) => updateInstruction(index, e.target.value)}
                className="flex-1 min-h-[100px] sm:min-h-[80px]"
                rows={4}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeInstruction(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addInstruction}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Instruction
          </Button>
        </CardContent>
      </Card>

      {/* Source & Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Source & Notes</CardTitle>
          <CardDescription>Add attribution and family memories</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sourceName">Recipe Source</Label>
            <Input
              id="sourceName"
              placeholder="e.g., Grandma Betty"
              value={recipe.sourceName || ""}
              onChange={(e) => updateField("sourceName", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceNotes">Family Notes & Memories</Label>
            <Textarea
              id="sourceNotes"
              placeholder="Share the story behind this recipe..."
              value={recipe.sourceNotes || ""}
              onChange={(e) => updateField("sourceNotes", e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      {recipe.categories?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Suggested Categories</CardTitle>
            <CardDescription>These were identified from your recipe</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Categories</Label>
              <div className="flex flex-wrap gap-2">
                {recipe.categories.map((category) => (
                  <Badge key={category} variant="secondary">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
            
            {/* Tags - Temporarily disabled */}
            {/* {recipe.tags?.length ? (
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {recipe.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null} */}
          </CardContent>
        </Card>
      ) : null}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Recipe...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Create Recipe
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 sm:flex-initial"
        >
          Cancel
        </Button>
      </div>

      {/* Duplicate Check Dialog - Only shown when duplicates are found */}
      <DuplicateCheckDialog
        open={showDuplicateCheck}
        onOpenChange={setShowDuplicateCheck}
        recipeData={{
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients.map(ing => ({
            ingredient: ing.ingredient,
            amount: ing.amount,
            unit: ing.unit,
          })),
          instructions: recipe.instructions.map(inst => inst.instruction),
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          servings: recipe.servings,
        }}
        onContinue={handleDuplicateCheckContinue}
        onCancel={handleDuplicateCheckCancel}
      />
    </form>
  );
}