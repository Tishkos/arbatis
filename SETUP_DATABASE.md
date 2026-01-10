# Database Setup Guide

## ✅ Database is Running!

Your PostgreSQL database is now running in Docker.

### Container Status
- **Container Name:** `arbati_db_dev`
- **Status:** Running
- **Port:** `5432` (mapped to localhost:5432)
- **Database:** `arbati_db`
- **User:** `arbati_user`
- **Password:** `arbati_password`

## Next Steps

### 1. Generate Prisma Client
```bash
npm run db:generate
```

If you get a file lock error, make sure the dev server is stopped, then try again.

### 2. Create Initial Migration
```bash
npm run db:migrate
```

This will:
- Create the initial migration file
- Apply it to the database
- Create all tables according to your Prisma schema

### 3. (Optional) Open Prisma Studio
To view and manage your database with a GUI:
```bash
npm run db:studio
```

This will open Prisma Studio at `http://localhost:5555`

## Database Connection String

Your `.env.local` should have:
```env
DATABASE_URL="postgresql://arbati_user:arbati_password@localhost:5432/arbati_db?schema=public"
```

## Useful Commands

### Start Database
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Stop Database
```bash
docker-compose -f docker-compose.dev.yml down
```

### View Database Logs
```bash
docker-compose -f docker-compose.dev.yml logs -f db
```

### Access PostgreSQL CLI
```bash
docker exec -it arbati_db_dev psql -U arbati_user -d arbati_db
```

### Reset Database (⚠️ Deletes all data)
```bash
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
npm run db:migrate
```

## Troubleshooting

### Port 5432 already in use
If you have another PostgreSQL instance running, either:
1. Stop the other instance
2. Change the port in `docker-compose.dev.yml` (e.g., `"5433:5432"`)

### Connection refused
- Make sure the container is running: `docker ps`
- Check container logs: `docker logs arbati_db_dev`
- Wait a few seconds for the database to fully start

### Prisma generate file lock error
- Stop the Next.js dev server (`Ctrl+C`)
- Try `npm run db:generate` again
- If still failing, close any database tools (like Prisma Studio or DB clients)

