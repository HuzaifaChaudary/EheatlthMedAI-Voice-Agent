#!/bin/bash

# Script to check DNS and automatically setup SSL once DNS is correct

DOMAIN="ehealthmed.ai"
EXPECTED_IP="34.225.194.2"
EC2_IP="34.225.194.2"
KEY_PATH="$HOME/ehealth-key-1766435634.pem"

echo "🔍 Checking DNS for $DOMAIN..."
echo ""

# Check DNS using multiple methods
DNS_IP=$(dig +short $DOMAIN @8.8.8.8 | head -1)

if [ -z "$DNS_IP" ]; then
    echo "❌ DNS not resolving yet. Please wait a few more minutes."
    exit 1
fi

echo "📊 Current DNS resolution: $DNS_IP"
echo "🎯 Expected IP: $EXPECTED_IP"
echo ""

if [ "$DNS_IP" = "$EXPECTED_IP" ]; then
    echo "✅ DNS is correct! Setting up SSL certificate..."
    echo ""
    
    ssh -i "$KEY_PATH" ubuntu@$EC2_IP << 'EOF'
        echo "🔐 Requesting SSL certificate..."
        sudo certbot --nginx -d ehealthmed.ai -d www.ehealthmed.ai --non-interactive --agree-tos --email chhuzaifaiftikhar@gmail.com --redirect
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ SSL certificate installed successfully!"
            echo "🔄 Reloading nginx..."
            sudo systemctl reload nginx
            echo ""
            echo "🎉 Your site should now be live at: https://ehealthmed.ai"
        else
            echo ""
            echo "❌ SSL certificate setup failed. Check the error above."
            exit 1
        fi
EOF

    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ All done! Testing HTTPS..."
        sleep 2
        curl -I https://ehealthmed.ai 2>&1 | head -5
    fi
else
    echo "❌ DNS is still pointing to: $DNS_IP"
    echo "   Expected: $EXPECTED_IP"
    echo ""
    echo "⚠️  Please:"
    echo "   1. Make sure you deleted the 'Parked' A record in GoDaddy"
    echo "   2. Wait 5-15 minutes for DNS to propagate"
    echo "   3. Run this script again: ./check-dns-and-setup-ssl.sh"
    exit 1
fi

