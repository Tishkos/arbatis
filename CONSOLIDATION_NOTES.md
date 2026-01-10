# App Directory Consolidation

## Changes Made

We've consolidated the app structure to use the root `app/` directory instead of `src/app/`.

### Directory Structure

- **Before**: `src/app/` (with duplicate `app/` at root)
- **After**: `app/` (root level)

### Files Moved/Created

1. **Root Layout**: `app/layout.tsx`
2. **Home Page**: `app/page.tsx` (redirects to `/ku`)
3. **Globals CSS**: `app/globals.css` (updated with shadcn/ui variables)
4. **Providers**: `app/providers.tsx`

5. **Locale Structure**:
   - `app/[locale]/layout.tsx`
   - `app/[locale]/page.tsx` (redirects to `/[locale]/dashboard`)
   - `app/[locale]/(auth)/login/page.tsx`
   - `app/[locale]/(auth)/login/loading.tsx`
   - `app/[locale]/(auth)/signup/page.tsx`
   - `app/[locale]/(auth)/signup/loading.tsx`

6. **API Routes**:
   - `app/api/auth/[...nextauth]/route.ts`

### Configuration Updates

1. **tsconfig.json**: Updated paths from `@/*": ["./src/*"]` to `@/*": ["./*"]`
2. **components.json**: Updated CSS path from `src/app/globals.css` to `app/globals.css`

### What Stays in `src/`

- `src/components/` - UI components
- `src/lib/` - Utilities and configuration
- `src/modules/` - Domain modules (DDD)
- `src/types/` - TypeScript types
- `src/middleware.ts` - Next.js middleware

### Next Steps

1. Move dashboard pages from `src/app/dashboard/` to `app/[locale]/(dashboard)/dashboard/`
2. Update all imports if needed
3. Remove old `src/app/` directory (after verifying everything works)

### Notes

- Next.js can use either `app/` or `src/app/`, but not both
- We're using root `app/` for routes
- All code (components, modules, lib) stays in `src/`
- Path aliases updated to work with this structure

