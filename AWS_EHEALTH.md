# AWS EC2 Deployment Guide for EHealth Med AI

This guide walks you through deploying the EHealth Med AI platform on a **single EC2 instance** with:
- **PostgreSQL** installed locally on EC2
- **Backend** (Node.js/Express) running on port 5000
- **Frontend** (Next.js) running on port 3000
- **Nginx** as reverse proxy

---

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed and configured (optional)
- SSH key pair for EC2 instance
- Domain name (optional, for custom domains)
- GitHub access to your repository

---

## Step 1: Create EC2 Instance

### 1.1 Launch EC2 Instance

1. Go to **AWS Console → EC2 → Instances**
2. Click **Launch instance**
3. **Name**: `ehealth-med-ai`
4. **AMI**: Amazon Linux 2023 (or Ubuntu 22.04 LTS)
5. **Instance type**: `t3.medium` (recommended) or `t3.small` (minimum)
   - **Note**: You need enough resources for PostgreSQL + Backend + Frontend
6. **Key pair**: Select or create new SSH key pair
7. **Network settings**:
   - VPC: Default or create new
   - Subnet: Public subnet (for internet access)
   - Auto-assign public IP: Enable
   - Security group: Create new `ehealth-sg`
8. **Security group rules**:
   - **SSH (22)**: My IP (or your specific IP for security)
   - **HTTP (80)**: Anywhere-IPv4 (0.0.0.0/0)
   - **HTTPS (443)**: Anywhere-IPv4 (0.0.0.0/0)
   - **Custom TCP (5000)**: Anywhere-IPv4 (0.0.0.0/0) - for backend API
   - **Custom TCP (3000)**: Anywhere-IPv4 (0.0.0.0/0) - for frontend (optional, Nginx will handle it)
9. **Storage**: 30 GB gp3 (minimum, 50 GB recommended)
10. Click **Launch instance**

### 1.2 Get Instance Details

1. Wait for instance to be **Running**
2. Note the **Public IPv4 address** (e.g., `54.123.45.67`)
3. Note the **Private IPv4 address** (for internal connections)

---

## Step 2: Connect to EC2 Instance

```bash
# For Amazon Linux 2023
ssh -i your-key.pem ec2-user@YOUR_EC2_IP

# For Ubuntu 22.04
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```

---

## Step 3: Install System Dependencies

### 3.1 For Amazon Linux 2023

```bash
# Update system
sudo yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PostgreSQL 15
sudo yum install -y postgresql15 postgresql15-server

# Install Git
sudo yum install -y git

# Install Nginx
sudo yum install -y nginx

# Install PM2 for process management
sudo npm install -g pm2

# Install build tools (needed for some npm packages)
sudo yum groupinstall -y "Development Tools"

# Verify installations
node --version
npm --version
psql --version
```

### 3.2 For Ubuntu 22.04

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Install Git
sudo apt install -y git

# Install Nginx
sudo apt install -y nginx

# Install PM2
sudo npm install -g pm2

# Install build tools
sudo apt install -y build-essential

# Verify installations
node --version
npm --version
psql --version
```

---

## Step 4: Set Up PostgreSQL

### 4.1 Initialize and Start PostgreSQL

**For Amazon Linux 2023:**
```bash
# Initialize PostgreSQL data directory
sudo /usr/pgsql-15/bin/postgresql-15-setup initdb

# Start PostgreSQL service
sudo systemctl start postgresql-15
sudo systemctl enable postgresql-15
```

**For Ubuntu 22.04:**
```bash
# PostgreSQL is already initialized, just start it
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 4.2 Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# Inside PostgreSQL prompt, run:
CREATE DATABASE ehealthmedai;
CREATE USER ehealthmedai WITH PASSWORD 'your_strong_password_here';
ALTER USER ehealthmedai CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE ehealthmedai TO ehealthmedai;
\q
```

**Important**: Replace `your_strong_password_here` with a strong password. Save it securely!

### 4.3 Configure PostgreSQL for Remote Access (Optional)

If you need to access PostgreSQL from outside (not recommended for production):

```bash
# Edit PostgreSQL config
sudo nano /var/lib/pgsql/15/data/postgresql.conf  # Amazon Linux
# OR
sudo nano /etc/postgresql/15/main/postgresql.conf  # Ubuntu

# Find and uncomment:
listen_addresses = 'localhost'

# Edit pg_hba.conf
sudo nano /var/lib/pgsql/15/data/pg_hba.conf  # Amazon Linux
# OR
sudo nano /etc/postgresql/15/main/pg_hba.conf  # Ubuntu

# Add at the end:
host    ehealthmedai    ehealthmedai    127.0.0.1/32    md5

# Restart PostgreSQL
sudo systemctl restart postgresql-15  # Amazon Linux
# OR
sudo systemctl restart postgresql  # Ubuntu
```

---

## Step 5: Clone and Set Up Repository

### 5.1 Clone Repository

```bash
# Navigate to home directory
cd ~

# Clone your repository (replace with your actual repo URL)
git clone https://github.com/YOUR_USERNAME/EHealthMedAI.git
cd EHealthMedAI

# Verify structure
ls -la
# Should see: backend/ and frontend/ folders
```

### 5.2 Set Up Backend

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install --production

# Create .env file
nano .env
```

Add the following to `.env`:

```env
# Database - Local PostgreSQL
DATABASE_URL=postgresql://ehealthmedai:your_strong_password_here@localhost:5432/ehealthmedai
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ehealthmedai
DB_USER=ehealthmedai
DB_PASSWORD=your_strong_password_here

# Server
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
API_URL=https://your-domain.com/api
CORS_ORIGIN=https://your-domain.com

# JWT
JWT_SECRET=your-super-secret-jwt-key-generate-with-openssl-rand-base64-32
JWT_EXPIRES_IN=7d

# AI Services
OPENAI_API_KEY=your-openai-api-key
OPENAI_ORGANIZATION_ID=your-openai-org-id
ELEVENLABS_API_KEY=your-elevenlabs-api-key
ELEVENLABS_VOICE_ID=your-elevenlabs-voice-id

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback

# Twilio (if using telephony)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token

# Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM_EMAIL=noreply@your-domain.com

# Other
MOCK_AI_RESPONSES=false
ENABLE_SCHEDULER=true
```

**Important**: 
- Replace `your_strong_password_here` with the password you set in Step 4.2
- Replace `your-domain.com` with your actual domain or EC2 public IP
- Generate JWT_SECRET: `openssl rand -base64 32`

### 5.3 Test Database Connection

```bash
# Test connection
npm run check-db

# Should show:
# ✅ Database "ehealthmedai" EXISTS!
# ✅ Connection to database successful!
```

### 5.4 Run Database Migrations

```bash
# The server will auto-run migrations on startup, but you can test first:
npm start

# Watch for:
# ✅ Database initialization completed!
# ✅ Database tables: users, organizations, ai_agents, ...

# Press Ctrl+C to stop
```

### 5.5 Create Admin User

```bash
# Create admin user
node scripts/create-admin.js

# Follow prompts to create admin account
```

### 5.6 Set Up Frontend

```bash
# Navigate to frontend
cd ../frontend

# Install dependencies
npm install

# Create .env.local file
nano .env.local
```

Add:

```env
NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

**Important**: Replace `your-domain.com` with your actual domain or EC2 public IP.

### 5.7 Build Frontend

```bash
# Build for production
npm run build

# Test the build (optional)
npm start
# Press Ctrl+C after testing
```

---

## Step 6: Set Up PM2 for Process Management

### 6.1 Create PM2 Ecosystem File

```bash
# Go back to project root
cd ~/EHealthMedAI

# Create PM2 config
nano ecosystem.config.js
```

Add:

```javascript
module.exports = {
  apps: [
    {
      name: 'ehealth-backend',
      cwd: './backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'ehealth-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
```

### 6.2 Create Logs Directory

```bash
mkdir -p ~/EHealthMedAI/logs
```

### 6.3 Start Applications with PM2

```bash
# Start both applications
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command shown (it will be something like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user)
```

---

## Step 7: Set Up Nginx Reverse Proxy

### 7.1 Create Nginx Configuration

```bash
# Create Nginx config
sudo nano /etc/nginx/conf.d/ehealth.conf
```

Add:

```nginx
# Backend API
server {
    listen 80;
    server_name your-domain.com api.your-domain.com;

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }
}

# Frontend
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files caching
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }
}
```

**Important**: Replace `your-domain.com` with your actual domain or remove `server_name` lines to use IP address.

### 7.2 Test and Start Nginx

```bash
# Test Nginx configuration
sudo nginx -t

# If test passes, start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx

# Reload if already running
sudo systemctl reload nginx
```

---

## Step 8: Set Up SSL with Let's Encrypt (Recommended)

### 8.1 Install Certbot

**For Amazon Linux 2023:**
```bash
sudo yum install -y certbot python3-certbot-nginx
```

**For Ubuntu 22.04:**
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 8.2 Get SSL Certificate

```bash
# If you have a domain name
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow the prompts:
# - Enter your email
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)

# Certbot will automatically:
# - Get SSL certificate
# - Configure Nginx
# - Set up auto-renewal
```

### 8.3 Update Environment Variables for HTTPS

After SSL is set up, update your `.env` files:

```bash
# Backend .env
cd ~/EHealthMedAI/backend
nano .env

# Update:
FRONTEND_URL=https://your-domain.com
API_URL=https://your-domain.com/api
CORS_ORIGIN=https://your-domain.com
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback

# Frontend .env.local
cd ../frontend
nano .env.local

# Update:
NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

Restart applications:
```bash
pm2 restart all
```

---

## Step 9: Verify Deployment

### 9.1 Test Backend API

```bash
# Test health endpoint
curl http://your-domain.com/api/health
# OR if using IP:
curl http://YOUR_EC2_IP/api/health

# Should return:
# {"status":"ok","message":"EHealth Med AI API is running",...}
```

### 9.2 Test Frontend

1. Open browser: `http://your-domain.com` or `http://YOUR_EC2_IP`
2. Should see the login page
3. Try logging in with admin credentials created in Step 5.5

### 9.3 Check Application Status

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs

# Check PostgreSQL
sudo systemctl status postgresql-15  # Amazon Linux
# OR
sudo systemctl status postgresql  # Ubuntu

# Check Nginx
sudo systemctl status nginx
```

---

## Step 10: Post-Deployment Configuration

### 10.1 Set Up Automatic Backups

```bash
# Create backup script
nano ~/backup-database.sh
```

Add:

```bash
#!/bin/bash
BACKUP_DIR=~/backups
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U ehealthmedai -h localhost ehealthmedai > $BACKUP_DIR/ehealthmedai_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "ehealthmedai_*.sql" -mtime +7 -delete

echo "Backup completed: ehealthmedai_$DATE.sql"
```

```bash
# Make executable
chmod +x ~/backup-database.sh

# Add to crontab (daily at 2 AM)
crontab -e

# Add line:
0 2 * * * /home/ec2-user/backup-database.sh >> /home/ec2-user/backup.log 2>&1
```

### 10.2 Set Up Log Rotation

```bash
# PM2 already handles log rotation, but you can configure it:
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 10.3 Monitor Resources

```bash
# Check disk space
df -h

# Check memory
free -h

# Check CPU
top

# Check PostgreSQL connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
```

---

## Security Best Practices

### 1. Firewall Configuration

```bash
# Only allow necessary ports (already done via Security Group)
# Consider restricting SSH to your IP only
```

### 2. Keep System Updated

```bash
# Amazon Linux
sudo yum update -y

# Ubuntu
sudo apt update && sudo apt upgrade -y
```

### 3. Secure PostgreSQL

- Use strong passwords
- Don't expose PostgreSQL port (5432) to internet
- Regularly update PostgreSQL

### 4. Environment Variables Security

- Never commit `.env` files to Git
- Use strong JWT secrets
- Rotate API keys regularly

### 5. Enable AWS CloudWatch Monitoring

- Monitor EC2 instance metrics
- Set up alarms for high CPU/memory
- Monitor disk space

---

## Troubleshooting

### Backend Not Starting

```bash
# Check logs
pm2 logs ehealth-backend

# Check if port 5000 is in use
sudo netstat -tulpn | grep 5000

# Restart backend
pm2 restart ehealth-backend
```

### Frontend Not Starting

```bash
# Check logs
pm2 logs ehealth-frontend

# Check if port 3000 is in use
sudo netstat -tulpn | grep 3000

# Rebuild if needed
cd ~/EHealthMedAI/frontend
npm run build
pm2 restart ehealth-frontend
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql-15  # Amazon Linux
# OR
sudo systemctl status postgresql  # Ubuntu

# Test connection
psql -U ehealthmedai -h localhost -d ehealthmedai

# Check PostgreSQL logs
sudo tail -f /var/lib/pgsql/15/data/log/postgresql-*.log  # Amazon Linux
# OR
sudo tail -f /var/log/postgresql/postgresql-15-main.log  # Ubuntu
```

### Nginx 502 Bad Gateway

```bash
# Check if applications are running
pm2 status

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Test Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Port Already in Use

```bash
# Find process using port
sudo lsof -i :5000  # Backend
sudo lsof -i :3000  # Frontend

# Kill process if needed
sudo kill -9 PID
```

### Out of Memory

```bash
# Check memory usage
free -h

# If low on memory:
# 1. Increase EC2 instance size
# 2. Add swap space
# 3. Optimize PostgreSQL settings
```

---

## Updating the Application

### Update Code

```bash
# Navigate to project
cd ~/EHealthMedAI

# Pull latest changes
git pull origin main

# Update backend
cd backend
npm install --production
pm2 restart ehealth-backend

# Update frontend
cd ../frontend
npm install
npm run build
pm2 restart ehealth-frontend
```

### Update Database Schema

```bash
# The server auto-runs migrations on startup
# Or manually:
cd ~/EHealthMedAI/backend
npm run migrate
```

---

## Cost Optimization

1. **Use t3.small** for development/testing (can upgrade later)
2. **Stop instance** when not in use (for dev environments)
3. **Use Reserved Instances** if running 24/7 (save up to 72%)
4. **Monitor usage** with AWS Cost Explorer
5. **Set up billing alerts** in AWS Console

---

## Scaling Options

If you need more resources:

1. **Vertical Scaling**: Upgrade EC2 instance type (t3.small → t3.medium → t3.large)
2. **Separate Services**: Move to separate EC2 instances for frontend/backend
3. **Use RDS**: Migrate PostgreSQL to AWS RDS for managed database
4. **Load Balancer**: Add Application Load Balancer for high availability
5. **Auto Scaling**: Set up Auto Scaling Groups for multiple instances

---

## Quick Reference Commands

```bash
# PM2 Commands
pm2 status                    # Check status
pm2 logs                      # View all logs
pm2 logs ehealth-backend      # View backend logs
pm2 logs ehealth-frontend     # View frontend logs
pm2 restart all               # Restart all apps
pm2 restart ehealth-backend   # Restart backend only
pm2 stop all                  # Stop all apps
pm2 delete all                # Delete all apps

# PostgreSQL Commands
sudo systemctl status postgresql-15    # Check status (Amazon Linux)
sudo systemctl restart postgresql-15   # Restart (Amazon Linux)
sudo -u postgres psql                  # Connect as postgres user
psql -U ehealthmedai -d ehealthmedai   # Connect as app user

# Nginx Commands
sudo systemctl status nginx   # Check status
sudo systemctl restart nginx  # Restart
sudo nginx -t                 # Test config
sudo tail -f /var/log/nginx/error.log  # View error logs

# System Commands
df -h                         # Check disk space
free -h                       # Check memory
top                           # Monitor resources
```

---

## Support

For issues:
- Check application logs: `pm2 logs`
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Check PostgreSQL logs: `sudo tail -f /var/lib/pgsql/15/data/log/postgresql-*.log`
- Check system resources: `htop` or `top`
- Review security group rules in AWS Console

---

## Next Steps

1. ✅ Set up **CloudWatch monitoring** for EC2
2. ✅ Configure **AWS Backup** for automated backups
3. ✅ Set up **Route 53** for DNS management
4. ✅ Configure **AWS WAF** for additional security
5. ✅ Set up **SNS alerts** for critical issues

---

**Deployment Complete! 🎉**

Your EHealth Med AI platform is now running on AWS EC2 with:
- ✅ PostgreSQL database
- ✅ Backend API (port 5000)
- ✅ Frontend application (port 3000)
- ✅ Nginx reverse proxy
- ✅ SSL certificates (if configured)
- ✅ PM2 process management
- ✅ Auto-start on boot

