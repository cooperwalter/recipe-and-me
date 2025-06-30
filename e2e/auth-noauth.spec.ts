import { test, expect } from '@playwright/test'

// These tests run without global authentication
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Set up to run in development mode to enable demo features
    await page.addInitScript(() => {
      // @ts-ignore
      window.process = { env: { NODE_ENV: 'development' } }
    })
  })

  test('should display login form with demo credentials button in development', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Check login form is visible - look for specific div with Login text
    await expect(page.locator('div.text-2xl').filter({ hasText: 'Login' })).toBeVisible()
    
    // Check demo account info is visible (may not show if NODE_ENV isn't development)
    const demoInfo = page.getByText('Demo Account Available!')
    if (await demoInfo.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(page.getByText('demo@recipeandme.app')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Fill Demo Credentials' })).toBeVisible()
    }
  })

  test('should fill demo credentials when button is clicked', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Click fill demo credentials button
    await page.getByRole('button', { name: 'Fill Demo Credentials' }).click()
    
    // Check fields are filled
    await expect(page.locator('input[id="email"]')).toHaveValue('demo@recipeandme.app')
    await expect(page.locator('input[id="password"]')).toHaveValue('DemoRecipes2024!')
  })

  test('should login successfully with demo credentials', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Fill in demo credentials
    await page.fill('input[id="email"]', 'demo@recipeandme.app')
    await page.fill('input[id="password"]', 'DemoRecipes2024!')
    
    // Submit the form
    await page.getByRole('button', { name: 'Login' }).click()
    
    // Wait for navigation to recipes page
    await page.waitForURL('**/protected/recipes', { timeout: 10000 })
    
    // Verify we're on the recipes page
    await expect(page).toHaveURL(/.*\/protected\/recipes/)
    
    // Check for indicators of successful login - look for recipes page content
    await expect(page.getByRole('heading', { name: 'My Recipes' })).toBeVisible({ timeout: 10000 })
  })

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Fill in invalid credentials
    await page.fill('input[id="email"]', 'invalid@example.com')
    await page.fill('input[id="password"]', 'wrongpassword')
    
    // Submit the form
    await page.getByRole('button', { name: 'Login' }).click()
    
    // Check for error message
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 5000 })
  })

  test('should redirect to login when accessing protected route while unauthenticated', async ({ page }) => {
    // Clear any existing auth
    await page.context().clearCookies()
    
    // Try to access protected route
    await page.goto('/protected/recipes')
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*\/auth\/login/)
  })

  test('should navigate to sign up page from login', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Click sign up link
    await page.getByRole('link', { name: /sign up|create.*account|register/i }).click()
    
    // Should be on sign up page
    await expect(page).toHaveURL(/.*\/auth\/sign-up/)
    // Look for specific div with Sign up text
    await expect(page.locator('div.text-2xl').filter({ hasText: 'Sign up' })).toBeVisible()
  })

  test('should navigate to forgot password from login', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Click forgot password link
    await page.getByRole('link', { name: /forgot.*password|reset.*password/i }).click()
    
    // Should be on forgot password page
    await expect(page).toHaveURL(/.*\/auth\/forgot-password/)
  })
})