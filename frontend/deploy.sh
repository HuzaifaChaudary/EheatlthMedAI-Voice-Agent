#!/bin/bash

# Frontend Deployment Script for AWS EC2
# This script helps automate frontend deployment on EC2

set -e

echo "🚀 Starting EHealth Med AI Frontend Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}⚠️  .env.local not found. Creating from template...${NC}"
    echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api" > .env.local
    echo -e "${YELLOW}⚠️  Please update .env.local with your backend API URL!${NC}"
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"

# Check PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 not found. Installing...${NC}"
    sudo npm install -g pm2
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Build for production
echo -e "${YELLOW}🔨 Building frontend for production...${NC}"
npm run build

# Stop existing PM2 process if running
if pm2 list | grep -q "ehealth-frontend"; then
    echo -e "${YELLOW}🛑 Stopping existing frontend process...${NC}"
    pm2 stop ehealth-frontend
    pm2 delete ehealth-frontend
fi

# Start with PM2
echo -e "${YELLOW}▶️  Starting frontend with PM2...${NC}"
pm2 start npm --name ehealth-frontend -- start

# Save PM2 configuration
pm2 save

echo -e "${GREEN}✅ Frontend deployment complete!${NC}"
echo ""
echo "Useful commands:"
echo "  - View logs: pm2 logs ehealth-frontend"
echo "  - Check status: pm2 status"
echo "  - Restart: pm2 restart ehealth-frontend"
echo "  - Stop: pm2 stop ehealth-frontend"
echo ""
echo -e "${YELLOW}⚠️  Remember to:${NC}"
echo "  1. Update .env.local with your backend API URL"
echo "  2. Configure Nginx to proxy to localhost:3000"
echo "  3. Set up SSL certificate"

