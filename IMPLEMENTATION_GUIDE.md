# Arbati ERP - Implementation Guide

This document provides detailed implementation guides for key features.

## Table of Contents
1. [Draft Lifecycle Design](#draft-lifecycle-design)
2. [Authentication & Authorization Flow](#authentication--authorization-flow)
3. [i18n Strategy](#i18n-strategy)
4. [Database Setup](#database-setup)
5. [Development Workflow](#development-workflow)

---

## Draft Lifecycle Design

### Overview

Drafts are **first-class entities** that persist in the database. They represent in-progress sales that can be resumed at any time, even after browser close or user logout.

### State Machine

```
CREATED → AUTOSAVING → READY → FINALIZING → FINALIZED
         ↓            ↓
      CANCELLED    CANCELLED
```

### State Descriptions

1. **CREATED**: Initial state when draft is first created
2. **AUTOSAVING**: Changes are being saved (debounced, ~500ms)
3. **READY**: Draft is complete and ready to finalize
4. **FINALIZING**: Submission in progress (draft is locked)
5. **FINALIZED**: Converted to Sale + Invoice (final state)
6. **CANCELLED**: User discarded draft (final state)

### Data Flow

#### Creating a Draft

```typescript
// User action: Start new sale
User clicks "New Sale (Mufrad)"
  ↓
Client: MufradSaleForm component renders
  ↓
User adds product
  ↓
Client: Calls autosaveDraftAction (Server Action)
  ↓
Server: DraftService.create()
  ↓
Server: DraftRepository.create()
  ↓
Database: INSERT INTO drafts, draft_items
  ↓
Response: Draft created with ID
  ↓
Client: Updates local state, stores draftId in localStorage
```

#### Autosaving a Draft

```typescript
// User action: Modify draft (add item, change quantity, etc.)
User changes quantity
  ↓
Client: Debounced autosave (500ms)
  ↓
Client: Calls autosaveDraftAction (Server Action)
  ↓
Server: DraftService.update()
  ↓
Server: Validates changes
  ↓
Server: Recalculates totals
  ↓
Server: DraftRepository.update()
  ↓
Database: UPDATE drafts, DELETE old items, INSERT new items (transaction)
  ↓
Response: Updated draft
  ↓
Client: Updates UI (optimistic update)
```

#### Finalizing a Draft

```typescript
// User action: Submit draft
User clicks "Complete Sale"
  ↓
Client: Shows confirmation dialog (customer balance, payment method, etc.)
  ↓
User confirms
  ↓
Client: Calls finalizeDraftAction (Server Action)
  ↓
Server: DraftService.finalize()
  ↓
Server: Validates draft (canFinalizeDraft())
  ↓
Server: Locks draft (status = FINALIZING)
  ↓
Server: SaleService.createFromDraft()
  ↓
  ├─ Creates Sale record
  ├─ Creates SaleItem records
  ├─ Creates Invoice record
  ├─ Creates InvoiceItem records
  ├─ Updates stock (StockService.updateFromSale())
  ├─ Updates customer balance (if applicable)
  └─ Creates StockMovement records (audit)
  ↓
Server: DraftRepository.finalize() (links draft to sale/invoice)
  ↓
Database: Transaction commits
  ↓
Response: { saleId, invoiceId }
  ↓
Client: Redirects to invoice page
```

### Autosave Strategy

1. **Primary Storage**: Database (immediate persistence)
2. **Secondary Storage**: IndexedDB (fallback for offline)
3. **Debounce**: 500ms delay to prevent excessive writes
4. **Optimistic Updates**: UI updates immediately, syncs with server

### Implementation Example

```typescript
// Client-side autosave hook
function useDraftAutosave(draftId: string | null) {
  const [isSaving, setIsSaving] = useState(false);
  const debouncedAutosave = useMemo(
    () => debounce(async (data: UpdateDraftInput) => {
      if (!draftId) return;
      setIsSaving(true);
      try {
        await autosaveDraftAction(draftId, data);
      } finally {
        setIsSaving(false);
      }
    }, 500),
    [draftId]
  );

  return { autosave: debouncedAutosave, isSaving };
}

// Usage in component
const { autosave, isSaving } = useDraftAutosave(draft.id);

// When user changes quantity
const handleQuantityChange = (itemId: string, quantity: number) => {
  updateLocalState(itemId, quantity);
  autosave({ items: getCurrentItems() });
};
```

### Draft Recovery

When user returns to draft:
1. Fetch draft from database by ID
2. If not found, check IndexedDB (offline fallback)
3. Restore draft state in UI
4. Resume autosaving

---

## Authentication & Authorization Flow

### Signup & Approval Flow

```
1. User visits /signup
   ↓
2. User fills form (email, password, name)
   ↓
3. Client: Calls signupAction (Server Action)
   ↓
4. Server: Validates input (Zod schema)
   ↓
5. Server: Checks if email exists
   ↓
6. Server: Hashes password (bcrypt)
   ↓
7. Server: Creates User with status=PENDING
   ↓
8. Server: Sends approval email to Developer/Admin
   ↓
9. Response: Success message ("Awaiting approval")
   ↓
10. Developer receives email with approval link
   ↓
11. Developer clicks link → /api/auth/approve?token=...
   ↓
12. Server: Validates token
   ↓
13. Server: Updates User status to ACTIVE
   ↓
14. Server: Sends welcome email to user
   ↓
15. User can now login
```

### Login Flow

```
1. User visits /login
   ↓
2. User enters email/password
   ↓
3. Client: Calls signIn() (NextAuth)
   ↓
4. Server: NextAuth credentials provider
   ↓
5. Server: Looks up user by email
   ↓
6. Server: Verifies password (bcrypt.compare)
   ↓
7. Server: Checks user status (must be ACTIVE)
   ↓
8. Server: Loads user permissions (from Employee → Roles → Permissions)
   ↓
9. Server: Creates JWT session
   ↓
10. Response: Session cookie set
   ↓
11. Client: Redirects to /dashboard
```

### Authorization Flow

#### Route Protection (Middleware)

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const session = await getSession(request);
  
  // Check if route requires auth
  if (isProtectedRoute(request.nextUrl.pathname)) {
    if (!session) {
      return redirect(new URL('/login', request.url));
    }
    
    // Check role-based access
    if (requiresAdmin(request.nextUrl.pathname)) {
      if (session.user.role !== 'ADMIN' && session.user.role !== 'DEVELOPER') {
        return redirect(new URL('/dashboard', request.url));
      }
    }
  }
  
  return NextResponse.next();
}
```

#### Server Action Authorization

```typescript
// modules/drafts/actions.ts
export async function deleteDraftAction(draftId: string) {
  // 1. Get session
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error('Unauthorized');
  }
  
  // 2. Check permission
  requirePermission(
    session.user.permissions,
    PERMISSIONS.DRAFTS_DELETE
  );
  
  // 3. Check ownership (users can only delete their own drafts, unless admin)
  if (session.user.role !== 'ADMIN' && session.user.role !== 'DEVELOPER') {
    const draft = await draftRepository.findById(draftId);
    if (draft.createdById !== session.user.id) {
      throw new Error('Permission denied');
    }
  }
  
  // 4. Perform action
  await draftService.cancel(draftId, session.user.id);
}
```

#### Component-Level Authorization

```typescript
// components/sales/DeleteInvoiceButton.tsx
function DeleteInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const { data: session } = useSession();
  const hasPermission = hasPermission(
    session?.user.permissions || [],
    PERMISSIONS.INVOICES_DELETE
  );
  
  if (!hasPermission) {
    return null; // Don't render button
  }
  
  return (
    <Button onClick={() => deleteInvoice(invoiceId)}>
      Delete Invoice
    </Button>
  );
}
```

### Permission System

Permissions are stored in a many-to-many relationship:
- `Employee` → `EmployeeRole` → `Role` → `RolePermission` → `Permission`

Example:
- Employee "John" has Role "Cashier"
- Role "Cashier" has Permissions: ["sales:create", "drafts:create", "invoices:view"]
- John's permissions: ["sales:create", "drafts:create", "invoices:view"]

---

## i18n Strategy

### Locale Routing

Next.js App Router structure:
```
app/
  [locale]/
    (dashboard)/
      dashboard/
      products/
      sales/
    (auth)/
      login/
      signup/
```

### Locale Detection Flow

```
1. User visits /products
   ↓
2. Middleware checks:
   - URL param: /ar/products → locale = 'ar'
   - Cookie: locale preference
   - Accept-Language header
   - Default: 'en'
   ↓
3. Redirect to /[locale]/products
   ↓
4. Server Component receives locale
   ↓
5. Load translations from messages/[locale].json
   ↓
6. Render with correct locale and direction
```

### Implementation

#### Middleware

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './src/lib/i18n';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always', // Always show locale in URL
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

#### Server Component

```typescript
// app/[locale]/products/page.tsx
import { useTranslations } from 'next-intl';
import { getLocale } from '@/lib/i18n';

export default async function ProductsPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = getLocale(params.locale);
  const t = await getTranslations({ locale, namespace: 'products' });
  
  return (
    <div>
      <h1>{t('title')}</h1>
      {/* ... */}
    </div>
  );
}
```

#### Client Component

```typescript
// components/products/ProductList.tsx
'use client';

import { useTranslations } from 'next-intl';

export function ProductList() {
  const t = useTranslations('products');
  
  return (
    <div>
      <h1>{t('title')}</h1>
    </div>
  );
}
```

#### Layout with Direction

```typescript
// app/[locale]/layout.tsx
import { getTextDirection } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const locale = getLocale(params.locale);
  const direction = getTextDirection(locale);
  
  return (
    <html lang={locale} dir={direction}>
      <body>{children}</body>
    </html>
  );
}
```

### Translation Files Structure

```
messages/
  ar.json          # Arabic translations
  en.json          # English translations
  ku.json          # Kurdish translations
  ar/
    products.json  # Arabic product translations
    sales.json     # Arabic sales translations
  en/
    products.json
    sales.json
  ku/
    products.json
    sales.json
```

### Invoice Printing

Invoices are rendered as printable pages with locale-aware formatting:

```typescript
// app/[locale]/invoices/[id]/print/page.tsx
export default async function PrintInvoice({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const locale = getLocale(params.locale);
  const direction = getTextDirection(locale);
  const invoice = await getInvoice(params.id);
  
  return (
    <div dir={direction} lang={locale} className="print-container">
      {/* Invoice content with locale-aware formatting */}
    </div>
  );
}
```

---

## Database Setup

### Initial Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your database URL

# 3. Generate Prisma Client
npm run db:generate

# 4. Run migrations
npm run db:migrate

# 5. (Optional) Seed database
npm run db:seed

# 6. (Optional) Open Prisma Studio
npm run db:studio
```

### Using Docker

```bash
# Development
docker-compose -f docker-compose.dev.yml up -d

# Production
docker-compose up -d

# Run migrations
docker-compose exec web npm run db:migrate
```

---

## Development Workflow

### Recommended Workflow

1. **Start Database**: `docker-compose -f docker-compose.dev.yml up -d db`
2. **Run Migrations**: `npm run db:migrate`
3. **Start Dev Server**: `npm run dev`
4. **Open Prisma Studio**: `npm run db:studio` (optional)

### Code Organization

- **Domain Logic**: `src/modules/[module]/domain/` and `services.ts`
- **Data Access**: `src/modules/[module]/repositories.ts`
- **API/Server Actions**: `src/modules/[module]/actions.ts`
- **UI Components**: `src/modules/[module]/components/` or `src/components/`
- **Pages**: `src/app/[locale]/[route]/`

### Testing Strategy

1. **Unit Tests**: Domain services and business rules
2. **Integration Tests**: Repository layer with test database
3. **E2E Tests**: Critical flows (login, create sale, finalize draft)

---

## Next Steps

1. Implement remaining modules (Products, Sales, Customers, etc.)
2. Set up shadcn/ui components
3. Create UI layouts (Sidebar, Navbar)
4. Implement authentication pages
5. Build dashboard
6. Create data tables with TanStack Table
7. Implement draft UI
8. Set up email service
9. Add low-stock alerts
10. Implement invoice printing

