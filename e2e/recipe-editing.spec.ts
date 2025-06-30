import { test, expect } from '@playwright/test'
import { loginWithDemoCredentials } from './helpers/auth'

test.describe('Recipe Editing and Interactions', () => {
  let testRecipeId: string

  test.beforeEach(async ({ page }) => {
    // Authentication is handled by global setup

    // Create a test recipe to work with
    await page.goto('/protected/recipes/new/manual')
    
    // Fill basic recipe info
    await page.fill('input[name="title"]', 'E2E Edit Test Recipe')
    await page.fill('textarea[name="description"]', 'Original description')
    await page.fill('input[name="prepTime"]', '10')
    await page.fill('input[name="cookTime"]', '20')
    await page.fill('input[name="servings"]', '4')
    
    // Add ingredient
    await page.getByRole('button', { name: /add.*ingredient/i }).click()
    await page.fill('input[placeholder*="2 cups"]', '1')
    await page.fill('input[placeholder*="cups"]', 'cup')
    await page.fill('input[placeholder*="flour"]', 'test ingredient')
    
    // Add instruction
    await page.getByRole('button', { name: /add.*instruction/i }).click()
    await page.fill('textarea[placeholder*="Preheat"]', 'Original instruction')
    
    // Save recipe
    await page.getByRole('button', { name: /save|create/i }).click()
    await page.waitForURL(/.*\/recipes\/([a-f0-9-]+)$/, { timeout: 10000 })
    
    // Extract recipe ID from URL
    const url = page.url()
    const match = url.match(/recipes\/([a-f0-9-]+)$/)
    testRecipeId = match?.[1] || ''
  })

  test.afterEach(async ({ page }) => {
    // Clean up: delete the test recipe if it exists
    if (testRecipeId) {
      try {
        await page.goto(`/protected/recipes/${testRecipeId}/edit`)
        await page.getByRole('button', { name: /delete/i }).click()
        
        // Confirm deletion in dialog
        const confirmButton = page.getByRole('button', { name: /confirm|yes.*delete/i })
        if (await confirmButton.isVisible()) {
          await confirmButton.click()
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  })

  test('should edit recipe manually', async ({ page }) => {
    // Navigate to recipe edit page
    await page.goto(`/protected/recipes/${testRecipeId}/edit`)
    
    // Update title
    await page.fill('input[name="title"]', 'E2E Edit Test Recipe - Updated')
    
    // Update description
    await page.fill('textarea[name="description"]', 'Updated description')
    
    // Update cooking times
    await page.fill('input[name="prepTime"]', '15')
    await page.fill('input[name="cookTime"]', '25')
    
    // Add another ingredient
    await page.getByRole('button', { name: /add.*ingredient/i }).click()
    const ingredientInputs = page.locator('input[placeholder*="flour"]')
    await ingredientInputs.last().fill('new ingredient')
    
    // Save changes
    await page.getByRole('button', { name: /save.*changes|update/i }).click()
    
    // Should redirect back to recipe detail
    await page.waitForURL(`**/recipes/${testRecipeId}`, { timeout: 10000 })
    
    // Verify changes
    await expect(page.getByRole('heading', { name: 'E2E Edit Test Recipe - Updated' })).toBeVisible()
    await expect(page.getByText('Updated description')).toBeVisible()
    await expect(page.getByText('new ingredient')).toBeVisible()
    await expect(page.getByText(/15.*min.*prep/i)).toBeVisible()
    await expect(page.getByText(/25.*min.*cook/i)).toBeVisible()
  })

  test('should edit recipe using voice commands', async ({ page }) => {
    await page.goto(`/protected/recipes/${testRecipeId}`)
    
    // Mock the voice update API
    await page.route('**/api/transcribe', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          text: 'Add 2 cups of milk to the ingredients and change the title to Voice Updated Recipe'
        })
      })
    })
    
    await page.route(`**/api/recipes/${testRecipeId}/voice-update`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          changes: [
            {
              type: 'title',
              action: 'update',
              field: 'title',
              newValue: 'Voice Updated Recipe',
              description: 'Change title to "Voice Updated Recipe"'
            },
            {
              type: 'ingredient',
              action: 'add',
              newValue: { amount: '2', unit: 'cups', ingredient: 'milk' },
              description: 'Add 2 cups milk'
            }
          ]
        })
      })
    })
    
    // Click voice edit button
    await page.getByRole('button', { name: /voice.*edit|edit.*voice|microphone/i }).click()
    
    // Start recording
    await page.getByRole('button', { name: /start.*record|record/i }).click()
    
    // Simulate recording
    await page.waitForTimeout(2000)
    
    // Stop recording
    await page.getByRole('button', { name: /stop|finish/i }).click()
    
    // Wait for changes to be displayed
    await expect(page.getByText('Change title to "Voice Updated Recipe"')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Add 2 cups milk')).toBeVisible()
    
    // Apply changes
    await page.getByRole('button', { name: /apply.*changes|confirm/i }).click()
    
    // Verify changes were applied
    await expect(page.getByRole('heading', { name: 'Voice Updated Recipe' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('milk')).toBeVisible()
  })

  test('should chat with recipe for modifications', async ({ page }) => {
    await page.goto(`/protected/recipes/${testRecipeId}`)
    
    // Mock the chat API
    await page.route(`**/api/recipes/${testRecipeId}/chat`, async (route) => {
      const request = await route.request().postDataJSON()
      
      if (request.message.includes('gluten-free')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'To make this recipe gluten-free, you can substitute the test ingredient with gluten-free flour. Use the same amount (1 cup) of gluten-free all-purpose flour blend.',
            suggestions: ['Replace test ingredient with gluten-free flour']
          })
        })
      }
    })
    
    // Open chat interface
    await page.getByRole('button', { name: /chat|ask.*ai|modify/i }).click()
    
    // Send a message
    await page.fill('textarea[placeholder*="Ask"]', 'How can I make this recipe gluten-free?')
    await page.getByRole('button', { name: /send|submit/i }).click()
    
    // Wait for response
    await expect(page.getByText(/gluten-free.*flour/i)).toBeVisible({ timeout: 10000 })
  })

  test('should cancel edit and preserve original data', async ({ page }) => {
    await page.goto(`/protected/recipes/${testRecipeId}/edit`)
    
    // Make changes
    await page.fill('input[name="title"]', 'Should Not Be Saved')
    await page.fill('textarea[name="description"]', 'This should not be saved')
    
    // Cancel
    await page.getByRole('button', { name: /cancel/i }).click()
    
    // Should return to recipe detail
    await page.waitForURL(`**/recipes/${testRecipeId}`)
    
    // Verify original data is preserved
    await expect(page.getByRole('heading', { name: 'E2E Edit Test Recipe' })).toBeVisible()
    await expect(page.getByText('Original description')).toBeVisible()
    await expect(page.getByText('Should Not Be Saved')).not.toBeVisible()
  })

  test('should handle version history', async ({ page }) => {
    // Make first edit
    await page.goto(`/protected/recipes/${testRecipeId}/edit`)
    await page.fill('input[name="title"]', 'Version 1 Title')
    await page.getByRole('button', { name: /save.*changes|update/i }).click()
    await page.waitForURL(`**/recipes/${testRecipeId}`)
    
    // Make second edit
    await page.goto(`/protected/recipes/${testRecipeId}/edit`)
    await page.fill('input[name="title"]', 'Version 2 Title')
    await page.getByRole('button', { name: /save.*changes|update/i }).click()
    await page.waitForURL(`**/recipes/${testRecipeId}`)
    
    // View version history
    await page.getByRole('button', { name: /version.*history|history/i }).click()
    
    // Should see multiple versions
    await expect(page.getByText(/version.*2/i)).toBeVisible()
    await expect(page.getByText(/version.*1/i)).toBeVisible()
    
    // View a previous version
    const version1Link = page.getByRole('link', { name: /version.*1|v1/i })
    if (await version1Link.isVisible()) {
      await version1Link.click()
      await expect(page.getByText('Version 1 Title')).toBeVisible()
    }
  })

  test('should scale recipe servings', async ({ page }) => {
    await page.goto(`/protected/recipes/${testRecipeId}`)
    
    // Find servings adjustment controls
    const servingsInput = page.locator('input[type="number"][value="4"]')
    await servingsInput.fill('8')
    
    // Ingredient amounts should double
    await expect(page.getByText(/2.*cup/)).toBeVisible()
  })

  test('should handle ingredient substitutions', async ({ page }) => {
    await page.goto(`/protected/recipes/${testRecipeId}/edit`)
    
    // Find and edit the ingredient
    const ingredientInput = page.locator('input[value="test ingredient"]')
    await ingredientInput.fill('substituted ingredient')
    
    // Save changes
    await page.getByRole('button', { name: /save.*changes|update/i }).click()
    await page.waitForURL(`**/recipes/${testRecipeId}`)
    
    // Verify substitution
    await expect(page.getByText('substituted ingredient')).toBeVisible()
    await expect(page.getByText('test ingredient')).not.toBeVisible()
  })
})