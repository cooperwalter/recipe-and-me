# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Recipe Inheritance Keeper** - A family recipe preservation platform that captures, digitizes, and shares cherished family recipes across generations. Built with Next.js and Supabase to create a beautiful digital cookbook from various sources including handwritten cards, photos, and voice recordings.

## Development Commands

```bash
# Install dependencies
pnpm install

# Development server (auto-recovers from ENOENT errors)
pnpm dev              # With auto-recovery monitoring
pnpm dev:basic        # Basic Next.js dev without recovery
pnpm dev:clean-start  # Cleans cache once at start

# Database commands
pnpm db:generate      # Generate new migration from schema changes
pnpm db:migrate       # Run pending migrations
pnpm db:studio        # Open Drizzle Studio for database exploration
pnpm db:status        # Check migration status

# Testing
pnpm test            # Run all tests
pnpm test:unit       # Unit tests only
pnpm test:api        # API tests only
pnpm test:e2e        # E2E tests only
pnpm test:coverage   # Generate coverage report

# Build & Production
pnpm build           # Build for production (runs migrations)
pnpm start           # Start production server
pnpm lint            # Run ESLint

# Storage setup (run once)
pnpm storage:setup   # Create Supabase storage buckets
```

## Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL via Supabase + Drizzle ORM
- **Auth**: Supabase Auth with middleware session refresh
- **UI**: Tailwind CSS + shadcn/ui components
- **AI**: Anthropic Claude (OCR/NLP) + OpenAI (voice transcription)

### Key Directories
- `/app` - Next.js App Router pages
  - `/api` - API routes with service layer pattern
  - `/auth` - Authentication flows
  - `/protected` - Authenticated routes
- `/components` - React components
  - `/ui` - shadcn/ui component library
  - `/recipe` - Recipe-specific components
- `/lib` - Core utilities
  - `/db` - Database schema and client
  - `/services` - Business logic layer
  - `/supabase` - Auth clients (server/client/middleware)
- `/scripts` - Development and migration tools

### Database Schema (Drizzle ORM)
- **recipes** - Core recipe data with soft delete
- **ingredients** - Normalized with decimal amounts
- **instructions** - Step-by-step with ordering
- **recipe_photos** - Multiple photos with original flag
- **recipe_versions** - Complete JSONB snapshots
- **favorites**, **recipe_tags**, **recipe_categories** - User features

### Authentication Pattern
1. Middleware (`middleware.ts`) refreshes sessions on every request
2. Server components use `createClient()` from `/lib/supabase/server.ts`
3. Client components use `createBrowserClient()` from `/lib/supabase/client.ts`
4. API routes check auth via `getUser()` before processing

### Service Layer Pattern
API routes delegate to services (e.g., `RecipeService`) which handle:
- Database operations via Drizzle ORM
- Business logic and validation
- Consistent error handling
- Transaction management

### AI Integration
- **OCR**: Uses Claude Vision API for image text extraction
- **Voice**: OpenAI Whisper for transcription (requires OPENAI_API_KEY in production)
- **NLP**: Claude for understanding recipe modifications from natural language

### Storage Structure
Supabase Storage buckets:
- `recipe-photos` - Finished dish photos
- `ocr-uploads` - Temporary OCR processing
- `original-recipe-cards` - Preserved originals

Files stored as: `{user-id}/{filename}` for RLS policies

## Testing Approach
- **Unit Tests**: Components and utilities with React Testing Library
- **API Tests**: Full route testing with mocked Supabase
- **E2E Tests**: Critical user flows
- **Mocking**: Comprehensive Supabase client mocks in `__tests__/__mocks__`

## Environment Variables
Required in production:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (for voice features)
- `ANTHROPIC_API_KEY` (for OCR/NLP)

## Important Notes
- Always use Drizzle ORM for database operations (not raw SQL)
- Follow existing patterns for consistency
- Run `pnpm lint` before committing
- Voice features fall back to mocks in development

## Memories
- Whenever the "project roadmap", "roadmap", or similar, is referred to, this means the PROJECT_ROADMAP.md document in the project root.
- When creating pull requests, use the github cli (gh)
- Do not commit and push any changes while there are failing unit tests
- When fixing tests, do not stop until all test failures are resolved
- Every time you make a change, check that unit tests succeed (pnpm run test)
- Every time you make a change, ensure that you lint and that linting succeeds