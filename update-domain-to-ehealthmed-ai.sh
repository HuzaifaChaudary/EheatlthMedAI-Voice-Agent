#!/bin/bash

# Script to update domain from huzaifaiftikhar.engineer to ehealthmed.ai
# Run this on EC2 after DNS is configured at GoDaddy

set -e

NEW_DOMAIN="ehealthmed.ai"
OLD_DOMAIN="huzaifaiftikhar.engineer"
EC2_IP="34.225.194.2"
KEY_PATH="$HOME/ehealth-key-1766435634.pem"

echo "🌐 Updating domain from $OLD_DOMAIN to $NEW_DOMAIN"
echo ""

# Step 1: Update Nginx configuration
echo "📝 Step 1: Updating Nginx configuration..."
ssh -i "$KEY_PATH" ubuntu@$EC2_IP << 'EOF'
sudo cp /etc/nginx/conf.d/ehealth.conf /etc/nginx/conf.d/ehealth.conf.backup
sudo sed -i 's/huzaifaiftikhar\.engineer/ehealthmed.ai/g' /etc/nginx/conf.d/ehealth.conf
echo "✅ Nginx config updated"
EOF

# Step 2: Update backend .env
echo "📝 Step 2: Updating backend .env..."
ssh -i "$KEY_PATH" ubuntu@$EC2_IP << 'EOF'
cd /home/ubuntu/EHealthMedAI/backend
cp .env .env.backup
sed -i 's|https://huzaifaiftikhar.engineer|https://ehealthmed.ai|g' .env
echo "✅ Backend .env updated"
EOF

# Step 3: Update frontend .env.local
echo "📝 Step 3: Updating frontend .env.local..."
ssh -i "$KEY_PATH" ubuntu@$EC2_IP << 'EOF'
cd /home/ubuntu/EHealthMedAI/frontend
if [ -f .env.local ]; then
    cp .env.local .env.local.backup
    sed -i 's|https://huzaifaiftikhar.engineer|https://ehealthmed.ai|g' .env.local
    echo "✅ Frontend .env.local updated"
else
    echo "⚠️  .env.local not found, creating it..."
    echo "NEXT_PUBLIC_API_URL=https://ehealthmed.ai/api" > .env.local
    echo "✅ Frontend .env.local created"
fi
EOF

# Step 4: Test nginx config
echo "📝 Step 4: Testing Nginx configuration..."
ssh -i "$KEY_PATH" ubuntu@$EC2_IP 'sudo nginx -t'

echo ""
echo "✅ All configuration files updated!"
echo ""
echo "⚠️  IMPORTANT: Before reloading nginx, make sure:"
echo "   1. DNS records are configured at GoDaddy"
echo "   2. DNS has propagated (check with: nslookup ehealthmed.ai)"
echo "   3. Then run SSL certificate update:"
echo "      ssh -i $KEY_PATH ubuntu@$EC2_IP"
echo "      sudo certbot --nginx -d ehealthmed.ai -d www.ehealthmed.ai"
echo ""
echo "After SSL is updated, reload nginx:"
echo "  ssh -i $KEY_PATH ubuntu@$EC2_IP 'sudo systemctl reload nginx && pm2 restart all'"

