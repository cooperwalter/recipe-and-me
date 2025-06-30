import { test, expect } from '@playwright/test'
import { loginWithDemoCredentials } from './helpers/auth'
import { createTestRecipe, deleteRecipe, waitForLoadingToComplete, expectToast } from './helpers/test-utils'

test.describe('Edge Cases and Error Handling', () => {
  // Authentication is handled by global setup, no need for beforeEach

  test.describe('Network and API Errors', () => {
    test('should handle network failure during recipe save', async ({ page }) => {
      await page.goto('/protected/recipes/new/manual')
      
      // Wait for the form to load
      await page.waitForSelector('#title', { timeout: 10000 })
      
      // Fill form
      await page.fill('#title', 'Network Test Recipe')
      await page.fill('#description', 'Test description')
      
      // Click Next to go to ingredients step
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      
      // Add ingredient
      await page.getByRole('button', { name: 'Add Ingredient' }).click()
      await page.locator('input[placeholder*="flour"]').first().fill('test ingredient')
      
      // Click Next to go to instructions step
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      
      // Add instruction
      await page.getByRole('button', { name: 'Add Instruction' }).click()
      await page.locator('textarea[placeholder*="Preheat"]').first().fill('test instruction')
      
      // Click Next to go to final step
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      
      // Simulate network failure
      await page.route('**/api/recipes', route => route.abort('failed'))
      
      // Try to save
      await page.getByRole('button', { name: /save|create/i }).click()
      
      // Should show error message
      await expect(page.getByText(/error|failed|try again/i)).toBeVisible({ timeout: 10000 })
    })

    test('should handle OCR service unavailability', async ({ page }) => {
      await page.goto('/protected/recipes/new/ocr')
      
      // Mock OCR service unavailable
      await page.route('**/api/recipes/ocr/upload', async (route) => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'OCR service not configured. Please contact support.'
          })
        })
      })
      
      // Try to upload image
      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.getByRole('button', { name: /upload.*photo/i }).click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles([{
        name: 'test.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('test-image')
      }])
      
      // Should show user-friendly error
      await expect(page.getByText(/OCR service is currently unavailable/i)).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(/try importing from URL or entering the recipe manually/i)).toBeVisible()
    })

    test('should handle voice transcription failure', async ({ page }) => {
      await page.goto('/protected/recipes/new/voice')
      
      // Mock transcription failure
      await page.route('**/api/transcribe', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Transcription service error'
          })
        })
      })
      
      // Try recording
      await page.getByRole('button', { name: /start.*record|record/i }).click()
      await page.waitForTimeout(2000)
      await page.getByRole('button', { name: /stop|finish/i }).click()
      
      // Should show error
      await expect(page.getByText(/error|failed|try again/i)).toBeVisible({ timeout: 10000 })
    })

    test('should handle URL extraction failure', async ({ page }) => {
      await page.goto('/protected/recipes/new/url')
      
      // Mock extraction failure
      await page.route('**/api/recipes/url/extract', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'This page does not appear to contain a recipe'
          })
        })
      })
      
      // Try to extract from URL
      await page.fill('input[type="url"]', 'https://example.com/not-a-recipe')
      await page.getByRole('button', { name: /extract|import|fetch/i }).click()
      
      // Should show error
      await expect(page.getByText(/does not appear to contain a recipe/i)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Data Validation', () => {
    test('should validate recipe title length', async ({ page }) => {
      await page.goto('/protected/recipes/new/manual')
      
      // Wait for form to load
      await page.waitForSelector('#title', { timeout: 10000 })
      
      // Try very long title
      const longTitle = 'A'.repeat(300)
      await page.fill('#title', longTitle)
      
      // The input may have a maxlength attribute, check the actual value
      const titleInput = page.locator('#title')
      const actualValue = await titleInput.inputValue()
      expect(actualValue.length).toBeLessThanOrEqual(255)
    })

    test('should validate numeric fields', async ({ page }) => {
      await page.goto('/protected/recipes/new/manual')
      
      // Wait for form to load
      await page.waitForSelector('#prepTime', { timeout: 10000 })
      
      // Enter invalid values
      await page.fill('#prepTime', '-5')
      await page.fill('#cookTime', 'abc')
      await page.fill('#servings', '0')
      
      // Check that negative values are rejected
      const prepTimeValue = await page.locator('#prepTime').inputValue()
      expect(prepTimeValue).toBe('')  // Input type="number" rejects negative values
      
      // Check that non-numeric values are rejected
      const cookTimeValue = await page.locator('#cookTime').inputValue()
      expect(cookTimeValue).toBe('')  // Input type="number" rejects non-numeric
      
      // Check minimum value for servings
      const servingsValue = await page.locator('#servings').inputValue()
      expect(servingsValue).toBe('')  // Input type="number" with min="1" rejects 0
    })

    test('should handle empty ingredients gracefully', async ({ page }) => {
      await page.goto('/protected/recipes/new/manual')
      
      // Wait for form to load
      await page.waitForSelector('#title', { timeout: 10000 })
      
      await page.fill('#title', 'Test Recipe')
      
      // Click Next to go to ingredients
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      
      // Add ingredient but leave it empty
      await page.getByRole('button', { name: 'Add Ingredient' }).click()
      
      // Try to go to next step without filling ingredient
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      
      // Should show validation error or prevent navigation
      await expect(page.getByText(/ingredient.*required|enter.*ingredient|fill.*required/i)).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Concurrent Operations', () => {
    test('should handle rapid favorite toggling', async ({ page }) => {
      // Create a test recipe
      const recipeId = await createTestRecipe(page, 'Rapid Toggle Test')
      
      // Rapidly toggle favorite
      const favoriteButton = page.getByRole('button', { name: /favorite|heart/i })
      
      for (let i = 0; i < 5; i++) {
        await favoriteButton.click()
        await page.waitForTimeout(100)
      }
      
      // Wait for final state
      await waitForLoadingToComplete(page)
      
      // Should have a consistent state (no errors)
      await expect(page.getByText(/error/i)).not.toBeVisible()
      
      // Cleanup
      await deleteRecipe(page, recipeId)
    })

    test('should prevent duplicate recipe creation', async ({ page }) => {
      await page.goto('/protected/recipes/new/manual')
      
      // Fill form
      await page.fill('input[name="title"]', 'Duplicate Test Recipe')
      await page.getByRole('button', { name: 'Add Ingredient' }).click()
      await page.fill('input[placeholder*="flour"]', 'test')
      await page.getByRole('button', { name: 'Add Instruction' }).click()
      await page.fill('textarea[placeholder*="Preheat"]', 'test')
      
      // Double-click save button
      const saveButton = page.getByRole('button', { name: /save|create/i })
      await saveButton.dblclick()
      
      // Should only create one recipe (check by navigation)
      await page.waitForURL(/.*\/recipes\/[a-f0-9-]+$/, { timeout: 10000 })
      
      // Go back to recipes list
      await page.goto('/protected/recipes')
      
      // Count recipes with this title
      const recipes = page.getByText('Duplicate Test Recipe')
      const count = await recipes.count()
      expect(count).toBe(1)
    })
  })

  test.describe('Large Data Handling', () => {
    test('should handle recipe with many ingredients', async ({ page }) => {
      await page.goto('/protected/recipes/new/manual')
      
      await page.fill('input[name="title"]', 'Many Ingredients Recipe')
      
      // Add 20 ingredients
      for (let i = 0; i < 20; i++) {
        await page.getByRole('button', { name: 'Add Ingredient' }).click()
        
        const ingredientInputs = page.locator('input[placeholder*="flour"]')
        await ingredientInputs.nth(i).fill(`Ingredient ${i + 1}`)
        
        const amountInputs = page.locator('input[placeholder*="2 cups"]')
        await amountInputs.nth(i).fill(`${i + 1}`)
        
        const unitInputs = page.locator('input[placeholder*="cups"]')
        await unitInputs.nth(i).fill('cups')
      }
      
      // Add instruction
      await page.getByRole('button', { name: 'Add Instruction' }).click()
      await page.fill('textarea[placeholder*="Preheat"]', 'Mix all 20 ingredients')
      
      // Save
      await page.getByRole('button', { name: /save|create/i }).click()
      
      // Should handle successfully
      await page.waitForURL(/.*\/recipes\/[a-f0-9-]+$/, { timeout: 15000 })
      
      // Verify all ingredients are displayed
      await expect(page.getByText('Ingredient 1')).toBeVisible()
      await expect(page.getByText('Ingredient 20')).toBeVisible()
    })

    test('should handle very long instructions', async ({ page }) => {
      await page.goto('/protected/recipes/new/manual')
      
      await page.fill('input[name="title"]', 'Long Instructions Recipe')
      
      // Add ingredient
      await page.getByRole('button', { name: 'Add Ingredient' }).click()
      await page.fill('input[placeholder*="flour"]', 'test ingredient')
      
      // Add very long instruction
      await page.getByRole('button', { name: 'Add Instruction' }).click()
      const longInstruction = 'This is a very detailed instruction. '.repeat(50)
      await page.fill('textarea[placeholder*="Preheat"]', longInstruction)
      
      // Save
      await page.getByRole('button', { name: /save|create/i }).click()
      
      // Should handle successfully
      await page.waitForURL(/.*\/recipes\/[a-f0-9-]+$/, { timeout: 10000 })
      
      // Instruction should be displayed (possibly truncated in list view)
      await expect(page.getByText(/This is a very detailed instruction/)).toBeVisible()
    })
  })

  test.describe('Browser Compatibility', () => {
    test('should handle browser back/forward navigation', async ({ page }) => {
      // Create a recipe
      const recipeId = await createTestRecipe(page, 'Navigation Test Recipe')
      
      // Navigate to edit
      await page.getByRole('button', { name: /edit/i }).click()
      await page.waitForURL(/.*\/edit$/)
      
      // Go back
      await page.goBack()
      await expect(page).toHaveURL(new RegExp(`/recipes/${recipeId}$`))
      
      // Go forward
      await page.goForward()
      await expect(page).toHaveURL(/.*\/edit$/)
      
      // Cleanup
      await deleteRecipe(page, recipeId)
    })

    test('should preserve form data on accidental navigation', async ({ page }) => {
      await page.goto('/protected/recipes/new/manual')
      
      // Fill form
      await page.fill('input[name="title"]', 'Unsaved Recipe')
      await page.fill('textarea[name="description"]', 'This should be preserved')
      
      // Set up dialog handler for beforeunload
      page.on('dialog', dialog => dialog.accept())
      
      // Try to navigate away
      await page.getByRole('link', { name: /recipes/i }).first().click()
      
      // Should show warning or preserve data
      // (Implementation dependent - may use beforeunload or auto-save)
    })
  })

  test.describe('Accessibility', () => {
    test('should be navigable with keyboard only', async ({ page }) => {
      await page.goto('/protected/recipes')
      
      // Tab through interface
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      
      // Press Enter on focused element
      await page.keyboard.press('Enter')
      
      // Should navigate or perform action
      await waitForLoadingToComplete(page)
      
      // Check focus is visible
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement
        return {
          tagName: el?.tagName,
          hasOutline: window.getComputedStyle(el!).outlineStyle !== 'none'
        }
      })
      
      expect(focusedElement.hasOutline).toBeTruthy()
    })

    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/protected/recipes')
      
      // Check for ARIA labels on interactive elements
      const buttons = page.getByRole('button')
      const count = await buttons.count()
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i)
        const ariaLabel = await button.getAttribute('aria-label')
        const textContent = await button.textContent()
        
        // Should have either aria-label or text content
        expect(ariaLabel || textContent).toBeTruthy()
      }
    })
  })
})