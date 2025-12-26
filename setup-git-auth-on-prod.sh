#!/bin/bash

# Setup Git Authentication on Production Server
# This allows production to pull from private GitHub repo

EC2_IP="34.225.194.2"
EC2_USER="ubuntu"
KEY_FILE="$HOME/ehealth-key-1766435634.pem"

echo "🔐 Setting up Git authentication on production..."
echo ""

echo "Option 1: SSH Key (Recommended)"
echo "=============================="
echo "This will generate an SSH key on production and you'll add it to GitHub"
echo ""

read -p "Do you want to set up SSH key authentication? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    ssh -i "$KEY_FILE" "$EC2_USER@$EC2_IP" << 'EOF'
cd /home/ubuntu/EHealthMedAI

# Generate SSH key if it doesn't exist
if [ ! -f ~/.ssh/id_rsa ]; then
    echo "🔑 Generating SSH key..."
    ssh-keygen -t rsa -b 4096 -C "production@ehealthmedai" -f ~/.ssh/id_rsa -N ""
    echo "✅ SSH key generated"
else
    echo "✅ SSH key already exists"
fi

# Display public key
echo ""
echo "📋 Your public key (add this to GitHub):"
echo "=========================================="
cat ~/.ssh/id_rsa.pub
echo ""
echo "=========================================="
echo ""
echo "📝 Next steps:"
echo "1. Copy the public key above"
echo "2. Go to: https://github.com/HuzaifaChaudary/EheatlthMedAI-Voice-Agent/settings/keys"
echo "3. Click 'Add deploy key'"
echo "4. Paste the key and give it a name (e.g., 'Production Server')"
echo "5. Check 'Allow write access' if you want to push (optional)"
echo "6. Click 'Add key'"
echo ""
echo "After adding the key, run:"
echo "  git remote set-url origin git@github.com:HuzaifaChaudary/EheatlthMedAI-Voice-Agent.git"
echo "  git pull origin master"
EOF

    echo ""
    echo "✅ SSH key setup complete!"
    echo ""
    echo "After adding the key to GitHub, update the remote URL:"
    echo "  ssh -i $KEY_FILE $EC2_USER@$EC2_IP 'cd /home/ubuntu/EHealthMedAI && git remote set-url origin git@github.com:HuzaifaChaudary/EheatlthMedAI-Voice-Agent.git'"
fi

echo ""
echo "Option 2: Personal Access Token"
echo "================================"
echo "If you prefer using a token instead:"
echo "1. Go to: https://github.com/settings/tokens"
echo "2. Generate new token (classic) with 'repo' scope"
echo "3. Run:"
echo "   git remote set-url origin https://YOUR_TOKEN@github.com/HuzaifaChaudary/EheatlthMedAI-Voice-Agent.git"

