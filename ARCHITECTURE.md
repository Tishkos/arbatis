# Arbati ERP - Architecture Documentation

## Table of Contents
1. [High-Level Architecture](#high-level-architecture)
2. [Layer Separation](#layer-separation)
3. [Domain Modules](#domain-modules)
4. [Draft Lifecycle](#draft-lifecycle)
5. [Authentication & Authorization](#authentication--authorization)
6. [i18n Strategy](#i18n-strategy)
7. [Database Design](#database-design)
8. [Scalability Roadmap](#scalability-roadmap)

---

## High-Level Architecture

Arbati is built as a **Next.js monolith** with clear domain boundaries, designed to evolve into a microservices architecture when needed. The system follows **Domain-Driven Design (DDD)** principles with strict separation of concerns.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                      │
│  (Next.js App Router - Server & Client Components)         │
│  - Pages & Routes                                           │
│  - UI Components (shadcn/ui)                                │
│  - Forms (React Hook Form + Zod)                            │
│  - Tables (TanStack Table)                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Application Layer                        │
│  - Server Actions (Next.js)                                 │
│  - Route Handlers (API)                                     │
│  - Request/Response DTOs (Zod)                              │
│  - Transaction Coordination                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                     Domain Layer                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │   Products   │ │    Sales     │ │  Customers   │        │
│  │   Module     │ │   Module     │ │   Module     │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ Motorcycles  │ │   Drafts     │ │  Invoices    │        │
│  │   Module     │ │   Module     │ │   Module     │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                              │
│  - Business Logic (Pure Functions)                          │
│  - Domain Services                                           │
│  - Domain Events                                             │
│  - Validation Rules                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  Infrastructure Layer                       │
│  - Repositories (Prisma)                                    │
│  - Database (PostgreSQL)                                    │
│  - Email Service                                            │
│  - File Storage                                             │
│  - Cache (Redis - future)                                   │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Separation of Concerns**: Each layer has a single responsibility
2. **Domain-Driven**: Business logic lives in domain modules, not in UI or data layers
3. **Dependency Inversion**: Domain layer doesn't depend on infrastructure
4. **Testability**: Business logic is pure functions, easy to unit test
5. **Auditability**: All critical operations are logged and traceable
6. **Data Integrity**: Transactions ensure consistency across operations

---

## Layer Separation

### 1. Presentation Layer (`src/app/`, `src/components/`)

**Responsibilities:**
- UI rendering (React Server/Client Components)
- User interactions
- Form handling (React Hook Form)
- Data display (TanStack Table)
- Route handling (Next.js App Router)

**Rules:**
- ❌ NO business logic
- ❌ NO direct database access
- ✅ Only UI state and presentation logic
- ✅ Calls Server Actions or API routes

**Example Flow:**
```typescript
// src/app/sales/mufrad/page.tsx (Server Component)
async function MufradPage() {
  const drafts = await draftService.getUserDrafts(userId);
  return <MufradSaleForm drafts={drafts} />;
}

// src/components/sales/MufradSaleForm.tsx (Client Component)
function MufradSaleForm({ drafts }) {
  const form = useForm<SaleFormData>({
    resolver: zodResolver(saleFormSchema),
  });
  
  const onSubmit = async (data) => {
    await createDraftAction(data); // Server Action
  };
}
```

### 2. Application Layer (`src/modules/*/actions.ts`, `src/app/api/*/route.ts`)

**Responsibilities:**
- Request/Response handling
- Input validation (Zod schemas)
- Transaction coordination
- Error handling and user-friendly messages
- Authentication/Authorization checks

**Rules:**
- ✅ Validates inputs
- ✅ Checks permissions
- ✅ Orchestrates domain services
- ✅ Manages transactions
- ❌ NO business logic (delegates to domain)

**Example:**
```typescript
// src/modules/drafts/actions.ts
export async function createDraftAction(
  input: CreateDraftInput,
  userId: string
) {
  // 1. Validate input
  const validated = createDraftSchema.parse(input);
  
  // 2. Check permissions
  await requirePermission(userId, 'drafts:create');
  
  // 3. Delegate to domain service
  return await draftService.create(validated, userId);
}
```

### 3. Domain Layer (`src/modules/*/domain/`, `src/modules/*/services.ts`)

**Responsibilities:**
- Business rules and logic
- Domain models and types
- Domain events
- Pure functions for calculations
- Validation rules

**Rules:**
- ✅ Contains ALL business logic
- ✅ Pure functions (testable)
- ✅ No dependencies on infrastructure
- ❌ NO database queries (uses repositories)
- ❌ NO framework dependencies

**Example:**
```typescript
// src/modules/sales/services.ts
export class SaleService {
  calculateLineTotal(
    quantity: number,
    unitPrice: number,
    discount?: number
  ): number {
    const subtotal = quantity * unitPrice;
    if (discount) {
      return subtotal - (subtotal * discount / 100);
    }
    return subtotal;
  }
  
  async createSale(draft: Draft, userId: string) {
    // Business rules
    if (draft.type === 'JUMLA' && !draft.customerId) {
      throw new Error('Jumla sales require a customer');
    }
    
    // Use repository (infrastructure)
    return await this.saleRepository.create(draft, userId);
  }
}
```

### 4. Infrastructure Layer (`src/modules/*/repositories.ts`, `src/lib/db.ts`)

**Responsibilities:**
- Database access (Prisma)
- External service integrations
- File system operations
- Caching

**Rules:**
- ✅ Implements repository interfaces
- ✅ Handles data persistence
- ✅ Optimizes queries
- ❌ NO business logic

**Example:**
```typescript
// src/modules/sales/repositories.ts
export class SaleRepository {
  async create(draft: Draft, userId: string): Promise<Sale> {
    return await prisma.$transaction(async (tx) => {
      // Create sale
      const sale = await tx.sale.create({...});
      
      // Create invoice
      const invoice = await tx.invoice.create({...});
      
      // Update stock
      await tx.stockMovement.createMany({...});
      
      return sale;
    });
  }
}
```

---

## Domain Modules

Each module is self-contained with clear boundaries:

```
modules/
  auth/
    domain/          # Auth domain models & types
    services.ts      # Auth business logic
    actions.ts       # Server actions
    repositories.ts  # Auth data access
    components/      # Auth UI components
    
  drafts/
    domain/
      types.ts       # Draft domain types
      rules.ts       # Draft business rules
    services.ts      # Draft service
    actions.ts       # Draft server actions
    repositories.ts  # Draft repository
    components/      # Draft UI components
    
  sales/
    domain/
      types.ts       # Sale domain types (Mufrad, Jumla)
    services.ts      # Sale calculation & validation
    actions.ts       # Sale server actions
    repositories.ts  # Sale repository
    
  products/
    domain/
      types.ts
    services.ts      # Product business logic
    repositories.ts
    
  ... (similar for other modules)
```

### Module Interaction

Modules interact through:
1. **Domain Events** (future): Decoupled communication
2. **Shared Services**: Common functionality (e.g., stock updates)
3. **Direct Service Calls**: When tight coupling is acceptable

Example: When a draft is finalized:
```
DraftService.finalize()
  → SaleService.create()
    → StockService.update()
    → CustomerService.updateBalance()
    → InvoiceService.create()
```

---

## Draft Lifecycle

### Draft States

```
CREATED → AUTOSAVING → READY → FINALIZING → FINALIZED
                              ↓
                          CANCELLED
```

### State Transitions

1. **CREATED**: Draft record created in DB
2. **AUTOSAVING**: Changes being saved (debounced)
3. **READY**: Draft is complete and ready to finalize
4. **FINALIZING**: Submission in progress (locked)
5. **FINALIZED**: Converted to Sale + Invoice
6. **CANCELLED**: User discarded draft

### Draft Data Flow

```
User Action (Add Product)
  ↓
Client Component (MufradSaleForm)
  ↓
Server Action (autosaveDraftAction)
  ↓
Domain Service (DraftService.autosave)
  ↓
Repository (DraftRepository.update)
  ↓
Database (Prisma Transaction)
  ↓
Local Cache Fallback (IndexedDB)
```

### Draft Rules

1. **Persistence**: All drafts stored in database immediately
2. **Autosave**: Debounced saves (500ms) on every change
3. **Survival**: Drafts survive browser close, refresh, logout
4. **Isolation**: Each user sees only their drafts (unless admin)
5. **Audit**: All draft changes logged (who, when, what)
6. **Locking**: Draft locked during finalization (prevents concurrent edits)

### Draft Finalization Process

```typescript
// Pseudo-code flow
async function finalizeDraft(draftId: string, userId: string) {
  // 1. Lock draft
  await draftRepo.lock(draftId);
  
  // 2. Validate draft
  const draft = await draftRepo.findById(draftId);
  validateDraft(draft);
  
  // 3. Create sale (domain service)
  const sale = await saleService.createFromDraft(draft, userId);
  
  // 4. Update stock (domain service)
  await stockService.updateFromSale(sale);
  
  // 5. Update customer balance (if applicable)
  if (draft.customerId) {
    await customerService.updateBalance(draft.customerId, sale.total);
  }
  
  // 6. Create invoice
  const invoice = await invoiceService.createFromSale(sale);
  
  // 7. Mark draft as finalized
  await draftRepo.markFinalized(draftId, sale.id, invoice.id);
  
  // 8. Unlock draft
  await draftRepo.unlock(draftId);
  
  return { sale, invoice };
}
```

---

## Authentication & Authorization

### Signup & Approval Flow

```
1. User fills signup form
   ↓
2. Server Action creates User with status=PENDING
   ↓
3. Email sent to Developer/Admin with approval link
   ↓
4. Developer clicks approval link
   ↓
5. User status updated to ACTIVE
   ↓
6. User can now login
```

### Role-Based Access Control (RBAC)

**Roles:**
- **DEVELOPER**: Full access, can approve signups
- **ADMIN**: Full business access, manage employees
- **EMPLOYEE/CASHIER**: Create sales, view products
- **VIEWER**: Read-only access

**Permissions:**
- `users:approve` - Approve signup requests
- `prices:edit` - Modify product prices
- `invoices:delete` - Delete invoices
- `stock:adjust` - Modify stock quantities
- `employees:manage` - Manage employees and roles
- `reports:view` - View financial reports
- `drafts:delete` - Delete drafts

### Authorization Strategy

1. **Middleware Protection**: Route-level checks
2. **Server Action Checks**: Function-level permission checks
3. **Component Guards**: UI-level conditional rendering
4. **Repository Checks**: Data-level access control

```typescript
// Middleware
export function requireAuth(request: Request) {
  const session = await getSession(request);
  if (!session) redirect('/login');
  return session;
}

// Server Action
export async function deleteInvoiceAction(invoiceId: string) {
  const user = await requireAuth();
  await requirePermission(user.id, 'invoices:delete');
  // ... proceed
}

// Component
function DeleteInvoiceButton({ invoiceId }) {
  const canDelete = usePermission('invoices:delete');
  if (!canDelete) return null;
  return <Button onClick={deleteInvoice}>Delete</Button>;
}
```

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

### Locale Detection

1. **URL-based**: `/ar/dashboard`, `/en/dashboard`, `/ku/dashboard`
2. **Cookie fallback**: User preference stored in cookie
3. **Browser fallback**: Accept-Language header
4. **Default**: `en`

### RTL/LTR Handling

```typescript
// Determine direction from locale
const direction = locale === 'ar' ? 'rtl' : 'ltr';

// Apply to HTML
<html dir={direction} lang={locale}>

// Tailwind RTL support
className="text-right rtl:text-left"
```

### Translation Structure

```
messages/
  ar.json
  en.json
  ku.json
  
  ar/
    products.json
    sales.json
    invoices.json
  en/
    products.json
    sales.json
    invoices.json
  ku/
    products.json
    sales.json
    invoices.json
```

### Invoice Printing

Invoices support all 3 languages with:
- Correct text direction (RTL for Arabic)
- Locale-appropriate number formatting
- Locale-appropriate date formatting
- Right-to-left layout for Arabic invoices

---

## Database Design

See `prisma/schema.prisma` for full schema. Key design decisions:

1. **Audit Fields**: `createdAt`, `updatedAt`, `createdById`, `updatedById` on all entities
2. **Soft Deletes**: `deletedAt` for recoverable deletions
3. **Indexes**: On foreign keys, searchable fields, dates
4. **Relations**: Proper foreign keys with cascade rules
5. **Enums**: Type-safe status fields (DraftStatus, SaleType, etc.)

### Key Tables

- `User`, `Role`, `Permission` - Auth
- `Product`, `Category`, `StockMovement` - Inventory
- `Motorcycle` - Motorcycle inventory
- `Customer`, `CustomerBalance` - Customer management
- `Draft`, `DraftItem` - Draft system
- `Sale`, `SaleItem` - Sales
- `Invoice`, `InvoiceItem` - Invoices
- `Employee` - Employee management

---

## Scalability Roadmap

### Phase 1: Monolith (Current)
- Next.js monolith with clear domain boundaries
- PostgreSQL database
- Single deployment

### Phase 2: Service Separation
- Extract API layer to separate service
- Frontend as static/SSR Next.js app
- API service as Node.js/Express or NestJS
- Shared domain layer (monorepo)

### Phase 3: Microservices
- Separate services: Products, Sales, Customers, Invoices
- Event-driven communication (Kafka/RabbitMQ)
- API Gateway
- Service mesh for inter-service communication

### Phase 4: Advanced Features
- Multi-warehouse support
- Real-time inventory sync
- Advanced reporting service
- Accounting system integration
- Mobile app (React Native)
- Third-party integrations (payment gateways, shipping)

### Scalability Considerations

1. **Database**: Read replicas, partitioning, caching layer (Redis)
2. **API**: Horizontal scaling, load balancing
3. **File Storage**: Object storage (S3, Azure Blob)
4. **Caching**: Redis for sessions, frequently accessed data
5. **Background Jobs**: Bull/BullMQ for async processing
6. **Monitoring**: APM, logging, metrics (Datadog, Sentry)

