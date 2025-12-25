#!/bin/bash

# Script to check what's different between local and production
# Usage: ./check-sync.sh

set -e

EC2_IP="34.225.194.2"
EC2_USER="ubuntu"
KEY_FILE="$HOME/ehealth-key-1766435634.pem"

echo "🔍 Checking Local vs Production Sync Status"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}📋 Step 1: Checking local Git status...${NC}"
echo ""

# Check uncommitted changes locally
UNCOMMITTED=$(cd /Users/muhammadharis/Developer/EHealthMedAI && git status --short 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNCOMMITTED" -gt 0 ]; then
    echo -e "${RED}⚠️  You have $UNCOMMITTED uncommitted changes locally${NC}"
    echo "Files:"
    cd /Users/muhammadharis/Developer/EHealthMedAI && git status --short | head -10
    echo ""
else
    echo -e "${GREEN}✅ No uncommitted changes locally${NC}"
    echo ""
fi

# Check unpushed commits
UNPUSHED=$(cd /Users/muhammadharis/Developer/EHealthMedAI && git log origin/master..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNPUSHED" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  You have $UNPUSHED commits not pushed to GitHub${NC}"
    echo "Recent commits:"
    cd /Users/muhammadharis/Developer/EHealthMedAI && git log origin/master..HEAD --oneline | head -5
    echo ""
else
    echo -e "${GREEN}✅ All commits pushed to GitHub${NC}"
    echo ""
fi

echo -e "${YELLOW}📋 Step 2: Checking production Git status...${NC}"
echo ""

# Check production Git status
ssh -i "$KEY_FILE" "$EC2_USER@$EC2_IP" << 'EOF'
cd /home/ubuntu/EHealthMedAI

echo "📦 Production Git Status:"
git status --short 2>/dev/null | head -10 || echo "No changes"

echo ""
echo "📅 Last commit on production:"
git log --oneline -1 2>/dev/null || echo "No commits yet"

echo ""
echo "🔗 Git remote:"
git remote -v 2>/dev/null | head -2 || echo "No remote configured"
EOF

echo ""
echo -e "${YELLOW}📋 Step 3: Comparing key files...${NC}"
echo ""

# Compare key files
KEY_FILES=(
    "frontend/app/admin/page.tsx"
    "frontend/app/dashboard/page.tsx"
    "frontend/app/dashboard/integrations/page.tsx"
    "frontend/app/layout.tsx"
    "backend/routes/organizations.js"
    "backend/routes/agents.js"
    "backend/routes/integrations.js"
    "backend/routes/telephony.js"
)

echo "Comparing key files (this may take a moment)..."
echo ""

for file in "${KEY_FILES[@]}"; do
    if [ -f "/Users/muhammadharis/Developer/EHealthMedAI/$file" ]; then
        LOCAL_HASH=$(md5 -q "/Users/muhammadharis/Developer/EHealthMedAI/$file" 2>/dev/null || echo "N/A")
        PROD_HASH=$(ssh -i "$KEY_FILE" "$EC2_USER@$EC2_IP" "md5sum /home/ubuntu/EHealthMedAI/$file 2>/dev/null | cut -d' ' -f1" 2>/dev/null || echo "N/A")
        
        if [ "$LOCAL_HASH" = "$PROD_HASH" ] && [ "$LOCAL_HASH" != "N/A" ]; then
            echo -e "${GREEN}✅ $file${NC}"
        elif [ "$PROD_HASH" = "N/A" ]; then
            echo -e "${RED}❌ $file (missing on production)${NC}"
        else
            echo -e "${YELLOW}⚠️  $file (DIFFERENT)${NC}"
        fi
    fi
done

echo ""
echo -e "${YELLOW}📋 Step 4: Summary${NC}"
echo ""

echo "To sync everything:"
echo "  1. Commit local changes: git add . && git commit -m 'Your message'"
echo "  2. Push to GitHub: git push origin master"
echo "  3. Deploy to production: ./deploy-to-production.sh"
echo ""

