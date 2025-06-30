import { test as setup, expect } from '@playwright/test'

const authFile = 'playwright/.auth/user.json'

setup('authenticate', async ({ page }) => {
  // Add development mode script
  await page.addInitScript(() => {
    // @ts-ignore
    window.process = { env: { NODE_ENV: 'development' } }
  })

  // Go to login page
  await page.goto('/auth/login')
  
  // Fill in demo credentials
  await page.fill('input[id="email"]', 'demo@recipeandme.app')
  await page.fill('input[id="password"]', 'DemoRecipes2024!')
  
  // Submit the form
  await page.getByRole('button', { name: 'Login' }).click()
  
  // Wait for navigation to recipes page
  await page.waitForURL('**/protected/recipes', { timeout: 10000 })
  
  // Wait for the page to be fully loaded
  await page.waitForLoadState('networkidle')
  
  // Verify we're logged in by checking for page content
  await expect(page.getByRole('heading', { name: 'My Recipes' })).toBeVisible({ timeout: 10000 })
  
  // Save the authenticated state
  await page.context().storageState({ path: authFile })
})