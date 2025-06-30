import { Page, expect } from '@playwright/test'

/**
 * Create a test recipe with minimal required fields
 */
export async function createTestRecipe(page: Page, title: string = 'Test Recipe') {
  await page.goto('/protected/recipes/new/manual')
  
  // Wait for form to load
  await page.waitForSelector('#title', { timeout: 10000 })
  
  // Fill basic info (Step 1)
  await page.fill('#title', title)
  await page.fill('#description', 'Test recipe description')
  await page.fill('#prepTime', '10')
  await page.fill('#cookTime', '20')
  await page.fill('#servings', '4')
  
  // Click Next to go to ingredients
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  
  // Add at least one ingredient (Step 2)
  await page.getByRole('button', { name: 'Add Ingredient' }).click()
  await page.locator('input[placeholder*="cups"]').first().fill('1')
  await page.locator('input[placeholder*="unit"]').first().fill('cup')
  await page.locator('input[placeholder*="flour"]').first().fill('test ingredient')
  
  // Click Next to go to instructions
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  
  // Add at least one instruction (Step 3)
  await page.getByRole('button', { name: 'Add Instruction' }).click()
  await page.locator('textarea[placeholder*="Preheat"]').first().fill('Test instruction step')
  
  // Click Next to go to final step
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  
  // Save recipe (Step 4)
  await page.getByRole('button', { name: /save.*recipe|create.*recipe/i }).click()
  
  // Wait for redirect to recipe detail page
  await page.waitForURL(/.*\/recipes\/[a-f0-9-]+$/, { timeout: 15000 })
  
  // Extract and return recipe ID
  const url = page.url()
  const match = url.match(/recipes\/([a-f0-9-]+)$/)
  return match?.[1] || ''
}

/**
 * Delete a recipe by ID
 */
export async function deleteRecipe(page: Page, recipeId: string) {
  try {
    await page.goto(`/protected/recipes/${recipeId}/edit`)
    await page.getByRole('button', { name: /delete/i }).click()
    
    // Confirm deletion
    const confirmButton = page.getByRole('button', { name: /confirm|yes.*delete/i })
    if (await confirmButton.isVisible()) {
      await confirmButton.click()
      await page.waitForURL('**/protected/recipes')
    }
  } catch (error) {
    // Ignore errors during cleanup
    console.log(`Failed to delete recipe ${recipeId}:`, error)
  }
}

/**
 * Wait for API response with specific status
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  expectedStatus: number = 200
) {
  return page.waitForResponse(
    response => 
      (typeof urlPattern === 'string' 
        ? response.url().includes(urlPattern)
        : urlPattern.test(response.url())
      ) && response.status() === expectedStatus
  )
}

/**
 * Mock successful file upload
 */
export async function mockFileUpload(page: Page, fileName: string = 'test-file.jpg') {
  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /upload|choose.*file|browse/i }).click()
  const fileChooser = await fileChooserPromise
  
  await fileChooser.setFiles([{
    name: fileName,
    mimeType: 'image/jpeg',
    buffer: Buffer.from('fake-image-data-for-testing')
  }])
}

/**
 * Check if element is in viewport
 */
export async function isInViewport(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel)
    if (!element) return false
    
    const rect = element.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  }, selector)
}

/**
 * Wait for loading states to complete
 */
export async function waitForLoadingToComplete(page: Page) {
  // Wait for any loading spinners to disappear
  await page.waitForSelector('[aria-busy="true"]', { state: 'hidden' }).catch(() => {})
  await page.waitForSelector('.animate-spin', { state: 'hidden' }).catch(() => {})
  await page.waitForLoadState('networkidle')
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ 
    path: `e2e/screenshots/${name}-${new Date().toISOString().split('T')[0]}.png`,
    fullPage: true 
  })
}

/**
 * Fill recipe form with test data
 */
export async function fillRecipeForm(page: Page, data: {
  title?: string
  description?: string
  prepTime?: string
  cookTime?: string
  servings?: string
  ingredients?: Array<{ amount: string; unit: string; ingredient: string }>
  instructions?: string[]
  sourceName?: string
  sourceNotes?: string
}) {
  if (data.title) {
    await page.fill('#title', data.title)
  }
  
  if (data.description) {
    await page.fill('#description', data.description)
  }
  
  if (data.prepTime) {
    await page.fill('#prepTime', data.prepTime)
  }
  
  if (data.cookTime) {
    await page.fill('#cookTime', data.cookTime)
  }
  
  if (data.servings) {
    await page.fill('#servings', data.servings)
  }
  
  if (data.ingredients) {
    for (let i = 0; i < data.ingredients.length; i++) {
      await page.getByRole('button', { name: 'Add Ingredient' }).click()
      
      const amountInputs = page.locator('input[placeholder*="cups"]')
      const unitInputs = page.locator('input[placeholder*="unit"]')
      const ingredientInputs = page.locator('input[placeholder*="flour"]')
      
      await amountInputs.nth(i).fill(data.ingredients[i].amount)
      await unitInputs.nth(i).fill(data.ingredients[i].unit)
      await ingredientInputs.nth(i).fill(data.ingredients[i].ingredient)
    }
  }
  
  if (data.instructions) {
    for (let i = 0; i < data.instructions.length; i++) {
      await page.getByRole('button', { name: 'Add Instruction' }).click()
      
      const instructionInputs = page.locator('textarea[placeholder*="Preheat"]')
      await instructionInputs.nth(i).fill(data.instructions[i])
    }
  }
  
  if (data.sourceName) {
    await page.fill('#sourceName', data.sourceName)
  }
  
  if (data.sourceNotes) {
    await page.fill('#sourceNotes', data.sourceNotes)
  }
}

/**
 * Verify toast notification appears with expected message
 */
export async function expectToast(page: Page, message: string | RegExp) {
  const toast = page.getByRole('status').filter({ hasText: message })
  await expect(toast).toBeVisible({ timeout: 5000 })
}

/**
 * Close all open dialogs/modals
 */
export async function closeAllDialogs(page: Page) {
  // Try ESC key first
  await page.keyboard.press('Escape')
  
  // Then try clicking close buttons
  const closeButtons = page.getByRole('button', { name: /close|cancel|×/i })
  const count = await closeButtons.count()
  
  for (let i = count - 1; i >= 0; i--) {
    const button = closeButtons.nth(i)
    if (await button.isVisible()) {
      await button.click()
    }
  }
}