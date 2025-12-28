#!/bin/bash
# Script to run directly on EC2 server
# SSH into EC2, then run: bash run-on-ec2-deploy.sh

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying EHealth Med AI on EC2${NC}"
echo "=========================================="
echo ""

cd /home/ubuntu/EHealthMedAI || {
    echo -e "${RED}❌ Directory /home/ubuntu/EHealthMedAI not found${NC}"
    exit 1
}

# Step 1: Pull latest code
echo -e "${BLUE}📋 Step 1: Pulling latest code from GitHub...${NC}"

# Backup .env files
echo "💾 Backing up .env files..."
[ -f backend/.env ] && cp backend/.env backend/.env.backup || echo "No backend/.env to backup"
[ -f frontend/.env ] && cp frontend/.env frontend/.env.backup || echo "No frontend/.env to backup"
[ -f frontend/.env.local ] && cp frontend/.env.local frontend/.env.local.backup || echo "No frontend/.env.local to backup"

# Stash any local changes
echo "📦 Stashing local changes..."
git stash push -m "Backup before deploy $(date)" 2>/dev/null || true

# Fetch and pull
echo "⬇️  Fetching latest code from GitHub..."
git fetch origin

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
echo ""

# Step 2: Run migrations
echo -e "${BLUE}📋 Step 2: Running Database Migrations...${NC}"

# Load environment variables
if [ -f backend/.env ]; then
    export $(grep -v '^#' backend/.env | grep -v '^$' | xargs)
fi

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not found, trying DB_* variables..."
    if [ -n "$DB_HOST" ] && [ -n "$DB_USER" ] && [ -n "$DB_NAME" ]; then
        DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}"
        echo "✅ Constructed DATABASE_URL"
    else
        echo -e "${RED}❌ Cannot determine database connection${NC}"
        echo "Please check backend/.env file"
        exit 1
    fi
fi

echo "🔄 Running migration: calendar_integration_id to ai_agents..."

# Run migration
if [ -f backend/config/add-calendar-integration-to-agents.sql ]; then
    psql "$DATABASE_URL" -f backend/config/add-calendar-integration-to-agents.sql 2>&1 | grep -v "NOTICE:" || true
else
    echo "Running SQL directly..."
    psql "$DATABASE_URL" << 'SQL'
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS calendar_integration_id INTEGER REFERENCES integrations(id);

CREATE INDEX IF NOT EXISTS idx_ai_agents_calendar_integration ON ai_agents(calendar_integration_id);
SQL
fi

# Verify
echo "✅ Verifying migration..."
psql "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_agents' AND column_name = 'calendar_integration_id';" 2>&1 | grep -q "calendar_integration_id" && {
    echo -e "${GREEN}✅ Migration successful: calendar_integration_id column exists${NC}"
} || {
    echo -e "${YELLOW}⚠️  Column not found - may need manual check${NC}"
}

echo ""

# Step 3: Install dependencies
echo -e "${BLUE}📋 Step 3: Installing dependencies...${NC}"

echo "📦 Installing backend dependencies..."
cd backend
npm install --production

echo "📦 Installing frontend dependencies (including devDependencies for build)..."
cd ../frontend
npm install  # Install all dependencies including devDependencies for build

echo "✅ Dependencies installed"
echo ""

# Step 4: Build frontend
echo -e "${BLUE}📋 Step 4: Building frontend...${NC}"

echo "🔨 Building Next.js application..."
rm -rf .next
npm run build

echo "✅ Frontend build complete"
echo ""

# Step 5: Restart services
echo -e "${BLUE}📋 Step 5: Restarting services...${NC}"

cd /home/ubuntu/EHealthMedAI

echo "🔄 Restarting backend..."
pm2 restart ehealth-backend || pm2 start ecosystem.config.js --only ehealth-backend || {
    echo "⚠️  Starting backend manually..."
    cd backend
    pm2 start server.js --name ehealth-backend || echo "Backend may need manual start"
}

echo "🔄 Restarting frontend..."
pm2 restart ehealth-frontend || pm2 start ecosystem.config.js --only ehealth-frontend || {
    echo "⚠️  Starting frontend manually..."
    cd frontend
    pm2 start npm --name ehealth-frontend -- start || echo "Frontend may need manual start"
}

echo ""
echo "📊 Service Status:"
pm2 status || echo "PM2 not running"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""

