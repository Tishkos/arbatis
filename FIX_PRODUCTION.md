# Fix Production Database - Quick Guide

## Problem
The `otp_tokens` table (and possibly other tables) don't exist because migrations haven't been run.

## Solution

Run these commands on your VPS:

### Option 1: Using Docker Compose (Recommended)

```bash
# Navigate to your project directory
cd /var/www/arbatis

# Generate Prisma Client (if needed)
docker compose exec web npx prisma generate

# Run migrations to create all tables
docker compose exec web npx prisma migrate deploy

# Verify the tables were created
docker compose exec web npx prisma db pull
```

### Option 2: Using Docker Exec

```bash
# Run migrations
docker exec arbati-web npx prisma migrate deploy

# Or if container name is different, check with:
docker ps
```

### Option 3: If Migrations Don't Exist

If you don't have migration files, use `db push` instead:

```bash
docker compose exec web npx prisma db push

# This will create all tables based on your schema.prisma
```

### Verify Everything Works

After running migrations, check the logs:

```bash
# Check if errors are gone
docker logs arbati-web

# Test the application
curl http://localhost:3000/api/health
```

### If You Still Have Issues

1. **Check database connection:**
```bash
docker compose exec db psql -U arbati -d arbati -c "\dt"
```

2. **Check Prisma schema matches database:**
```bash
docker compose exec web npx prisma db pull
```

3. **Regenerate Prisma Client:**
```bash
docker compose exec web npx prisma generate
```

4. **Restart the web container:**
```bash
docker compose restart web
```

