# VPS Setup Checklist - Final Fixes

## Issues Found:

1. ✅ Dockerfile uses `npx prisma generate` - should use local binary to be safe
2. ⚠️ Need to run database migrations after container starts
3. ⚠️ Prisma Client might not be available in runner stage

## Fixes to Apply:

### Fix 1: Update Dockerfile (on VPS)

```bash
cd /var/www/arbatis
nano Dockerfile
```

**Find this line (around line 50):**
```dockerfile
RUN npx prisma generate
```

**Change it to:**
```dockerfile
RUN ./node_modules/.bin/prisma generate
```

**Also, in the runner stage, you need to copy Prisma Client. Find this section (around line 60-65):**
```dockerfile
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
```

**Make sure it includes:**
```dockerfile
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
```

### Fix 2: Rebuild and Start

```bash
# Rebuild the image
docker compose build --no-cache web

# Start services
docker compose up -d

# Wait for database to be ready
sleep 10

# Run database migrations
docker compose exec web npm run db:push

# Or if you have migrations:
# docker compose exec web npm run db:migrate:deploy

# Restart web container
docker compose restart web

# Check logs
docker logs -f arbati-web
```

### Fix 3: Verify Everything Works

```bash
# Check if otp_tokens table exists
docker compose exec db psql -U arbati_user -d arbati -c "\dt otp_tokens"

# Check Prisma version
docker compose exec web npx prisma --version

# Test health endpoint
curl http://localhost:4000/api/health
```

