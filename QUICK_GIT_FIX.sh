#!/bin/bash

# Quick Git Authentication Fix
# This script helps you authenticate with GitHub

echo "🔐 Git Authentication Fix"
echo "========================"
echo ""

# Check current remote
echo "📍 Current remote URL:"
git remote -v
echo ""

# Check if GitHub CLI is installed
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI (gh) is installed"
    echo ""
    echo "Option 1: Use GitHub CLI (Easiest)"
    echo "===================================="
    read -p "Do you want to authenticate with GitHub CLI? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh auth login
        echo ""
        echo "✅ Authentication complete!"
        echo "Try: git pull origin main"
        exit 0
    fi
else
    echo "⚠️  GitHub CLI not installed"
    echo "Install with: brew install gh"
    echo ""
fi

echo "Option 2: Use Personal Access Token"
echo "===================================="
echo ""
echo "1. Go to: https://github.com/settings/tokens"
echo "2. Click 'Generate new token (classic)'"
echo "3. Name it: 'EHealthMedAI Development'"
echo "4. Check 'repo' scope"
echo "5. Click 'Generate token'"
echo "6. Copy the token"
echo ""
read -p "Paste your token here (or press Enter to skip): " TOKEN

if [ ! -z "$TOKEN" ]; then
    # Update remote with token
    git remote set-url origin https://${TOKEN}@github.com/HuzaifaChaudary/EheatlthMedAI-Voice-Agent.git
    echo ""
    echo "✅ Remote URL updated with token"
    echo "Try: git pull origin main"
else
    echo ""
    echo "⚠️  No token provided"
    echo ""
    echo "Manual steps:"
    echo "1. Get token from: https://github.com/settings/tokens"
    echo "2. Run: git remote set-url origin https://YOUR_TOKEN@github.com/HuzaifaChaudary/EheatlthMedAI-Voice-Agent.git"
    echo "3. Replace YOUR_TOKEN with your actual token"
fi

echo ""
echo "Option 3: Use SSH (More Secure)"
echo "================================="
echo ""
echo "If you have SSH key set up:"
echo "  git remote set-url origin git@github.com:HuzaifaChaudary/EheatlthMedAI-Voice-Agent.git"
echo ""
