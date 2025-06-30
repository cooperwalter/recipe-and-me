import { test, expect } from '@playwright/test'

test('verify authenticated state', async ({ page }) => {
  // This test uses the global authenticated state
  await page.goto('/protected/recipes')
  
  // Should not redirect to login
  await expect(page).not.toHaveURL(/.*\/auth\/login/)
  
  // Should see recipes page
  await expect(page.getByRole('heading', { name: 'My Recipes' })).toBeVisible()
})

test.describe('Without auth', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  
  test('verify unauthenticated redirects', async ({ page }) => {
    await page.goto('/protected/recipes')
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*\/auth\/login/)
  })
})