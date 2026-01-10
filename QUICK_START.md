# Arbati ERP - Quick Start Guide

This guide will help you get Arbati running quickly.

## Prerequisites

- Node.js 20+ installed
- PostgreSQL 16+ (or Docker)
- Git

## Step 1: Install Dependencies

```bash
cd arbati
npm install
```

## Step 2: Environment Setup

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://arbati:arbati_password@localhost:5432/arbati?schema=public"

# Auth (generate random secrets, min 32 chars)
AUTH_SECRET="your-random-secret-key-here-min-32-characters-long"
JWT_SECRET="your-random-jwt-secret-key-here-min-32-characters-long"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="development"

# Email (optional for development)
EMAIL_PROVIDER="smtp"
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="your-password"
EMAIL_FROM="noreply@arbati.com"
APPROVAL_EMAIL="admin@arbati.com"
```

**Generate secrets:**
```bash
# On Linux/Mac
openssl rand -base64 32

# On Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

## Step 3: Database Setup

### Option A: Using Docker (Recommended for Development)

```bash
# Start PostgreSQL container
docker-compose -f docker-compose.dev.yml up -d db

# Wait a few seconds for DB to be ready, then run migrations
npm run db:generate
npm run db:migrate
```

### Option B: Using Local PostgreSQL

1. Create database:
```sql
CREATE DATABASE arbati;
CREATE USER arbati WITH PASSWORD 'arbati_password';
GRANT ALL PRIVILEGES ON DATABASE arbati TO arbati;
```

2. Run migrations:
```bash
npm run db:generate
npm run db:migrate
```

## Step 4: (Optional) Seed Database

Create initial data:

```bash
npm run db:seed
```

Note: You'll need to create a seed file at `prisma/seed.ts`. See Prisma docs for seed file format.

## Step 5: Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Step 6: Create First User

1. Sign up at `/signup`
2. User will be created with status `PENDING`
3. Approve user manually in database:
```sql
UPDATE users SET status = 'ACTIVE' WHERE email = 'your-email@example.com';
```
4. Or implement approval endpoint (see IMPLEMENTATION_GUIDE.md)

## Next Steps

1. **Read Documentation**:
   - [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
   - [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - Implementation details
   - [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md) - Project structure

2. **Implement Features**:
   - Set up authentication pages
   - Create dashboard
   - Implement product management
   - Build draft system UI
   - Create invoice templates

3. **Configure**:
   - Set up email service (SMTP)
   - Configure i18n translations
   - Set up shadcn/ui components
   - Customize theme

## Troubleshooting

### Database Connection Error

- Check PostgreSQL is running: `docker ps` or `pg_isready`
- Verify DATABASE_URL in .env
- Check PostgreSQL logs: `docker-compose logs db`

### Prisma Generate Error

- Make sure PostgreSQL is running
- Check DATABASE_URL is correct
- Try: `npx prisma generate --schema=./prisma/schema.prisma`

### Port Already in Use

- Change port: `npm run dev -- -p 3001`
- Or kill process using port 3000

### Module Not Found Errors

- Run: `npm install`
- Delete `node_modules` and `package-lock.json`, then reinstall

## Development Tools

### Prisma Studio (Database GUI)

```bash
npm run db:studio
```

Opens at [http://localhost:5555](http://localhost:5555)

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Production Deployment

See [README.md](./README.md#production-deployment) for production deployment instructions.

