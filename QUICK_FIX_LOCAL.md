# Quick Fix for Local Development Database Issues

## Problem
- Prisma Client generation fails with file lock error
- Database tables don't exist
- Products API returns "Unknown error"

## ✅ SOLUTION (Run these commands)

### Step 1: Stop Dev Server
**IMPORTANT**: Press `Ctrl+C` in the terminal where `npm run dev` is running to stop it first!

### Step 2: Generate Prisma Client
```bash
npm run db:generate
```

If you still get file lock error:
- Close VS Code/Cursor completely
- Close all terminals
- Reopen and try again

### Step 3: Push Schema (Tables Already Created!)
The tables are already created from the previous `db:push` command. But if you need to verify:

```bash
# Verify tables exist
docker exec arbati_db_dev psql -U arbati_user -d arbati -c "\dt"

# Should show: products, customers, motorcycles, users, etc.
```

### Step 4: Restart Dev Server
```bash
npm run dev
```

## Summary
✅ **Tables are already created** (from previous db:push)
✅ **Email validation updated** - now allows:
   - All @arb-groups.com emails
   - hamajamalsabr@gmail.com (with ADMIN role)
✅ **Just need to generate Prisma Client** (stop dev server first!)

## To Create Admin User Manually

If you want to create the admin user immediately:

```bash
# Connect to database
docker exec -it arbati_db_dev psql -U arbati_user -d arbati

# Then in psql, run:
INSERT INTO users (id, email, "passwordHash", name, status, role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'hamajamalsabr@gmail.com',
  '$2a$10$dummy.hash.will.be.reset.on.first.otp.login',
  'hamajamalsabr',
  'ACTIVE',
  'ADMIN',
  NOW(),
  NOW()
);

# Exit psql
\q
```

Or just log in with OTP - the user will be auto-created with ADMIN role!

