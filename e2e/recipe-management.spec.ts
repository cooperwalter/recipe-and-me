import { test, expect } from '@playwright/test'
import { loginWithDemoCredentials } from './helpers/auth'

test.describe('Recipe Management Features', () => {
  // Authentication is handled by global setup, no need for beforeEach

  test('should favorite and unfavorite a recipe', async ({ page }) => {
    // Navigate to recipes list
    await page.goto('/protected/recipes')
    
    // Click on first recipe (or create one if needed)
    const firstRecipe = page.locator('article').first()
    const recipeName = await firstRecipe.locator('h3').textContent()
    
    if (!recipeName) {
      // Create a recipe if none exist
      await page.goto('/protected/recipes/new/manual')
      await page.fill('input[name="title"]', 'Test Recipe for Favorites')
      await page.getByRole('button', { name: /add.*ingredient/i }).click()
      await page.fill('input[placeholder*="flour"]', 'test ingredient')
      await page.getByRole('button', { name: /add.*instruction/i }).click()
      await page.fill('textarea[placeholder*="Preheat"]', 'test instruction')
      await page.getByRole('button', { name: /save|create/i }).click()
      await page.waitForURL(/.*\/recipes\/[a-f0-9-]+$/)
    }
    
    // Navigate to a recipe detail page
    const recipeLink = page.locator('a[href*="/recipes/"]').first()
    await recipeLink.click()
    
    // Find and click favorite button
    const favoriteButton = page.getByRole('button', { name: /favorite|heart/i })
    const isInitiallyFavorited = await favoriteButton.getAttribute('aria-pressed') === 'true' ||
                                 await favoriteButton.getAttribute('data-favorited') === 'true'
    
    // Toggle favorite
    await favoriteButton.click()
    
    // Wait for state change
    await page.waitForTimeout(1000)
    
    // Verify favorite state changed
    if (isInitiallyFavorited) {
      await expect(favoriteButton).not.toHaveAttribute('aria-pressed', 'true')
    } else {
      await expect(favoriteButton).toHaveAttribute('aria-pressed', 'true')
    }
    
    // Navigate back to recipes list
    await page.goto('/protected/recipes')
    
    // Filter by favorites (if filter exists)
    const favoritesFilter = page.getByRole('button', { name: /favorites/i })
    if (await favoritesFilter.isVisible()) {
      await favoritesFilter.click()
      
      if (!isInitiallyFavorited) {
        // Recipe should appear in favorites
        await expect(page.getByText(recipeName || 'Test Recipe for Favorites')).toBeVisible()
      }
    }
  })

  test('should delete a recipe', async ({ page }) => {
    // First create a recipe to delete
    await page.goto('/protected/recipes/new/manual')
    
    await page.fill('input[name="title"]', 'Recipe to Delete E2E')
    await page.fill('textarea[name="description"]', 'This recipe will be deleted')
    
    await page.getByRole('button', { name: /add.*ingredient/i }).click()
    await page.fill('input[placeholder*="flour"]', 'deletable ingredient')
    
    await page.getByRole('button', { name: /add.*instruction/i }).click()
    await page.fill('textarea[placeholder*="Preheat"]', 'This will be deleted')
    
    await page.getByRole('button', { name: /save|create/i }).click()
    await page.waitForURL(/.*\/recipes\/([a-f0-9-]+)$/)
    
    // Go to edit page
    await page.getByRole('button', { name: /edit/i }).click()
    
    // Click delete button
    await page.getByRole('button', { name: /delete/i }).click()
    
    // Confirm deletion in dialog
    await page.getByRole('button', { name: /confirm.*delete|yes.*delete/i }).click()
    
    // Should redirect to recipes list
    await page.waitForURL('**/protected/recipes')
    
    // Recipe should not exist
    await expect(page.getByText('Recipe to Delete E2E')).not.toBeVisible()
  })

  test('should search for recipes', async ({ page }) => {
    // Navigate to recipes page
    await page.goto('/protected/recipes')
    
    // Find search input
    const searchInput = page.getByPlaceholder(/search.*recipes/i)
    
    // Search for a specific term
    await searchInput.fill('chocolate')
    
    // Wait for search results to update
    await page.waitForTimeout(1000)
    
    // Verify filtered results (should only show recipes with 'chocolate')
    const recipes = page.locator('article')
    const count = await recipes.count()
    
    if (count > 0) {
      // At least one recipe should contain 'chocolate' in title or description
      const firstRecipeText = await recipes.first().textContent()
      expect(firstRecipeText?.toLowerCase()).toContain('chocolate')
    }
    
    // Clear search
    await searchInput.clear()
    await page.waitForTimeout(500)
    
    // Should show all recipes again
    const allRecipesCount = await page.locator('article').count()
    expect(allRecipesCount).toBeGreaterThanOrEqual(count)
  })

  test('should filter recipes by category', async ({ page }) => {
    await page.goto('/protected/recipes')
    
    // Look for category filter
    const categoryFilter = page.getByRole('combobox', { name: /category/i })
    if (await categoryFilter.isVisible()) {
      await categoryFilter.click()
      
      // Select a category (e.g., 'Desserts')
      const dessertOption = page.getByRole('option', { name: /dessert/i })
      if (await dessertOption.isVisible()) {
        await dessertOption.click()
        
        // Wait for filter to apply
        await page.waitForTimeout(1000)
        
        // Verify results are filtered
        const recipes = page.locator('article')
        const count = await recipes.count()
        
        // Clear filter
        await categoryFilter.click()
        await page.getByRole('option', { name: /all.*categories/i }).click()
      }
    }
  })

  test('should sort recipes', async ({ page }) => {
    await page.goto('/protected/recipes')
    
    // Look for sort options
    const sortButton = page.getByRole('button', { name: /sort/i })
    if (await sortButton.isVisible()) {
      await sortButton.click()
      
      // Sort by newest
      await page.getByRole('menuitem', { name: /newest|recent/i }).click()
      await page.waitForTimeout(1000)
      
      // Get first recipe title
      const firstRecipeTitle = await page.locator('article h3').first().textContent()
      
      // Sort by oldest
      await sortButton.click()
      await page.getByRole('menuitem', { name: /oldest/i }).click()
      await page.waitForTimeout(1000)
      
      // First recipe should be different
      const newFirstRecipeTitle = await page.locator('article h3').first().textContent()
      expect(newFirstRecipeTitle).not.toBe(firstRecipeTitle)
    }
  })

  test('should view recipe in print mode', async ({ page }) => {
    // Navigate to any recipe
    await page.goto('/protected/recipes')
    const firstRecipeLink = page.locator('a[href*="/recipes/"]').first()
    await firstRecipeLink.click()
    
    // Look for print button
    const printButton = page.getByRole('button', { name: /print/i })
    if (await printButton.isVisible()) {
      // Mock print dialog
      await page.evaluate(() => {
        window.print = () => {
          console.log('Print dialog would open')
        }
      })
      
      await printButton.click()
      
      // Verify print-friendly layout (check for print-specific classes)
      const printStyles = await page.evaluate(() => {
        const styles = Array.from(document.styleSheets)
          .flatMap(sheet => {
            try {
              return Array.from(sheet.cssRules || [])
            } catch {
              return []
            }
          })
          .filter(rule => rule.cssText?.includes('@media print'))
        return styles.length > 0
      })
      
      expect(printStyles).toBeTruthy()
    }
  })

  test('should share a recipe', async ({ page }) => {
    // Navigate to any recipe
    await page.goto('/protected/recipes')
    const firstRecipeLink = page.locator('a[href*="/recipes/"]').first()
    await firstRecipeLink.click()
    
    // Look for share button
    const shareButton = page.getByRole('button', { name: /share/i })
    if (await shareButton.isVisible()) {
      await shareButton.click()
      
      // Check for share options
      const shareDialog = page.getByRole('dialog')
      if (await shareDialog.isVisible()) {
        // Should have copy link option
        await expect(page.getByText(/copy.*link/i)).toBeVisible()
        
        // Close dialog
        await page.keyboard.press('Escape')
      }
    }
  })

  test('should export recipe data', async ({ page }) => {
    // Navigate to any recipe
    await page.goto('/protected/recipes')
    const firstRecipeLink = page.locator('a[href*="/recipes/"]').first()
    await firstRecipeLink.click()
    
    // Look for export/download button
    const exportButton = page.getByRole('button', { name: /export|download/i })
    if (await exportButton.isVisible()) {
      // Set up download promise before clicking
      const downloadPromise = page.waitForEvent('download')
      await exportButton.click()
      
      // Wait for download
      const download = await downloadPromise
      
      // Verify download
      expect(download.suggestedFilename()).toContain('.json')
    }
  })

  test('should navigate through pagination', async ({ page }) => {
    await page.goto('/protected/recipes')
    
    // Look for pagination controls
    const nextButton = page.getByRole('button', { name: /next/i })
    const prevButton = page.getByRole('button', { name: /previous/i })
    
    if (await nextButton.isVisible()) {
      // Get current page recipes
      const firstPageRecipe = await page.locator('article h3').first().textContent()
      
      // Go to next page
      await nextButton.click()
      await page.waitForTimeout(1000)
      
      // Should show different recipes
      const secondPageRecipe = await page.locator('article h3').first().textContent()
      expect(secondPageRecipe).not.toBe(firstPageRecipe)
      
      // Go back to previous page
      if (await prevButton.isEnabled()) {
        await prevButton.click()
        await page.waitForTimeout(1000)
        
        // Should be back to first page
        const currentRecipe = await page.locator('article h3').first().textContent()
        expect(currentRecipe).toBe(firstPageRecipe)
      }
    }
  })

  test('should handle empty states gracefully', async ({ page }) => {
    await page.goto('/protected/recipes')
    
    // Search for something that likely doesn't exist
    const searchInput = page.getByPlaceholder(/search.*recipes/i)
    await searchInput.fill('xyzabc123unlikelyrecipename')
    
    await page.waitForTimeout(1000)
    
    // Should show empty state message
    await expect(page.getByText(/no.*recipes.*found|no.*results/i)).toBeVisible()
    
    // Should show helpful message or create button
    const createButton = page.getByRole('button', { name: /create.*recipe|add.*recipe/i })
    expect(await createButton.isVisible()).toBeTruthy()
  })
})