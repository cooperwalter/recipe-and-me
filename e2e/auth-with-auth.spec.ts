import { test, expect } from '@playwright/test'

// These tests run with authenticated state
test.describe('Authenticated User Actions', () => {
  test('should logout successfully', async ({ page }) => {
    // Navigate to recipes page (should already be authenticated)
    await page.goto('/protected/recipes')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Find and click the user menu button (it has aria-label="User menu")
    const userMenuButton = page.getByRole('button', { name: 'User menu' })
    await userMenuButton.click()
    
    // Click logout from dropdown menu
    await page.getByText('Log out').click()
    
    // Should redirect to home or login page
    await expect(page).toHaveURL(/\/(auth\/login|$)/)
  })

  test('should persist authentication across page refreshes', async ({ page }) => {
    // Navigate to protected page
    await page.goto('/protected/recipes')
    
    // Should be on recipes page
    await expect(page).toHaveURL(/.*\/protected\/recipes/)
    
    // Refresh the page
    await page.reload()
    
    // Should still be on recipes page
    await expect(page).toHaveURL(/.*\/protected\/recipes/)
    // Check for page content
    await expect(page.getByRole('heading', { name: 'My Recipes' })).toBeVisible({ timeout: 10000 })
  })

  test('should access all protected routes', async ({ page }) => {
    // Test navigation to different protected routes
    const protectedRoutes = [
      '/protected/recipes',
      '/protected/recipes/new',
      '/protected/recipes/new/manual',
      '/protected/recipes/new/ocr',
      '/protected/recipes/new/voice',
      '/protected/recipes/new/url',
    ]
    
    for (const route of protectedRoutes) {
      await page.goto(route)
      // Should not redirect to login
      await expect(page).not.toHaveURL(/.*\/auth\/login/)
    }
  })
})