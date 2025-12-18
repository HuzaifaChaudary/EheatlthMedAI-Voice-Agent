# AWS Deployment Guide for EHealth Med AI

This guide walks you through deploying the EHealth Med AI platform on AWS using:
- **AWS RDS** for PostgreSQL database
- **EC2** for backend server
- **EC2** for frontend server

## Deployment Order

**Deploy in this order:**
1. ✅ **AWS RDS (PostgreSQL)** - Set up database first
2. ✅ **Backend EC2** - Deploy backend and connect to RDS
3. ✅ **Frontend EC2** - Deploy frontend and connect to backend

---

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed and configured
- SSH key pair for EC2 instances
- Domain name (optional, for custom domains)
- GitHub access to both repositories

---

## Step 1: Set Up AWS RDS (PostgreSQL)

### 1.1 Create RDS Subnet Group

1. Go to **AWS Console → RDS → Subnet Groups**
2. Click **Create DB subnet group**
3. Configure:
   - **Name**: `ehealth-rds-subnet-group`
   - **Description**: Subnet group for EHealth Med AI RDS
   - **VPC**: Select your VPC (or create new)
   - **Availability Zones**: Select at least 2 zones
   - **Subnets**: Select subnets in different AZs
4. Click **Create**

### 1.2 Create Security Group for Backend EC2 (Do This First!)

**Important**: Create the backend security group FIRST, even before creating the EC2 instance, so we can reference it in the RDS security group.

1. Go to **AWS Console → EC2 → Security Groups**
2. Click **Create security group**
3. Configure:
   - **Name**: `ehealth-backend-sg`
   - **Description**: Security group for backend EC2 instance
   - **VPC**: Same as subnet group
4. **Inbound Rules**:
   - SSH (22): My IP (or your specific IP)
   - HTTP (80): Anywhere-IPv4 (0.0.0.0/0)
   - HTTPS (443): Anywhere-IPv4 (0.0.0.0/0)
   - Custom TCP (5000): Anywhere-IPv4 (0.0.0.0/0) - for API access
5. **Outbound Rules**:
   - All traffic: Anywhere-IPv4 (default)
6. Click **Create security group**
7. **Copy the Security Group ID** (e.g., `sg-xxxxxxxxxxxxx`) - you'll need it in the next step

### 1.3 Create Security Group for RDS

1. Go to **AWS Console → EC2 → Security Groups**
2. Click **Create security group**
3. Configure:
   - **Name**: `ehealth-rds-sg`
   - **Description**: Security group for RDS database
   - **VPC**: Same as subnet group
4. **Inbound Rules**:
   - Type: PostgreSQL
   - Port: 5432
   - Source: Select `ehealth-backend-sg` (the security group you just created)
5. **Outbound Rules**:
   - All traffic: Anywhere-IPv4 (default)
6. Click **Create security group**

### 1.4 Create RDS PostgreSQL Instance

1. Go to **AWS Console → RDS → Databases**
2. Click **Create database**
3. **Engine options**:
   - Engine: PostgreSQL
   - Version: 14.x or higher (recommended: 14.9+)
   - Template: Production (or Dev/Test for cost savings)
4. **Settings**:
   - DB instance identifier: `ehealth-med-ai-db`
   - Master username: `ehealth_admin` (or your choice)
   - Master password: **Generate strong password** (save it securely!)
5. **Instance configuration**:
   - DB instance class: `db.t3.micro` (free tier) or `db.t3.small` (recommended for production)
6. **Storage**:
   - Storage type: General Purpose SSD (gp3)
   - Allocated storage: 20 GB (minimum)
   - Enable storage autoscaling: Yes
7. **Connectivity**:
   - VPC: Same as subnet group
   - Subnet group: `ehealth-rds-subnet-group`
   - Public access: **No** (for security)
   - VPC security group: `ehealth-rds-sg`
   - Availability Zone: No preference
8. **Database authentication**: Password authentication
9. **Additional configuration**:
   - Initial database name: `ehealth_med_ai`
   - Backup retention: 7 days (or as needed)
   - Enable encryption: Yes (recommended)
10. Click **Create database**

### 1.5 Get RDS Endpoint

1. Wait for database to be **Available** (5-10 minutes)
2. Click on the database instance
3. Copy the **Endpoint** (e.g., `ehealth-med-ai-db.xxxxx.us-east-1.rds.amazonaws.com`)
4. Note the **Port** (default: 5432)

---

## Step 2: Deploy Backend on EC2

### 2.1 Create EC2 Instance for Backend

1. Go to **AWS Console → EC2 → Instances**
2. Click **Launch instance**
3. **Name**: `ehealth-backend`
4. **AMI**: Amazon Linux 2023 (or Ubuntu 22.04 LTS)
5. **Instance type**: `t3.small` (or `t3.micro` for testing)
6. **Key pair**: Select or create new SSH key pair
7. **Network settings**:
   - VPC: Same as RDS
   - Subnet: Public subnet (for internet access)
   - Auto-assign public IP: Enable
   - Security group: **Select existing** `ehealth-backend-sg` (the one you created in step 1.2)
8. **Storage**: 20 GB gp3
9. Click **Launch instance**

**Note**: The security group is already configured correctly from step 1.2, so no need to update it!

### 2.2 Connect to Backend EC2

```bash
# Replace with your key and instance IP
ssh -i your-key.pem ec2-user@YOUR_BACKEND_IP
# Or for Ubuntu:
ssh -i your-key.pem ubuntu@YOUR_BACKEND_IP
```

### 2.3 Install Dependencies on Backend EC2

**For Amazon Linux 2023:**
```bash
# Update system
sudo yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PostgreSQL client (for testing)
sudo yum install -y postgresql15

# Install Git
sudo yum install -y git

# Install PM2 for process management
sudo npm install -g pm2

# Verify installations
node --version
npm --version
```

**For Ubuntu 22.04:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL client
sudo apt install -y postgresql-client

# Install Git
sudo apt install -y git

# Install PM2
sudo npm install -g pm2

# Verify installations
node --version
npm --version
```

### 2.4 Clone and Set Up Backend

```bash
# Clone repository
cd ~
git clone https://github.com/Fida-Kainth/EHealthMedAI_Backend.git
cd EHealthMedAI_Backend

# Install dependencies
npm install --production
```

### 2.5 Configure Backend Environment Variables

```bash
# Create .env file
nano .env
```

Add the following (replace with your actual values):

```env
# Database - Use RDS endpoint
DATABASE_URL=postgresql://ehealth_admin:YOUR_PASSWORD@ehealth-med-ai-db.xxxxx.us-east-1.rds.amazonaws.com:5432/ehealth_med_ai
DB_HOST=ehealth-med-ai-db.xxxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=ehealth_med_ai
DB_USER=ehealth_admin
DB_PASSWORD=YOUR_PASSWORD

# Server
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
API_URL=https://your-backend-domain.com/api
CORS_ORIGIN=https://your-frontend-domain.com

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-use-strong-random-string
JWT_EXPIRES_IN=7d

# AI Services
OPENAI_API_KEY=your-openai-api-key
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-backend-domain.com/api/auth/google/callback

# Mock AI Responses (set to false in production)
MOCK_AI_RESPONSES=false
```

**Important**: 
- Replace `YOUR_PASSWORD` with your RDS master password
- Replace `xxxxx.us-east-1.rds.amazonaws.com` with your actual RDS endpoint
- Use strong, random `JWT_SECRET` (generate with: `openssl rand -base64 32`)
- Update `FRONTEND_URL` and `API_URL` with your actual domains

### 2.6 Test Database Connection

```bash
# Test connection (replace with your RDS endpoint)
psql -h ehealth-med-ai-db.xxxxx.us-east-1.rds.amazonaws.com -U ehealth_admin -d ehealth_med_ai

# If connection works, exit
\q
```

### 2.7 Run Database Migrations

```bash
# Run migrations
npm run migrate

# Or manually run the migration script
node scripts/migrate.js
```

### 2.8 Create Admin User

```bash
node scripts/create-admin.js
```

### 2.9 Start Backend with PM2

```bash
# Start application with PM2
pm2 start server.js --name ehealth-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown

# Check status
pm2 status
pm2 logs ehealth-backend
```

### 2.10 Set Up Nginx (Reverse Proxy)

```bash
# Install Nginx
# For Amazon Linux:
sudo yum install -y nginx

# For Ubuntu:
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

Create Nginx configuration:

```bash
sudo nano /etc/nginx/conf.d/ehealth-backend.conf
```

Add:

```nginx
server {
    listen 80;
    server_name your-backend-domain.com;  # Replace with your domain or use IP

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Test and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 2.11 Set Up SSL with Let's Encrypt (Optional but Recommended)

```bash
# Install Certbot
# For Amazon Linux:
sudo yum install -y certbot python3-certbot-nginx

# For Ubuntu:
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d your-backend-domain.com

# Auto-renewal is set up automatically
```

---

## Step 3: Deploy Frontend on EC2

### 3.1 Create EC2 Instance for Frontend

1. Go to **AWS Console → EC2 → Instances**
2. Click **Launch instance**
3. **Name**: `ehealth-frontend`
4. **AMI**: Amazon Linux 2023 (or Ubuntu 22.04 LTS)
5. **Instance type**: `t3.small` (or `t3.micro` for testing)
6. **Key pair**: Same as backend
7. **Network settings**:
   - VPC: Same as backend
   - Subnet: Public subnet
   - Auto-assign public IP: Enable
   - Security group: Create new `ehealth-frontend-sg`
8. **Security group rules**:
   - SSH (22): Your IP only
   - HTTP (80): 0.0.0.0/0
   - HTTPS (443): 0.0.0.0/0
9. **Storage**: 20 GB gp3
10. Click **Launch instance**

### 3.2 Connect to Frontend EC2

```bash
ssh -i your-key.pem ec2-user@YOUR_FRONTEND_IP
# Or for Ubuntu:
ssh -i your-key.pem ubuntu@YOUR_FRONTEND_IP
```

### 3.3 Install Dependencies on Frontend EC2

**For Amazon Linux 2023:**
```bash
sudo yum update -y
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs git
sudo npm install -g pm2
```

**For Ubuntu 22.04:**
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm install -g pm2
```

### 3.4 Clone and Build Frontend

```bash
# Clone repository
cd ~
git clone https://github.com/Fida-Kainth/EHealthMedAI_Frontend.git
cd EHealthMedAI_Frontend

# Install dependencies
npm install

# Create .env.local file
nano .env.local
```

Add:

```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api
```

**Important**: Replace `your-backend-domain.com` with your actual backend domain or IP.

### 3.5 Build Frontend

```bash
# Build for production
npm run build

# Test the build
npm start
```

### 3.6 Set Up Nginx for Frontend

```bash
# Install Nginx
# For Amazon Linux:
sudo yum install -y nginx

# For Ubuntu:
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

Create Nginx configuration:

```bash
sudo nano /etc/nginx/conf.d/ehealth-frontend.conf
```

Add:

```nginx
server {
    listen 80;
    server_name your-frontend-domain.com;  # Replace with your domain

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
}
```

Test and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 3.7 Start Frontend with PM2

```bash
# Start Next.js with PM2
pm2 start npm --name ehealth-frontend -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown

# Check status
pm2 status
pm2 logs ehealth-frontend
```

### 3.8 Set Up SSL for Frontend

```bash
# Install Certbot
# For Amazon Linux:
sudo yum install -y certbot python3-certbot-nginx

# For Ubuntu:
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-frontend-domain.com
```

---

## Step 4: Update Backend CORS Configuration

After deploying frontend, update backend `.env`:

```bash
# On backend EC2
nano .env
```

Update:
```env
FRONTEND_URL=https://your-frontend-domain.com
CORS_ORIGIN=https://your-frontend-domain.com
```

Restart backend:
```bash
pm2 restart ehealth-backend
```

**Note**: The RDS security group is already correctly configured to allow connections from the backend security group, so no need to update it!

---

## Step 5: Verify Deployment

### 5.1 Test Backend

```bash
# Test health endpoint
curl https://your-backend-domain.com/api/health

# Should return:
# {"status":"ok","message":"EHealth Med AI API is running",...}
```

### 5.2 Test Frontend

1. Open browser: `https://your-frontend-domain.com`
2. Should see the login page
3. Try logging in with admin credentials

### 5.3 Test Database Connection

```bash
# On backend EC2
pm2 logs ehealth-backend

# Look for:
# ✅ Database connected successfully
```

---

## Security Best Practices

### 1. Update Security Groups

- **RDS**: Only allow connections from backend security group ✅ (Already configured correctly)
- **Backend**: Restrict port 5000 to frontend IP or use Nginx only
- **Frontend**: Only allow HTTP/HTTPS from internet

### 2. Use AWS Secrets Manager (Recommended)

Instead of storing secrets in `.env`, use AWS Secrets Manager:

```bash
# Install AWS CLI if not installed
# Then use AWS Secrets Manager to store:
# - Database passwords
# - JWT secrets
# - API keys
```

### 3. Enable RDS Automated Backups

- Already configured in Step 1.4
- Verify backup retention period

### 4. Set Up CloudWatch Monitoring

- Monitor EC2 instances
- Monitor RDS performance
- Set up alarms for high CPU/memory

### 5. Use AWS WAF (Optional)

- Protect against common web exploits
- Set up rate limiting

---

## Troubleshooting

### Backend can't connect to RDS

1. Check security group rules - verify RDS security group allows `ehealth-backend-sg`
2. Verify RDS endpoint is correct
3. Test connection: `psql -h RDS_ENDPOINT -U USER -d DATABASE`

### Frontend can't connect to Backend

1. Check CORS configuration in backend
2. Verify `NEXT_PUBLIC_API_URL` in frontend `.env.local`
3. Check backend logs: `pm2 logs ehealth-backend`

### PM2 not starting on boot

```bash
# Re-run startup script
pm2 startup
# Follow the command shown
pm2 save
```

### Nginx 502 Bad Gateway

1. Check if backend/frontend is running: `pm2 status`
2. Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify proxy_pass URL is correct

---

## Cost Optimization

1. **Use Reserved Instances** for EC2 (if running 24/7)
2. **Use t3.micro** for development/testing
3. **Stop instances** when not in use (for dev environments)
4. **Use RDS Dev/Test template** for non-production
5. **Enable RDS automated backups** only if needed

---

## Next Steps

1. Set up **CloudWatch alarms** for monitoring
2. Configure **AWS Backup** for additional backups
3. Set up **Route 53** for DNS management
4. Configure **AWS Certificate Manager** for SSL (alternative to Let's Encrypt)
5. Set up **Auto Scaling Groups** for high availability
6. Configure **Application Load Balancer** for better performance

---

## Support

For issues or questions:
- Check application logs: `pm2 logs`
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Review AWS CloudWatch logs
- Check security group rules in AWS Console
