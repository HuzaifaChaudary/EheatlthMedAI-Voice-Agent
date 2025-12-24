#!/bin/bash

# Deploy phone number fixes to EC2
# Usage: ./deploy-to-ec2.sh

EC2_IP="34.225.194.2"
EC2_USER="ubuntu"
KEY_FILE="$HOME/ehealth-key-1766435634.pem"

if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Key file not found: $KEY_FILE"
    exit 1
fi

echo "🚀 Deploying phone number fixes to EC2..."

# Files to upload
FILES=(
    "backend/routes/telephony.js"
    "backend/routes/agents.js"
    "backend/server.js"
    "frontend/app/architecture/telephony/page.tsx"
    "frontend/app/dashboard/agents/new/page.tsx"
    "frontend/app/dashboard/agents/[agentId]/page.tsx"
)

# Upload each file
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "📤 Uploading $file..."
        scp -i "$KEY_FILE" "$file" "$EC2_USER@$EC2_IP:/home/ubuntu/EHealthMedAI/$file"
    else
        echo "⚠️  File not found: $file"
    fi
done

echo ""
echo "✅ Files uploaded. Now restarting services on EC2..."

# Restart backend and frontend
ssh -i "$KEY_FILE" "$EC2_USER@$EC2_IP" << 'EOF'
cd /home/ubuntu/EHealthMedAI

echo "🔄 Restarting backend..."
cd backend
pm2 restart backend || pm2 start server.js --name backend

echo "🔄 Restarting frontend..."
cd ../frontend
pm2 restart frontend || pm2 start "npm run start" --name frontend

echo "✅ Services restarted!"
pm2 list
EOF

echo ""
echo "✅ Deployment complete!"

