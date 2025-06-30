import { test, expect } from '@playwright/test'
import { loginWithDemoCredentials } from './helpers/auth'
import path from 'path'

test.describe('Recipe Creation', () => {
  // Authentication is handled by global setup, no need for beforeEach

  test.describe('Recipe Creation Methods', () => {
    test('should display all recipe creation options', async ({ page }) => {
      // Navigate to new recipe page
      await page.goto('/protected/recipes/new')
      
      // Check all creation methods are visible
      await expect(page.getByText('Scan from Photo')).toBeVisible()
      await expect(page.getByText('Speak Recipe')).toBeVisible()
      await expect(page.getByText('Import from URL')).toBeVisible()
      await expect(page.getByText('Type Manually')).toBeVisible()
    })

    test('should navigate to manual recipe creation', async ({ page }) => {
      await page.goto('/protected/recipes/new')
      
      // Click manual entry option
      await page.getByText('Type Manually').click()
      
      // Should be on manual creation page
      await expect(page).toHaveURL(/.*\/recipes\/new\/manual/)
      await expect(page.getByRole('heading', { name: /create.*recipe|new.*recipe/i })).toBeVisible()
    })

    test('should create recipe manually', async ({ page }) => {
      await page.goto('/protected/recipes/new/manual')
      
      // Fill basic info
      await page.fill('input[name="title"]', 'E2E Test Chocolate Cake')
      await page.fill('textarea[name="description"]', 'A delicious test recipe created by E2E tests')
      await page.fill('input[name="prepTime"]', '15')
      await page.fill('input[name="cookTime"]', '30')
      await page.fill('input[name="servings"]', '8')
      
      // Add ingredients
      await page.getByRole('button', { name: /add.*ingredient/i }).click()
      await page.fill('input[placeholder*="2 cups"]', '2')
      await page.fill('input[placeholder*="cups"]', 'cups')
      await page.fill('input[placeholder*="flour"]', 'all-purpose flour')
      
      // Add another ingredient
      await page.getByRole('button', { name: /add.*ingredient/i }).click()
      const ingredientInputs = page.locator('input[placeholder*="flour"]')
      await ingredientInputs.nth(1).fill('sugar')
      const amountInputs = page.locator('input[placeholder*="2 cups"]')
      await amountInputs.nth(1).fill('1.5')
      const unitInputs = page.locator('input[placeholder*="cups"]')
      await unitInputs.nth(1).fill('cups')
      
      // Add instructions
      await page.getByRole('button', { name: /add.*instruction|add.*step/i }).click()
      await page.fill('textarea[placeholder*="Preheat"]', 'Preheat oven to 350°F')
      
      await page.getByRole('button', { name: /add.*instruction|add.*step/i }).click()
      const instructionInputs = page.locator('textarea[placeholder*="Preheat"]')
      await instructionInputs.nth(1).fill('Mix dry ingredients in a large bowl')
      
      // Add source info
      await page.fill('input[name="sourceName"]', 'E2E Test Suite')
      await page.fill('textarea[name="sourceNotes"]', 'Created during automated testing')
      
      // Save recipe
      await page.getByRole('button', { name: /save|create.*recipe/i }).click()
      
      // Should redirect to recipe detail page
      await page.waitForURL(/.*\/recipes\/[a-f0-9-]+$/, { timeout: 10000 })
      
      // Verify recipe was created
      await expect(page.getByRole('heading', { name: 'E2E Test Chocolate Cake' })).toBeVisible()
      await expect(page.getByText('all-purpose flour')).toBeVisible()
      await expect(page.getByText('Preheat oven to 350°F')).toBeVisible()
    })

    test('should import recipe from URL', async ({ page }) => {
      await page.goto('/protected/recipes/new')
      
      // Click URL import option
      await page.getByText('Import from URL').click()
      
      // Should be on URL import page
      await expect(page).toHaveURL(/.*\/recipes\/new\/url/)
      
      // Mock the API response for URL extraction
      await page.route('**/api/recipes/url/extract', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            recipe: {
              title: 'E2E URL Import Test Recipe',
              description: 'A recipe imported from a URL during E2E testing',
              prepTime: 10,
              cookTime: 20,
              servings: 4,
              ingredients: [
                { amount: '1', unit: 'cup', ingredient: 'test ingredient' }
              ],
              instructions: ['Test instruction from URL'],
              sourceUrl: 'https://example.com/test-recipe',
              sourceName: 'Example Recipe Site'
            }
          })
        })
      })
      
      // Enter URL
      await page.fill('input[type="url"]', 'https://example.com/test-recipe')
      await page.getByRole('button', { name: /extract|import|fetch/i }).click()
      
      // Wait for extraction
      await expect(page.getByText('E2E URL Import Test Recipe')).toBeVisible({ timeout: 10000 })
      
      // Save the imported recipe
      await page.getByRole('button', { name: /save|create.*recipe/i }).click()
      
      // Should redirect to recipe detail
      await page.waitForURL(/.*\/recipes\/[a-f0-9-]+$/, { timeout: 10000 })
      await expect(page.getByRole('heading', { name: 'E2E URL Import Test Recipe' })).toBeVisible()
    })

    test('should handle OCR recipe creation', async ({ page }) => {
      await page.goto('/protected/recipes/new')
      
      // Click OCR option
      await page.getByText('Scan from Photo').click()
      
      // Should be on OCR page
      await expect(page).toHaveURL(/.*\/recipes\/new\/ocr/)
      
      // Mock the OCR API response
      await page.route('**/api/recipes/ocr/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            imageUrl: 'https://example.com/uploaded-image.jpg',
            extractedText: 'OCR extracted recipe text',
            recipe: {
              title: 'E2E OCR Test Recipe',
              ingredients: [
                { amount: '2', unit: 'tbsp', ingredient: 'butter', orderIndex: 0 }
              ],
              instructions: [
                { stepNumber: 1, instruction: 'OCR extracted instruction' }
              ],
              confidence: { overall: 0.95 }
            }
          })
        })
      })
      
      // Upload test image
      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.getByRole('button', { name: /upload.*photo|choose.*file/i }).click()
      const fileChooser = await fileChooserPromise
      
      // Create a test image file path (you'll need to add a test image to your project)
      // For now, we'll use a minimal approach
      await fileChooser.setFiles([{
        name: 'test-recipe.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake-image-data')
      }])
      
      // Wait for OCR processing
      await expect(page.getByText('E2E OCR Test Recipe')).toBeVisible({ timeout: 15000 })
      
      // Review and save
      await page.getByRole('button', { name: /save|confirm|create/i }).click()
      
      // Should redirect to recipe detail
      await page.waitForURL(/.*\/recipes\/[a-f0-9-]+$/, { timeout: 10000 })
      await expect(page.getByRole('heading', { name: 'E2E OCR Test Recipe' })).toBeVisible()
    })

    test('should handle voice recipe creation', async ({ page }) => {
      await page.goto('/protected/recipes/new')
      
      // Click voice option
      await page.getByText('Speak Recipe').click()
      
      // Should be on voice page
      await expect(page).toHaveURL(/.*\/recipes\/new\/voice/)
      
      // Mock the transcription API
      await page.route('**/api/transcribe', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            text: 'Make a chocolate chip cookie recipe with 2 cups flour and 1 cup sugar'
          })
        })
      })
      
      // Mock the voice recipe creation API
      await page.route('**/api/recipes/voice', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            recipe: {
              title: 'E2E Voice Test Cookies',
              ingredients: [
                { amount: '2', unit: 'cups', ingredient: 'flour' },
                { amount: '1', unit: 'cup', ingredient: 'sugar' }
              ],
              instructions: ['Mix ingredients and bake'],
              sourceName: 'Voice Recording'
            }
          })
        })
      })
      
      // Start recording (mock the recording process)
      const recordButton = page.getByRole('button', { name: /start.*record|record/i })
      await recordButton.click()
      
      // Wait a moment to simulate recording
      await page.waitForTimeout(2000)
      
      // Stop recording
      await page.getByRole('button', { name: /stop|finish/i }).click()
      
      // Wait for transcription and recipe creation
      await expect(page.getByText('E2E Voice Test Cookies')).toBeVisible({ timeout: 10000 })
      
      // Save the recipe
      await page.getByRole('button', { name: /save|create/i }).click()
      
      // Should redirect to recipe detail
      await page.waitForURL(/.*\/recipes\/[a-f0-9-]+$/, { timeout: 10000 })
      await expect(page.getByRole('heading', { name: 'E2E Voice Test Cookies' })).toBeVisible()
    })

    test('should validate required fields in manual creation', async ({ page }) => {
      await page.goto('/protected/recipes/new/manual')
      
      // Try to save without filling required fields
      await page.getByRole('button', { name: /save|create.*recipe/i }).click()
      
      // Should show validation errors
      await expect(page.getByText(/title.*required|enter.*title/i)).toBeVisible()
      
      // Fill title and try again
      await page.fill('input[name="title"]', 'Test Recipe')
      await page.getByRole('button', { name: /save|create.*recipe/i }).click()
      
      // Should show error for missing ingredients
      await expect(page.getByText(/at least one ingredient/i)).toBeVisible()
    })

    test('should cancel recipe creation and return to recipes list', async ({ page }) => {
      await page.goto('/protected/recipes/new/manual')
      
      // Fill some data
      await page.fill('input[name="title"]', 'Cancelled Recipe')
      
      // Click cancel
      await page.getByRole('button', { name: /cancel/i }).click()
      
      // Should return to recipes list
      await expect(page).toHaveURL(/.*\/protected\/recipes/)
      
      // The cancelled recipe should not exist
      await expect(page.getByText('Cancelled Recipe')).not.toBeVisible()
    })
  })
})