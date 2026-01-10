# Arbati ERP - Recommended Folder Structure

```
arbati/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── [locale]/                 # i18n routing
│   │   │   ├── (auth)/               # Auth route group
│   │   │   │   ├── login/
│   │   │   │   └── signup/
│   │   │   ├── (dashboard)/          # Dashboard route group (protected)
│   │   │   │   ├── dashboard/        # Home/Dashboard
│   │   │   │   ├── products/
│   │   │   │   ├── motorcycles/
│   │   │   │   ├── sales/
│   │   │   │   │   ├── mufrad/
│   │   │   │   │   └── jumla/
│   │   │   │   ├── invoices/
│   │   │   │   ├── customers/
│   │   │   │   ├── employees/
│   │   │   │   └── settings/
│   │   │   ├── api/                  # API routes
│   │   │   │   ├── auth/
│   │   │   │   ├── drafts/
│   │   │   │   └── ...
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   └── layout.tsx                # Root layout
│   │
│   ├── modules/                      # Domain modules (DDD)
│   │   ├── auth/
│   │   │   ├── domain/
│   │   │   │   ├── types.ts
│   │   │   │   └── rules.ts
│   │   │   ├── services.ts
│   │   │   ├── actions.ts            # Server actions
│   │   │   ├── repositories.ts
│   │   │   └── components/
│   │   │
│   │   ├── users/
│   │   │   ├── domain/
│   │   │   ├── services.ts
│   │   │   ├── actions.ts
│   │   │   └── repositories.ts
│   │   │
│   │   ├── roles/
│   │   │   ├── domain/
│   │   │   ├── services.ts
│   │   │   └── repositories.ts
│   │   │
│   │   ├── products/
│   │   │   ├── domain/
│   │   │   │   ├── types.ts
│   │   │   │   └── rules.ts
│   │   │   ├── services.ts
│   │   │   ├── actions.ts
│   │   │   ├── repositories.ts
│   │   │   └── components/
│   │   │
│   │   ├── categories/
│   │   │   ├── domain/
│   │   │   ├── services.ts
│   │   │   └── repositories.ts
│   │   │
│   │   ├── motorcycles/
│   │   │   ├── domain/
│   │   │   ├── services.ts
│   │   │   ├── actions.ts
│   │   │   └── repositories.ts
│   │   │
│   │   ├── sales/
│   │   │   ├── domain/
│   │   │   │   ├── types.ts          # SaleType, SaleStatus, etc.
│   │   │   │   └── rules.ts          # Business rules
│   │   │   ├── services.ts           # Sale calculation, validation
│   │   │   ├── actions.ts
│   │   │   └── repositories.ts
│   │   │
│   │   ├── drafts/                   # CRITICAL MODULE
│   │   │   ├── domain/
│   │   │   │   ├── types.ts          # DraftStatus, Draft types
│   │   │   │   └── rules.ts          # Draft validation rules
│   │   │   ├── services.ts           # Draft lifecycle, autosave
│   │   │   ├── actions.ts
│   │   │   ├── repositories.ts
│   │   │   └── components/
│   │   │
│   │   ├── invoices/
│   │   │   ├── domain/
│   │   │   ├── services.ts
│   │   │   ├── actions.ts
│   │   │   └── repositories.ts
│   │   │
│   │   ├── customers/
│   │   │   ├── domain/
│   │   │   ├── services.ts
│   │   │   ├── actions.ts
│   │   │   └── repositories.ts
│   │   │
│   │   ├── employees/
│   │   │   ├── domain/
│   │   │   ├── services.ts
│   │   │   └── repositories.ts
│   │   │
│   │   ├── stock/
│   │   │   ├── domain/
│   │   │   ├── services.ts           # Stock calculation, validation
│   │   │   └── repositories.ts
│   │   │
│   │   └── notifications/
│   │       ├── services.ts
│   │       └── email.ts
│   │
│   ├── components/                   # Shared UI components
│   │   ├── ui/                       # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── table.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Navbar.tsx
│   │   │   └── DashboardLayout.tsx
│   │   │
│   │   ├── tables/
│   │   │   ├── DataTable.tsx
│   │   │   └── ...
│   │   │
│   │   ├── forms/
│   │   │   ├── ProductForm.tsx
│   │   │   ├── CustomerForm.tsx
│   │   │   └── ...
│   │   │
│   │   └── widgets/
│   │       ├── StatsCard.tsx
│   │       ├── LowStockAlert.tsx
│   │       └── ...
│   │
│   ├── lib/                          # Shared utilities
│   │   ├── db.ts                     # Prisma client
│   │   ├── auth.ts                   # Auth utilities
│   │   ├── i18n.ts                   # i18n configuration
│   │   ├── email.ts                  # Email service
│   │   ├── config.ts                 # App configuration
│   │   ├── logger.ts                 # Logging utility
│   │   ├── utils.ts                  # General utilities
│   │   └── permissions.ts            # Permission checks
│   │
│   ├── types/                        # Global TypeScript types
│   │   ├── database.ts               # Database types
│   │   ├── api.ts                    # API types
│   │   └── index.ts
│   │
│   └── styles/
│       └── globals.css
│
├── messages/                         # i18n translations
│   ├── ar.json
│   ├── en.json
│   ├── ku.json
│   ├── ar/
│   │   ├── products.json
│   │   ├── sales.json
│   │   └── ...
│   ├── en/
│   │   ├── products.json
│   │   ├── sales.json
│   │   └── ...
│   └── ku/
│       ├── products.json
│       ├── sales.json
│       └── ...
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
├── public/                           # Static assets
│
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── ARCHITECTURE.md
└── README.md
```

## Key Files to Create for Each Module

### Example: Drafts Module

```
modules/drafts/
├── domain/
│   ├── types.ts          # DraftStatus enum, Draft domain type
│   └── rules.ts          # validateDraft(), canFinalize(), etc.
├── services.ts           # DraftService class
├── actions.ts            # Server actions (createDraft, autosaveDraft, finalizeDraft)
├── repositories.ts       # DraftRepository class (Prisma)
└── components/
    ├── DraftList.tsx
    ├── DraftForm.tsx
    └── DraftPreview.tsx
```

### Example: Sales Module

```
modules/sales/
├── domain/
│   ├── types.ts          # SaleType, SaleStatus, Sale domain type
│   └── rules.ts          # calculateTotals(), validateSale(), etc.
├── services.ts           # SaleService class
├── actions.ts            # createSaleAction, getSalesAction
└── repositories.ts       # SaleRepository class
```

