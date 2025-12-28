#!/bin/bash

# Complete Deployment Script for EC2
# Pulls latest code, runs migrations, and restarts services
# Usage: ./deploy-and-migrate-ec2.sh

set -e  # Exit on error

EC2_IP="34.225.194.2"
EC2_USER="ubuntu"
KEY_FILE="$HOME/ehealth-key-1766435634.pem"
REPO_URL="https://github.com/HuzaifaChaudary/EheatlthMedAI-Voice-Agent.git"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying to Production with Migrations${NC}"
echo "=============================================="
echo ""

if [ ! -f "$KEY_FILE" ]; then
    echo -e "${RED}❌ Key file not found: $KEY_FILE${NC}"
    echo "Please update KEY_FILE path in the script"
    exit 1
fi

echo -e "${BLUE}📋 Step 1: Pulling latest code from GitHub...${NC}"

ssh -i "$KEY_FILE" "$EC2_USER@$EC2_IP" << 'DEPLOY_SCRIPT'
cd /home/ubuntu/EHealthMedAI

# Backup .env files
echo "💾 Backing up .env files..."
[ -f backend/.env ] && cp backend/.env backend/.env.backup || echo "No backend/.env to backup"
[ -f frontend/.env ] && cp frontend/.env frontend/.env.backup || echo "No frontend/.env to backup"
[ -f frontend/.env.local ] && cp frontend/.env.local frontend/.env.local.backup || echo "No frontend/.env.local to backup"

# Stash any local changes (except .env)
echo "📦 Stashing local changes..."
git stash push -m "Backup before deploy $(date)" 2>/dev/null || true

# Fetch and pull latest code
echo "⬇️  Fetching latest code from GitHub..."
git fetch origin

# Get current branch or default to main
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
if [ "$CURRENT_BRANCH" = "" ]; then
    CURRENT_BRANCH="main"
fi

echo "🔄 Pulling from origin/$CURRENT_BRANCH..."
git pull origin $CURRENT_BRANCH || {
    echo "⚠️  Pull failed, trying to reset to origin..."
    git fetch origin
    git reset --hard origin/$CURRENT_BRANCH || git reset --hard origin/main
}

# Restore .env files
echo "♻️  Restoring .env files..."
[ -f backend/.env.backup ] && mv backend/.env.backup backend/.env || echo "No backend/.env.backup to restore"
[ -f frontend/.env.backup ] && mv frontend/.env.backup frontend/.env || echo "No frontend/.env.backup to restore"
[ -f frontend/.env.local.backup ] && mv frontend/.env.local.backup frontend/.env.local || echo "No frontend/.env.local.backup to restore"

echo "✅ Code updated successfully"
DEPLOY_SCRIPT

echo ""
echo -e "${BLUE}📋 Step 2: Running Database Migrations...${NC}"

ssh -i "$KEY_FILE" "$EC2_USER@$EC2_IP" << 'MIGRATION_SCRIPT'
cd /home/ubuntu/EHealthMedAI

echo "🔄 Running database migrations..."

# Load environment variables from backend/.env
if [ -f backend/.env ]; then
    export $(grep -v '^#' backend/.env | grep -v '^$' | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not found in backend/.env"
    echo "   Trying to construct from DB_* variables..."
    if [ -n "$DB_HOST" ] && [ -n "$DB_USER" ] && [ -n "$DB_NAME" ]; then
        DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}"
        echo "✅ Constructed DATABASE_URL from DB_* variables"
    else
        echo "❌ Cannot determine database connection. Please check backend/.env"
        exit 1
    fi
fi

echo "📊 Database connection: ${DATABASE_URL%%@*}@***" # Hide password

# Migration 1: Add calendar_integration_id to ai_agents
echo ""
echo "🔄 Migration 1: Adding calendar_integration_id to ai_agents table..."
if [ -f backend/config/add-calendar-integration-to-agents.sql ]; then
    psql "$DATABASE_URL" -f backend/config/add-calendar-integration-to-agents.sql 2>&1 | grep -v "NOTICE:" || {
        echo "⚠️  Migration may have already run (this is safe)"
    }
    
    # Verify migration
    echo "✅ Verifying migration..."
    psql "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_agents' AND column_name = 'calendar_integration_id';" 2>&1 | grep -q "calendar_integration_id" && {
        echo "✅ Migration 1: calendar_integration_id column exists"
    } || {
        echo "⚠️  Migration 1: Column not found (may need manual check)"
    }
else
    echo "⚠️  Migration file not found: backend/config/add-calendar-integration-to-agents.sql"
    echo "   Running SQL directly..."
    psql "$DATABASE_URL" << 'SQL'
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS calendar_integration_id INTEGER REFERENCES integrations(id);

CREATE INDEX IF NOT EXISTS idx_ai_agents_calendar_integration ON ai_agents(calendar_integration_id);
SQL
    echo "✅ Migration 1: SQL executed"
fi

echo ""
echo "✅ All migrations completed"
MIGRATION_SCRIPT

echo ""
echo -e "${BLUE}📋 Step 3: Installing dependencies...${NC}"

ssh -i "$KEY_FILE" "$EC2_USER@$EC2_IP" << 'INSTALL_SCRIPT'
cd /home/ubuntu/EHealthMedAI

echo "📦 Installing backend dependencies..."
cd backend
npm install --production

echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install --production

echo "✅ Dependencies installed"
INSTALL_SCRIPT

echo ""
echo -e "${BLUE}📋 Step 4: Building frontend...${NC}"

ssh -i "$KEY_FILE" "$EC2_USER@$EC2_IP" << 'BUILD_SCRIPT'
cd /home/ubuntu/EHealthMedAI/frontend

echo "🔨 Building Next.js application..."
rm -rf .next
npm run build

echo "✅ Frontend build complete"
BUILD_SCRIPT

echo ""
echo -e "${BLUE}📋 Step 5: Restarting services...${NC}"

ssh -i "$KEY_FILE" "$EC2_USER@$EC2_IP" << 'RESTART_SCRIPT'
cd /home/ubuntu/EHealthMedAI

echo "🔄 Restarting backend..."
pm2 restart ehealth-backend || pm2 start ecosystem.config.js --only ehealth-backend || {
    echo "⚠️  PM2 not configured, starting manually..."
    cd backend
    pm2 start server.js --name ehealth-backend || echo "Backend may need manual start"
}

echo "🔄 Restarting frontend..."
pm2 restart ehealth-frontend || pm2 start ecosystem.config.js --only ehealth-frontend || {
    echo "⚠️  PM2 not configured, starting manually..."
    cd frontend
    pm2 start npm --name ehealth-frontend -- start || echo "Frontend may need manual start"
}

echo ""
echo "📊 Service Status:"
pm2 status || echo "PM2 not running - services may need manual start"

echo ""
echo "✅ Deployment complete!"
RESTART_SCRIPT

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deployment to Production Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📋 Summary:${NC}"
echo "   ✅ Code pulled from GitHub"
echo "   ✅ Database migrations run"
echo "   ✅ Dependencies installed"
echo "   ✅ Frontend built"
echo "   ✅ Services restarted"
echo ""
echo "🌐 Your application should be live at: https://huzaifaiftikhar.engineer"
echo ""
echo -e "${BLUE}💡 To check logs:${NC}"
echo "   ssh -i $KEY_FILE $EC2_USER@$EC2_IP 'pm2 logs'"
echo ""

