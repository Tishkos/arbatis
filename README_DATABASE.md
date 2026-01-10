# Database Setup with Docker

## Quick Start

1. **Start the database:**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Update your `.env.local` file:**
   ```env
   DATABASE_URL="postgresql://arbati_user:arbati_password@localhost:5432/arbati_db?schema=public"
   ```

3. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

4. **Generate Prisma Client:**
   ```bash
   npm run db:generate
   ```

## Database Connection Details

- **Host:** localhost
- **Port:** 5432
- **Database:** arbati_db
- **User:** arbati_user
- **Password:** arbati_password

## Docker Commands

### Start database
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Stop database
```bash
docker-compose -f docker-compose.dev.yml down
```

### View database logs
```bash
docker-compose -f docker-compose.dev.yml logs -f db
```

### Access PostgreSQL CLI
```bash
docker exec -it arbati_db_dev psql -U arbati_user -d arbati_db
```

### Reset database (⚠️ This will delete all data)
```bash
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
npm run db:migrate
```

## Prisma Commands

### Generate Prisma Client
```bash
npm run db:generate
```

### Run migrations
```bash
npm run db:migrate
```

### Create a new migration
```bash
npm run db:migrate:dev
```

### Reset database (⚠️ This will delete all data)
```bash
npm run db:reset
```

### Open Prisma Studio (Database GUI)
```bash
npm run db:studio
```

## Troubleshooting

### Database connection refused
- Make sure Docker is running
- Check if the container is running: `docker ps`
- Check container logs: `docker-compose -f docker-compose.dev.yml logs db`

### Port 5432 already in use
- Stop other PostgreSQL instances
- Or change the port in `docker-compose.dev.yml`

### Migration errors
- Make sure the database is running
- Check that `DATABASE_URL` in `.env.local` matches the Docker setup
- Try resetting the database (see above)

