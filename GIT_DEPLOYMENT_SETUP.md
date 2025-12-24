# Git-Based Deployment Setup

## Problem
Previously, code was manually uploaded to production via `scp` because:
1. Repository was private
2. Git wasn't properly set up on EC2
3. Manual uploads created gaps between local and production

## Solution
Now using **Git-based deployment** to keep local and production in sync.

---

## Setup (One-Time)

### 1. Production Server Git Setup

The production server now has:
- Git repository initialized
- Remote pointing to: `https://github.com/HuzaifaChaudary/EheatlthMedAI-Voice-Agent.git`
- `.env` files excluded from Git (via `.gitignore`)

### 2. Deployment Script

Use `deploy-to-production.sh` for automated deployments:

```bash
./deploy-to-production.sh
```

**What it does:**
1. ✅ Backs up `.env` files
2. ✅ Pulls latest code from GitHub
3. ✅ Restores `.env` files (never overwrites them)
4. ✅ Installs dependencies
5. ✅ Builds frontend
6. ✅ Restarts PM2 services

---

## Daily Workflow

### 1. Make Changes Locally

```bash
# Make your code changes
# Test locally
npm run dev  # Frontend
npm start    # Backend
```

### 2. Commit and Push to GitHub

```bash
cd /Users/muhammadharis/Developer/EHealthMedAI

# Stage changes
git add .

# Commit
git commit -m "Description of changes"

# Push to GitHub
git push origin master
```

### 3. Deploy to Production

```bash
# Run deployment script
./deploy-to-production.sh
```

That's it! Production will have the same code as local (except `.env` files).

---

## Important Notes

### ✅ What Gets Synced
- All code files (`.js`, `.tsx`, `.ts`, etc.)
- Configuration files (`package.json`, `next.config.js`, etc.)
- Documentation (`.md` files)
- Scripts and utilities

### ❌ What Doesn't Get Synced (Protected)
- `.env` files (backend and frontend)
- `.env.local` files
- `node_modules/` (reinstalled on server)
- `.next/` build folder (rebuilt on server)
- PM2 logs
- Database data

### 🔒 Environment Variables
- **Local**: Stored in `backend/.env` and `frontend/.env.local`
- **Production**: Stored in `backend/.env` and `frontend/.env` on EC2
- **Never committed to Git** (protected by `.gitignore`)

---

## Manual Deployment (If Script Fails)

If the automated script fails, you can deploy manually:

```bash
# SSH to production
ssh -i ~/ehealth-key-1766435634.pem ubuntu@34.225.194.2

# Navigate to project
cd /home/ubuntu/EHealthMedAI

# Backup .env
cp backend/.env backend/.env.backup
cp frontend/.env frontend/.env.backup

# Pull latest code
git fetch origin
git pull origin master

# Restore .env
mv backend/.env.backup backend/.env
mv frontend/.env.backup frontend/.env

# Install dependencies
cd backend && npm install --production
cd ../frontend && npm install --production

# Build frontend
cd ../frontend
rm -rf .next
npm run build

# Restart services
pm2 restart ehealth-backend
pm2 restart ehealth-frontend
```

---

## Troubleshooting

### "Repository not found" or "Permission denied"
- Check GitHub repository is accessible
- Verify repository URL is correct
- Ensure repository is not private (or use SSH keys)

### ".env file was overwritten"
- The script backs up `.env` files before pulling
- If overwritten, restore from backup: `mv backend/.env.backup backend/.env`

### "Build failed"
- Check Node.js version matches (should be 18+)
- Check `package.json` dependencies
- Review build logs: `pm2 logs ehealth-frontend`

### "Services won't start"
- Check PM2 status: `pm2 status`
- Check logs: `pm2 logs`
- Verify `.env` files exist and are correct

---

## Benefits

✅ **Consistency**: Local and production always in sync  
✅ **Speed**: One command to deploy (`./deploy-to-production.sh`)  
✅ **Safety**: `.env` files never overwritten  
✅ **History**: All changes tracked in Git  
✅ **Rollback**: Easy to revert to previous version  
✅ **Collaboration**: Multiple developers can deploy same code  

---

## Next Steps

1. ✅ Git repository initialized on production
2. ✅ Deployment script created
3. ✅ `.gitignore` configured
4. 🔄 **Commit and push your current changes**
5. 🔄 **Run `./deploy-to-production.sh` to sync production**

---

## Quick Reference

```bash
# Deploy to production
./deploy-to-production.sh

# Check production Git status
ssh -i ~/ehealth-key-1766435634.pem ubuntu@34.225.194.2 "cd /home/ubuntu/EHealthMedAI && git status"

# View production logs
ssh -i ~/ehealth-key-1766435634.pem ubuntu@34.225.194.2 "pm2 logs"
```

