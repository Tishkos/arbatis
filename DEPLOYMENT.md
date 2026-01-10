# Deployment Guide - Arbati ERP

Complete guide for deploying Arbati ERP on a VPS with Docker.

## Table of Contents

1. [VPS Requirements](#vps-requirements)
2. [Initial Server Setup](#initial-server-setup)
3. [Docker Installation](#docker-installation)
4. [Application Deployment](#application-deployment)
5. [Database Setup](#database-setup)
6. [Nginx Reverse Proxy](#nginx-reverse-proxy)
7. [SSL Certificate Setup](#ssl-certificate-setup)
8. [Backup Configuration](#backup-configuration)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

## VPS Requirements

**Minimum Requirements:**
- **CPU**: 2 cores
- **RAM**: 2GB (4GB recommended)
- **Storage**: 20GB SSD (50GB+ recommended for backups)
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+

**Recommended Providers:**
- DigitalOcean
- Linode
- AWS EC2
- Azure VM
- Vultr

## Initial Server Setup

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Create Non-Root User (Optional but Recommended)

```bash
adduser arbati
usermod -aG sudo arbati
su - arbati
```

### 3. Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

## Docker Installation

### Install Docker

```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc

# Install dependencies
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
sudo docker run hello-world
docker --version
docker compose version
```

### Configure Docker (Optional)

```bash
# Add current user to docker group (to run without sudo)
sudo usermod -aG docker $USER
newgrp docker

# Test without sudo
docker run hello-world
```

## Application Deployment

### 1. Clone Repository

```bash
cd /opt  # or your preferred directory
git clone <your-repository-url> arbati
cd arbati
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with production values
nano .env
```

**Critical Environment Variables:**

```env
# Database (used by docker-compose)
POSTGRES_USER=arbati
POSTGRES_PASSWORD=CHANGE_THIS_TO_SECURE_PASSWORD
POSTGRES_DB=arbati

# Full database URL for application
DATABASE_URL=postgresql://arbati:CHANGE_THIS_TO_SECURE_PASSWORD@db:5432/arbati?schema=public

# Authentication secrets (generate with: openssl rand -base64 32)
AUTH_SECRET=your_32_char_minimum_random_secret_here
JWT_SECRET=your_32_char_minimum_random_secret_here

# Application URLs (use your actual domain)
NEXTAUTH_URL=https://yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Email configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
EMAIL_FROM=noreply@yourdomain.com
APPROVAL_EMAIL=admin@yourdomain.com
```

**Generate Secure Secrets:**

```bash
# Generate AUTH_SECRET
openssl rand -base64 32

# Generate JWT_SECRET
openssl rand -base64 32

# Generate POSTGRES_PASSWORD
openssl rand -base64 24
```

### 3. Create Data Directories

```bash
mkdir -p data/public/products
mkdir -p data/public/attachments
mkdir -p data/public/profiles
mkdir -p data/public/uploads/avatars
mkdir -p data/backups
chmod -R 755 data
```

### 4. Build and Start Services

```bash
# Build Docker images
docker compose build

# Start all services in background
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### 5. Run Database Migrations

```bash
# Wait for database to be ready (may take 30-60 seconds)
sleep 10

# Run migrations
docker compose exec web npx prisma migrate deploy

# Generate Prisma Client
docker compose exec web npx prisma generate

# Verify database connection
docker compose exec web npx prisma db pull
```

### 6. Create Initial Admin User

You'll need to create an admin user. You can either:

**Option A: Via Prisma Studio (Recommended)**
```bash
docker compose exec web npx prisma studio
# Open http://localhost:5555 in your browser
# Navigate to User model and create user manually
# Hash password with: node -e "const bcrypt=require('bcryptjs');console.log(bcrypt.hashSync('your_password',10))"
```

**Option B: Via Database CLI**
```bash
docker compose exec db psql -U arbati -d arbati

# In psql:
INSERT INTO users (id, email, "passwordHash", name, status, role, "createdAt", "updatedAt")
VALUES (
  'cuid()',
  'admin@yourdomain.com',
  '$2a$10$hashed_password_here',
  'Admin User',
  'ACTIVE',
  'ADMIN',
  NOW(),
  NOW()
);
```

**Option C: Seed Script (if you have one)**
```bash
docker compose exec web npm run db:seed
```

## Nginx Reverse Proxy

### 1. Install Nginx

```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2. Configure Nginx

Create configuration file:

```bash
sudo nano /etc/nginx/sites-available/arbati
```

Add this configuration:

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # For Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS configuration
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Logging
    access_log /var/log/nginx/arbati-access.log;
    error_log /var/log/nginx/arbati-error.log;

    # Increase body size for file uploads
    client_max_body_size 50M;
    client_body_buffer_size 128k;

    # Timeouts
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;
    send_timeout 600;

    # Proxy to Docker container
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        proxy_cache_bypass $http_upgrade;
        proxy_redirect off;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/arbati /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Certificate Setup

### Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Obtain Certificate

```bash
# Make sure domain points to your server IP first!
# Run DNS check: dig yourdomain.com

# Get certificate (will automatically configure Nginx)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Choose redirect HTTP to HTTPS (option 2)
```

### Auto-Renewal

Certbot sets up auto-renewal automatically. Test it:

```bash
sudo certbot renew --dry-run
```

Manual renewal (if needed):
```bash
sudo certbot renew
sudo systemctl reload nginx
```

## Backup Configuration

### Automated Daily Backups

Create backup script:

```bash
sudo nano /usr/local/bin/arbati-backup.sh
```

Add content:

```bash
#!/bin/bash
BACKUP_DIR="/opt/arbati/data/backups"
LOG_FILE="/var/log/arbati-backup.log"
DATE=$(date +%Y-%m-%d_%H-%M-%S)

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Run backup via Docker
cd /opt/arbati
docker compose exec -T web npm run backup -- --output /app/backups/backup-${DATE}.json >> $LOG_FILE 2>&1

# Also backup database directly (alternative method)
docker compose exec -T db pg_dump -U arbati arbati | gzip > $BACKUP_DIR/db-backup-${DATE}.sql.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -name "backup-*.json" -mtime +30 -delete
find $BACKUP_DIR -name "db-backup-*.sql.gz" -mtime +30 -delete

# Compress old backups
find $BACKUP_DIR -name "backup-*.json" -mtime +7 -exec gzip {} \;

echo "$(date): Backup completed" >> $LOG_FILE
```

Make executable:

```bash
sudo chmod +x /usr/local/bin/arbati-backup.sh
```

Add to crontab:

```bash
sudo crontab -e

# Add this line for daily backup at 2 AM
0 2 * * * /usr/local/bin/arbati-backup.sh
```

### Manual Backup

```bash
# Export data as JSON
cd /opt/arbati
docker compose exec web npm run backup

# Or backup database directly
docker compose exec db pg_dump -U arbati arbati > backup-$(date +%Y-%m-%d).sql

# Backup with compression
docker compose exec db pg_dump -U arbati arbati | gzip > backup-$(date +%Y-%m-%d).sql.gz
```

### Restore from Backup

```bash
# Restore from JSON backup
cd /opt/arbati
docker compose exec web npm run restore -- /app/backups/backup-2026-01-10.json

# Or restore database SQL backup
docker compose exec -T db psql -U arbati arbati < backup-2026-01-10.sql

# Or from compressed backup
gunzip < backup-2026-01-10.sql.gz | docker compose exec -T db psql -U arbati arbati
```

## Monitoring & Maintenance

### View Application Logs

```bash
# All services
docker compose logs -f

# Web application only
docker compose logs -f web

# Database only
docker compose logs -f db

# Last 100 lines
docker compose logs --tail=100 web
```

### Check Container Status

```bash
# Container status
docker compose ps

# Resource usage
docker stats

# Container health
docker compose ps --format json | jq '.[] | {name: .Name, status: .State, health: .Health}'
```

### Update Application

```bash
cd /opt/arbati

# Pull latest code
git pull origin main

# Rebuild containers
docker compose build

# Restart services (zero-downtime with health checks)
docker compose up -d

# Run migrations if needed
docker compose exec web npx prisma migrate deploy
```

### Database Maintenance

```bash
# Access database CLI
docker compose exec db psql -U arbati -d arbati

# Vacuum database (optimize)
docker compose exec db psql -U arbati -d arbati -c "VACUUM ANALYZE;"

# Check database size
docker compose exec db psql -U arbati -d arbati -c "SELECT pg_size_pretty(pg_database_size('arbati'));"

# List all tables and sizes
docker compose exec db psql -U arbati -d arbati -c "
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

## Troubleshooting

### Application Won't Start

```bash
# Check logs
docker compose logs web

# Check if port is in use
sudo lsof -i :3000

# Check container status
docker compose ps

# Restart services
docker compose restart
```

### Database Connection Issues

```bash
# Check if database is running
docker compose ps db

# Check database logs
docker compose logs db

# Test connection
docker compose exec db pg_isready -U arbati

# Check environment variables
docker compose exec web env | grep DATABASE_URL
```

### Out of Memory

```bash
# Check memory usage
docker stats

# Increase Docker memory limit (Docker Desktop) or add swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Migration Errors

```bash
# Check migration status
docker compose exec web npx prisma migrate status

# Reset migrations (⚠️ deletes data)
docker compose exec web npx prisma migrate reset

# Deploy pending migrations
docker compose exec web npx prisma migrate deploy
```

### Permission Issues

```bash
# Fix file permissions
sudo chown -R $USER:$USER /opt/arbati/data
chmod -R 755 /opt/arbati/data
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Check Nginx configuration
sudo nginx -t
```

## Security Checklist

- [ ] Changed all default passwords
- [ ] Set strong `AUTH_SECRET` and `JWT_SECRET`
- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Enabled firewall (UFW)
- [ ] SSL certificate installed and auto-renewal working
- [ ] Nginx security headers configured
- [ ] Regular backups configured
- [ ] Only necessary ports exposed (80, 443)
- [ ] Database port (5432) NOT exposed to internet
- [ ] Application port (3000) NOT exposed to internet (only via Nginx)
- [ ] Environment variables in `.env` (not committed to git)
- [ ] Docker volumes properly secured
- [ ] Regular security updates: `sudo apt update && sudo apt upgrade`

## Performance Optimization

### Enable Nginx Caching

Add to Nginx config:

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=arbati_cache:10m max_size=100m inactive=60m use_temp_path=off;

location / {
    proxy_cache arbati_cache;
    proxy_cache_valid 200 60m;
    proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    # ... rest of proxy config
}
```

### Database Connection Pooling

Consider using PgBouncer for connection pooling in high-traffic scenarios.

### Resource Limits

Add to `docker-compose.yml`:

```yaml
services:
  web:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Support

For deployment issues, check:
1. Application logs: `docker compose logs web`
2. Database logs: `docker compose logs db`
3. Nginx logs: `/var/log/nginx/arbati-error.log`
4. System logs: `journalctl -xe`

