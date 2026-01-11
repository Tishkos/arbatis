# Fix Local Database Setup - Windows

## Problem
- Prisma files are locked (EPERM error)
- Database tables don't exist
- "Unknown error" when fetching products

## Solution

### Step 1: Stop the Dev Server
**IMPORTANT**: Stop your Next.js dev server first (Ctrl+C in the terminal where it's running)

### Step 2: Generate Prisma Client
```bash
npm run db:generate
```

If you still get EPERM error:
- Close all terminals and editors that might be using the files
- Restart your terminal
- Try again

### Step 3: Start Database (if not running)
```bash
# Check if database is running
docker ps

# If not running, start it
docker-compose -f docker-compose.dev.yml up -d db

# Wait 10 seconds for database to be ready
timeout /t 10
```

### Step 4: Push Schema to Database (Create Tables)
```bash
# This will create all tables from your schema
npm run db:push
```

### Step 5: Verify Tables Were Created
```bash
# Check if tables exist
docker exec arbati_db_dev psql -U arbati_user -d arbati -c "\dt"
```

### Step 6: Restart Dev Server
```bash
npm run dev
```

## Alternative: If db:push doesn't work

Use migrations instead:
```bash
# Create initial migration
npx prisma migrate dev --name init

# Or if you get errors, use:
npx prisma migrate reset --skip-seed
npx prisma migrate dev
```

## Quick Fix Script

Run these commands in order:

```powershell
# 1. Stop any running processes (manually stop dev server first!)

# 2. Generate Prisma Client
npm run db:generate

# 3. Start database
docker-compose -f docker-compose.dev.yml up -d db

# 4. Wait for database
Start-Sleep -Seconds 10

# 5. Push schema
npm run db:push

# 6. Start dev server
npm run dev
```

