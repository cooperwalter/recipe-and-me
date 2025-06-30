# End-to-End Tests

This directory contains comprehensive end-to-end tests for the Recipe Keeper application using Playwright.

## Test Coverage

### Authentication (`auth.spec.ts`)
- Login with demo credentials
- Login form validation
- Authentication persistence
- Logout functionality
- Protected route access
- Navigation between auth pages

### Recipe Creation (`recipe-creation.spec.ts`)
- Manual recipe creation with full form validation
- OCR-based recipe import from images
- Voice-based recipe creation
- URL-based recipe import
- Creation method navigation
- Field validation and error handling

### Recipe Editing (`recipe-editing.spec.ts`)
- Manual recipe editing
- Voice-based recipe updates
- AI chat for recipe modifications
- Version history tracking
- Ingredient substitutions
- Recipe scaling
- Cancel and data preservation

### Recipe Management (`recipe-management.spec.ts`)
- Favoriting/unfavoriting recipes
- Recipe deletion with confirmation
- Search functionality
- Filtering by category
- Sorting options
- Print mode
- Sharing capabilities
- Export functionality
- Pagination
- Empty state handling

### Edge Cases (`edge-cases.spec.ts`)
- Network failure handling
- Service unavailability (OCR, voice)
- Data validation edge cases
- Concurrent operations
- Large data sets
- Browser navigation
- Keyboard accessibility
- ARIA compliance

## Running Tests

### Local Development

```bash
# Run all E2E tests
pnpm test:e2e:pw

# Run tests in UI mode (recommended for development)
pnpm test:e2e:pw:ui

# Run specific test file
pnpm exec playwright test auth.spec.ts

# Run tests in specific browser
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=firefox
pnpm exec playwright test --project=webkit

# Run tests in headed mode (see browser)
pnpm exec playwright test --headed

# Debug a specific test
pnpm exec playwright test --debug auth.spec.ts
```

### Test Environment Setup

1. **Demo Account**: Tests use the demo account credentials:
   - Email: `demo@recipeandme.app`
   - Password: `DemoRecipes2024!`

2. **Development Mode**: Tests automatically set `NODE_ENV=development` to enable demo features

3. **API Mocking**: Tests mock external API calls for:
   - OCR service
   - Voice transcription
   - URL extraction
   - AI chat responses

### Writing New Tests

1. **Use Test Helpers**: Import utilities from `helpers/test-utils.ts`
   ```typescript
   import { createTestRecipe, deleteRecipe, expectToast } from './helpers/test-utils'
   ```

2. **Login Before Protected Routes**:
   ```typescript
   test.beforeEach(async ({ page }) => {
     await loginWithDemoCredentials(page)
   })
   ```

3. **Clean Up Test Data**:
   ```typescript
   test.afterEach(async ({ page }) => {
     await deleteRecipe(page, testRecipeId)
   })
   ```

4. **Use Semantic Selectors**:
   ```typescript
   // Good
   await page.getByRole('button', { name: /save recipe/i })
   
   // Avoid
   await page.click('.btn-primary')
   ```

### Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up test data in `afterEach` hooks
3. **Waits**: Use Playwright's built-in waiting mechanisms instead of hard timeouts
4. **Assertions**: Use meaningful assertions with descriptive messages
5. **Mocking**: Mock external services to ensure consistent test results
6. **Screenshots**: Take screenshots on failure for debugging

### Debugging Failed Tests

1. **Run in UI Mode**: `pnpm test:e2e:pw:ui`
2. **Use Debug Mode**: `pnpm exec playwright test --debug`
3. **Check Screenshots**: Located in `test-results/` directory
4. **View Traces**: `pnpm exec playwright show-trace trace.zip`
5. **Check Videos**: Automatically recorded for failed tests

### CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests

The CI workflow:
1. Runs tests in parallel across Chrome, Firefox, and Safari
2. Uploads test reports and videos as artifacts
3. Fails the build if any tests fail

### Troubleshooting

**Tests fail locally but pass in CI:**
- Check environment variables
- Ensure database is migrated
- Verify service URLs match

**Flaky tests:**
- Add explicit waits for elements
- Check for race conditions
- Increase timeouts for slow operations

**Authentication issues:**
- Verify demo account exists
- Check Supabase configuration
- Ensure cookies are preserved

## Test Structure

```
e2e/
├── README.md               # This file
├── auth.spec.ts           # Authentication tests
├── recipe-creation.spec.ts # Recipe creation tests
├── recipe-editing.spec.ts  # Recipe editing tests
├── recipe-management.spec.ts # Recipe management tests
├── edge-cases.spec.ts     # Edge case tests
├── helpers/
│   ├── auth.ts           # Authentication helpers
│   └── test-utils.ts     # Common test utilities
└── screenshots/          # Screenshot storage (gitignored)
```