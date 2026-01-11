# Fix Dockerfile Prisma Version Issue

## Problem
Your Dockerfile on the server is installing Prisma 7.2.0 globally, which conflicts with your project that uses Prisma 5.22.0.

## Solution

**On your VPS server, edit the Dockerfile and remove/update the problematic line:**

### Step 1: Check Current Dockerfile

```bash
cd /var/www/arbatis
cat Dockerfile | grep -i prisma
```

### Step 2: Edit Dockerfile

```bash
nano Dockerfile
```

**Find this line (around line 9 in builder stage):**
```dockerfile
RUN npm install -g prisma@7.2.0
```

**Remove it or comment it out:**
```dockerfile
# RUN npm install -g prisma@7.2.0  # REMOVED - conflicts with package.json version
```

**Also check that the Prisma generate line uses the local version:**
```dockerfile
# Should be:
RUN ./node_modules/.bin/prisma generate

# NOT:
RUN prisma generate  # This might use global version
```

### Step 3: Rebuild Docker Image

```bash
# Rebuild the image
docker compose build --no-cache web

# Or rebuild everything
docker compose build --no-cache

# Start services
docker compose up -d

# Check logs
docker logs -f arbati-web
```

### Alternative: Quick Fix

If you want a quick fix without editing, you can use this command to rebuild with the correct Dockerfile:

```bash
cd /var/www/arbatis

# Pull latest changes if using git
git pull

# Rebuild
docker compose build --no-cache web
docker compose up -d web
```

### Verify Prisma Version

After rebuild, verify it's using the correct version:

```bash
docker compose exec web npx prisma --version
# Should show: prisma/5.22.0 (or similar, not 7.x.x)
```

