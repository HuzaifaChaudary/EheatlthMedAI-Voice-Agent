# Domain Migration Guide: huzaifaiftikhar.engineer → ehealthmed.ai

## Overview
This guide will help you migrate from `huzaifaiftikhar.engineer` to `ehealthmed.ai` at GoDaddy.

---

## Step 1: Configure DNS at GoDaddy

### 1.1 Log in to GoDaddy
1. Go to [GoDaddy.com](https://www.godaddy.com) and log in
2. Navigate to **My Products** → **Domains** → **ehealthmed.ai**
3. Click **DNS** or **Manage DNS**

### 1.2 Add DNS Records
Add the following DNS records (remove any old ones for the old domain):

#### A Record (Root Domain)
- **Type**: `A`
- **Name**: `@` (or leave blank, or `ehealthmed.ai`)
- **Value**: `34.225.194.2`
- **TTL**: `3600` (or `1 hour`)

#### A Record (WWW Subdomain)
- **Type**: `A`
- **Name**: `www`
- **Value**: `34.225.194.2`
- **TTL**: `3600` (or `1 hour`)

### 1.3 Verify DNS Records
After adding, your DNS should look like:
```
Type    Name    Value           TTL
A       @       34.225.194.2    3600
A       www     34.225.194.2    3600
```

---

## Step 2: Wait for DNS Propagation

DNS changes can take **5 minutes to 48 hours** to propagate, but usually takes **15-30 minutes**.

### Check DNS Propagation:
```bash
# Check if DNS is working
nslookup ehealthmed.ai
dig ehealthmed.ai

# Should return: 34.225.194.2
```

### Online DNS Checkers:
- [whatsmydns.net](https://www.whatsmydns.net/#A/ehealthmed.ai)
- [dnschecker.org](https://dnschecker.org/#A/ehealthmed.ai)

**⚠️ Wait until DNS shows `34.225.194.2` before proceeding to Step 3!**

---

## Step 3: Update Server Configuration

### 3.1 Run the Update Script
On your **local machine**, run:
```bash
chmod +x update-domain-to-ehealthmed-ai.sh
./update-domain-to-ehealthmed-ai.sh
```

This script will:
- ✅ Update Nginx configuration
- ✅ Update backend `.env` file
- ✅ Update frontend `.env.local` file
- ✅ Test Nginx configuration

### 3.2 Manual Update (Alternative)
If you prefer to update manually:

#### Update Nginx Config:
```bash
ssh -i ~/ehealth-key-1766435634.pem ubuntu@34.225.194.2
sudo nano /etc/nginx/conf.d/ehealth.conf
# Replace all instances of "huzaifaiftikhar.engineer" with "ehealthmed.ai"
sudo nginx -t
```

#### Update Backend .env:
```bash
cd /home/ubuntu/EHealthMedAI/backend
nano .env
# Update:
# FRONTEND_URL=https://ehealthmed.ai
# API_URL=https://ehealthmed.ai/api
# CORS_ORIGIN=https://ehealthmed.ai
```

#### Update Frontend .env.local:
```bash
cd /home/ubuntu/EHealthMedAI/frontend
nano .env.local
# Update:
# NEXT_PUBLIC_API_URL=https://ehealthmed.ai/api
```

---

## Step 4: Update SSL Certificate

**⚠️ Only do this AFTER DNS has propagated!**

### 4.1 Get New SSL Certificate
```bash
ssh -i ~/ehealth-key-1766435634.pem ubuntu@34.225.194.2

# Install certbot if not already installed
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate for new domain
sudo certbot --nginx -d ehealthmed.ai -d www.ehealthmed.ai
```

Follow the prompts:
- Enter your email address
- Agree to terms
- Choose whether to redirect HTTP to HTTPS (recommended: **Yes**)

### 4.2 Verify SSL Certificate
```bash
# Check certificate
sudo certbot certificates

# Test SSL
curl -I https://ehealthmed.ai
```

---

## Step 5: Reload Services

### 5.1 Reload Nginx
```bash
sudo systemctl reload nginx
# Or restart if needed:
sudo systemctl restart nginx
```

### 5.2 Restart Application Services
```bash
# Restart backend and frontend
pm2 restart all

# Check status
pm2 status
pm2 logs
```

---

## Step 6: Update Google OAuth (If Using)

If you're using Google OAuth, update the redirect URIs:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Update **Authorized redirect URIs**:
   - Remove: `https://huzaifaiftikhar.engineer/api/auth/google/callback`
   - Add: `https://ehealthmed.ai/api/auth/google/callback`
5. Update **Authorized JavaScript origins**:
   - Remove: `https://huzaifaiftikhar.engineer`
   - Add: `https://ehealthmed.ai`
6. Save changes

---

## Step 7: Verify Everything Works

### 7.1 Test Frontend
- Open: `https://ehealthmed.ai`
- Should see the login page
- Try logging in

### 7.2 Test Backend API
```bash
curl https://ehealthmed.ai/api/health
# Should return: {"status":"ok",...}
```

### 7.3 Test SSL
- Check browser shows 🔒 (secure connection)
- Visit: `https://www.ehealthmed.ai` (should redirect or work)

---

## Step 8: Clean Up Old Domain (Optional)

### 8.1 Remove Old SSL Certificate
```bash
sudo certbot delete --cert-name huzaifaiftikhar.engineer
```

### 8.2 Update Name.com DNS (Old Domain)
If you want to keep the old domain but point it elsewhere, or remove DNS records.

---

## Troubleshooting

### DNS Not Propagating
- Wait longer (up to 48 hours)
- Check GoDaddy DNS settings are correct
- Clear DNS cache: `sudo dscacheutil -flushcache` (macOS) or `ipconfig /flushdns` (Windows)

### SSL Certificate Fails
- Make sure DNS is fully propagated
- Check firewall allows port 80 and 443
- Verify domain points to correct IP: `nslookup ehealthmed.ai`

### 502 Bad Gateway
- Check if backend is running: `pm2 status`
- Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- Restart services: `pm2 restart all && sudo systemctl restart nginx`

### CORS Errors
- Verify `CORS_ORIGIN` in backend `.env` matches new domain
- Restart backend: `pm2 restart ehealth-backend`

---

## Summary Checklist

- [ ] DNS records added at GoDaddy (A records for @ and www)
- [ ] DNS propagated (verified with nslookup)
- [ ] Server configuration updated (nginx, .env files)
- [ ] SSL certificate obtained for new domain
- [ ] Nginx reloaded
- [ ] PM2 services restarted
- [ ] Google OAuth updated (if applicable)
- [ ] Frontend accessible at https://ehealthmed.ai
- [ ] Backend API working at https://ehealthmed.ai/api/health
- [ ] Login works correctly

---

## Quick Reference

**New Domain**: `ehealthmed.ai`  
**Server IP**: `34.225.194.2`  
**SSH Command**: `ssh -i ~/ehealth-key-1766435634.pem ubuntu@34.225.194.2`

**Important URLs**:
- Frontend: `https://ehealthmed.ai`
- Backend API: `https://ehealthmed.ai/api`
- Health Check: `https://ehealthmed.ai/api/health`

---

**Need Help?** Check the troubleshooting section or verify each step was completed correctly.

