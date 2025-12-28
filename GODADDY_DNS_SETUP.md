# GoDaddy DNS Setup for ehealthmed.ai

## Quick Setup Steps

### 1. Log in to GoDaddy
- Go to: https://www.godaddy.com
- Log in to your account
- Navigate to: **My Products** → **Domains** → **ehealthmed.ai**
- Click **DNS** or **Manage DNS**

### 2. Add A Records

You need to add **2 A records**:

#### Record 1: Root Domain (@)
- **Type**: `A`
- **Name**: `@` (or leave blank)
- **Value**: `34.225.194.2`
- **TTL**: `3600` (1 hour)

#### Record 2: WWW Subdomain
- **Type**: `A`
- **Name**: `www`
- **Value**: `34.225.194.2`
- **TTL**: `3600` (1 hour)

### 3. Remove Old Records (If Any)
- Delete any existing A records that point to different IPs
- Keep CNAME, MX, TXT records if they're needed for email/other services

### 4. Save Changes
- Click **Save** or **Add Record**
- Changes usually take effect within 15-30 minutes

### 5. Verify DNS
After saving, verify DNS is working:

```bash
# On your local machine
nslookup ehealthmed.ai
# Should return: 34.225.194.2

# Or use online checker:
# https://www.whatsmydns.net/#A/ehealthmed.ai
```

---

## Visual Guide

Your DNS records should look like this:

```
Type    Name    Value           TTL
A       @       34.225.194.2    3600
A       www     34.225.194.2    3600
```

---

## After DNS is Configured

Once DNS shows `34.225.194.2` (check with nslookup), proceed to:

1. **Run the update script** (on your local machine):
   ```bash
   ./update-domain-to-ehealthmed-ai.sh
   ```

2. **Update SSL certificate** (on EC2):
   ```bash
   ssh -i ~/ehealth-key-1766435634.pem ubuntu@34.225.194.2
   sudo certbot --nginx -d ehealthmed.ai -d www.ehealthmed.ai
   ```

3. **Reload services**:
   ```bash
   sudo systemctl reload nginx
   pm2 restart all
   ```

---

## Troubleshooting

### DNS Not Working?
- Wait 15-30 minutes for propagation
- Double-check the IP address: `34.225.194.2`
- Make sure you saved the records in GoDaddy
- Clear your DNS cache

### Can't Find DNS Settings?
- Look for "DNS Management" or "DNS Records" in GoDaddy dashboard
- Some GoDaddy interfaces call it "DNS Zone File"
- Contact GoDaddy support if you can't find it

---

**Next Step**: See `DOMAIN_MIGRATION_GUIDE.md` for complete migration instructions.

