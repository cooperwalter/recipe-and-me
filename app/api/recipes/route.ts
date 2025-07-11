import { NextRequest, NextResponse } from 'next/server'
import { RecipeService } from '@/lib/db/recipes'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const params = {
      query: searchParams.get('query') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      createdBy: searchParams.get('userId') || undefined,
      isPublic: searchParams.get('isPublic') === 'true' ? true : searchParams.get('isPublic') === 'false' ? false : undefined,
      isFavorite: searchParams.get('isFavorite') === 'true' ? true : searchParams.get('isFavorite') === 'false' ? false : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
      orderBy: searchParams.get('orderBy') as 'createdAt' | 'title' | 'updatedAt' | undefined || undefined,
      orderDirection: searchParams.get('orderDirection') as 'asc' | 'desc' | undefined || undefined,
    }

    // Get the current user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // This is a protected route, so user should always exist
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Default to showing only the user's own recipes unless explicitly requesting public recipes
    if (!params.createdBy && params.isPublic !== true) {
      params.createdBy = user.id
    }

    const recipeService = new RecipeService(supabase)
    const result = await recipeService.listRecipes(params)

    // Add cache headers for better performance
    const response = NextResponse.json(result)
    
    // Cache for 30 seconds with revalidation
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
    
    return response
  } catch (error) {
    console.error('Error listing recipes:', error)
    return NextResponse.json(
      { error: 'Failed to list recipes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const recipeService = new RecipeService(supabase)
    
    // Create the recipe
    const recipe = await recipeService.createRecipe({
      title: body.title,
      description: body.description,
      ingredients: body.ingredients || [],
      instructions: body.instructions || [],
      prepTime: body.prepTime,
      cookTime: body.cookTime,
      servings: body.servings,
      categoryId: body.categoryId,
      sourceName: body.sourceName,
      sourceNotes: body.sourceNotes,
      isPublic: body.isPublic || false,
    })

    // Add photo if provided
    if (body.photoUrl) {
      await recipeService.addRecipePhoto(recipe.id, body.photoUrl, body.photoCaption, true)
    }

    // Fetch the complete recipe with all relations
    const completeRecipe = await recipeService.getRecipe(recipe.id)

    return NextResponse.json(completeRecipe, { status: 201 })
  } catch (error) {
    console.error('Error creating recipe:', error)
    return NextResponse.json(
      { error: 'Failed to create recipe' },
      { status: 500 }
    )
  }
}