#!/bin/bash

# Git-based deployment script for EHealth Med AI
# This script pulls latest code from GitHub and restarts services
# Usage: ./deploy-to-production.sh

set -e  # Exit on error

EC2_IP="34.225.194.2"
EC2_USER="ubuntu"
KEY_FILE="$HOME/ehealth-key-1766435634.pem"
REPO_URL="https://github.com/HuzaifaChaudary/EheatlthMedAI-Voice-Agent.git"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying to Production via Git${NC}"
echo "=========================================="
echo ""

if [ ! -f "$KEY_FILE" ]; then
    echo -e "${RED}❌ Key file not found: $KEY_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Step 1: Ensuring Git is set up on production...${NC}"

# Check if git repo exists, if not initialize it
ssh -i "$KEY_FILE" "$EC2_USER@$EC2_IP" << EOF
cd /home/ubuntu/EHealthMedAI

# Check if .git exists
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    git remote add origin $REPO_URL || git remote set-url origin $REPO_URL
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already exists"
    git remote set-url origin $REPO_URL
fi

# Check current branch
CURRENT_BRANCH=\$(git branch --show-current 2>/dev/null || echo "main")
echo "📍 Current branch: \$CURRENT_BRANCH"
EOF

echo ""
echo -e "${YELLOW}📋 Step 2: Pulling latest code from GitHub...${NC}"

# Pull latest code (preserving .env files)
ssh -i "$KEY_FILE" "$EC2_USER@$EC2_IP" << 'DEPLOY_SCRIPT'
cd /home/ubuntu/EHealthMedAI

# Backup .env files
echo "💾 Backing up .env files..."
[ -f backend/.env ] && cp backend/.env backend/.env.backup
[ -f frontend/.env ] && cp frontend/.env frontend/.env.backup
[ -f frontend/.env.local ] && cp frontend/.env.local frontend/.env.local.backup

# Stash any local changes (except .env)
echo "📦 Stashing local changes..."
git stash push -m "Backup before deploy $(date)" -- backend/.env frontend/.env frontend/.env.local 2>/dev/null || true

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
[ -f backend/.env.backup ] && mv backend/.env.backup backend/.env
[ -f frontend/.env.backup ] && mv frontend/.env.backup frontend/.env
[ -f frontend/.env.local.backup ] && mv frontend/.env.local.backup frontend/.env.local

echo "✅ Code updated successfully"
DEPLOY_SCRIPT

echo ""
echo -e "${YELLOW}📋 Step 3: Installing dependencies...${NC}"

ssh -i "$KEY_FILE" "$EC2_USER@$EC2_IP" << 'EOF'
cd /home/ubuntu/EHealthMedAI

echo "📦 Installing backend dependencies..."
cd backend
npm install --production

echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install --production
EOF

echo ""
echo -e "${YELLOW}📋 Step 4: Building frontend...${NC}"

ssh -i "$KEY_FILE" "$EC2_USER@$EC2_IP" << 'EOF'
cd /home/ubuntu/EHealthMedAI/frontend

echo "🔨 Building Next.js application..."
rm -rf .next
npm run build

echo "✅ Frontend build complete"
EOF

echo ""
echo -e "${YELLOW}📋 Step 5: Restarting services...${NC}"

ssh -i "$KEY_FILE" "$EC2_USER@$EC2_IP" << 'EOF'
cd /home/ubuntu/EHealthMedAI

echo "🔄 Restarting backend..."
pm2 restart ehealth-backend || pm2 start ecosystem.config.js --only ehealth-backend

echo "🔄 Restarting frontend..."
pm2 restart ehealth-frontend || pm2 start ecosystem.config.js --only ehealth-frontend

echo ""
echo "📊 Service Status:"
pm2 status

echo ""
echo "✅ Deployment complete!"
EOF

echo ""
echo -e "${GREEN}✅ Deployment to production complete!${NC}"
echo ""
echo "🌐 Your application should be live at: https://huzaifaiftikhar.engineer"
echo ""

