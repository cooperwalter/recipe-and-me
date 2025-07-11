import { NextRequest, NextResponse } from 'next/server'
import { RecipeUrlParser } from '@/lib/services/recipe-url-parser'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get URL from request body
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Extract recipe data
    const parser = new RecipeUrlParser()
    const extractedRecipe = await parser.extractFromUrl(url)

    // Transform to our recipe format, converting ingredient amounts to numbers where possible
    const recipe = {
      title: extractedRecipe.title || '',
      description: extractedRecipe.description || '',
      ingredients: (extractedRecipe.ingredients || []).map(ing => {
        // Try to convert amount to number, handling fractions
        let amountNum: number | undefined
        if (ing.amount) {
          // Handle fractions like "1/2", "1 1/2", etc
          const fractionMatch = ing.amount.match(/^(\d+)?\s*(\d+)\/(\d+)$/)
          if (fractionMatch) {
            const whole = fractionMatch[1] ? parseInt(fractionMatch[1]) : 0
            const numerator = parseInt(fractionMatch[2])
            const denominator = parseInt(fractionMatch[3])
            amountNum = whole + (numerator / denominator)
          } else {
            // Try parsing as regular number
            const parsed = parseFloat(ing.amount)
            if (!isNaN(parsed)) {
              amountNum = parsed
            }
          }
        }

        return {
          amount: amountNum,
          unit: ing.unit,
          ingredient: ing.ingredient,
          // Append notes to ingredient name if present
          ...(ing.notes ? { ingredient: `${ing.ingredient} (${ing.notes})` } : {})
        }
      }),
      instructions: extractedRecipe.instructions || [],
      prepTime: extractedRecipe.prepTime,
      cookTime: extractedRecipe.cookTime,
      servings: extractedRecipe.servings,
      sourceName: extractedRecipe.sourceName,
      sourceUrl: url,
      imageUrl: extractedRecipe.image,
      // tags: extractedRecipe.keywords || [],  // Tags feature temporarily disabled
      metadata: {
        category: extractedRecipe.category,
        cuisine: extractedRecipe.cuisine,
        yield: extractedRecipe.yield,
        nutrition: extractedRecipe.nutrition
      }
    }

    return NextResponse.json({ 
      success: true, 
      recipe,
      extractedFrom: url
    })

  } catch (error) {
    console.error('Error extracting recipe from URL:', error)
    
    if (error instanceof Error) {
      // Specific error messages
      if (error.message.includes('No valid recipe data found')) {
        return NextResponse.json(
          { 
            error: 'No recipe found',
            message: 'This page does not appear to contain a recipe. Please make sure you\'re providing a direct link to a recipe page.'
          },
          { status: 422 }
        )
      }
      
      if (error.message.includes('Failed to fetch URL')) {
        return NextResponse.json(
          { 
            error: 'Could not access URL',
            message: 'Unable to access the provided URL. Please check that the link is correct and the website is accessible.'
          },
          { status: 422 }
        )
      }
    }

    return NextResponse.json(
      { 
        error: 'Failed to extract recipe',
        message: 'An error occurred while extracting the recipe. Please try again or use a different URL.'
      },
      { status: 500 }
    )
  }
}