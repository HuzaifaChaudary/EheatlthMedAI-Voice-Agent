#!/bin/bash

# Script to verify Google OAuth configuration

DOMAIN="ehealthmed.ai"
EC2_IP="34.225.194.2"
KEY_PATH="$HOME/ehealth-key-1766435634.pem"

echo "🔍 Verifying Google OAuth Configuration for $DOMAIN"
echo ""

# Check backend .env
echo "📋 Backend Configuration:"
ssh -i "$KEY_PATH" ubuntu@$EC2_IP << 'EOF'
    cd /home/ubuntu/EHealthMedAI/backend
    echo "GOOGLE_CLIENT_ID: $(grep GOOGLE_CLIENT_ID .env | cut -d'=' -f2 | head -c 50)..."
    echo "GOOGLE_CLIENT_SECRET: $(grep GOOGLE_CLIENT_SECRET .env | cut -d'=' -f2 | head -c 20)..."
    echo "GOOGLE_REDIRECT_URI: $(grep GOOGLE_REDIRECT_URI .env | cut -d'=' -f2)"
EOF

echo ""
echo "🌐 Testing OAuth URL Generation:"
OAUTH_RESPONSE=$(curl -s https://$DOMAIN/api/auth/google)
echo "$OAUTH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$OAUTH_RESPONSE"

echo ""
echo "✅ Expected Configuration in Google Cloud Console:"
echo ""
echo "Authorized JavaScript origins:"
echo "  - https://$DOMAIN"
echo ""
echo "Authorized redirect URIs:"
echo "  - https://$DOMAIN/api/auth/google/callback"
echo ""
echo "⚠️  Important Checks:"
echo "  1. Make sure there are NO trailing slashes"
echo "  2. Make sure it's HTTPS (not HTTP)"
echo "  3. Make sure the domain matches EXACTLY: $DOMAIN"
echo "  4. Wait 5-15 minutes after making changes in Google Cloud Console"
echo ""
echo "🔗 Test OAuth Flow:"
echo "   Visit: https://$DOMAIN/api/auth/google"
echo "   This should redirect to Google login"

