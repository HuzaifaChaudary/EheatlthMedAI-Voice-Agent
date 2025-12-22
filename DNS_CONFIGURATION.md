# DNS Configuration for huzaifaiftikhar.engineer

## EC2 Instance Details
- **Public IP Address**: `34.225.194.2`
- **Domain**: `huzaifaiftikhar.engineer`

---

## DNS Records to Add

Go to your domain provider's DNS management panel (wherever you registered `huzaifaiftikhar.engineer`) and add the following records:

### 1. A Record (Main Domain)

**Type**: `A`  
**Name/Host**: `@` (or leave blank, or `huzaifaiftikhar.engineer`)  
**Value/Target**: `34.225.194.2`  
**TTL**: `3600` (or default)

This points your main domain to the EC2 instance.

### 2. A Record (WWW Subdomain) - Optional

**Type**: `A`  
**Name/Host**: `www`  
**Value/Target**: `34.225.194.2`  
**TTL**: `3600` (or default)

This allows `www.huzaifaiftikhar.engineer` to work as well.

---

## Example DNS Configuration

### For Most Domain Providers (Namecheap, GoDaddy, etc.):

```
Type    Name    Value           TTL
----    ----    -----           ---
A       @       34.225.194.2    3600
A       www     34.225.194.2    3600
```

### For Cloudflare:

1. Go to **DNS** → **Records**
2. Click **Add record**
3. **Type**: `A`
4. **Name**: `@` (for root domain) or `www` (for www subdomain)
5. **IPv4 address**: `34.225.194.2`
6. **Proxy status**: Toggle OFF (gray cloud) initially for SSL setup, then you can enable it
7. **TTL**: Auto
8. Click **Save**

### For Route 53 (AWS):

1. Go to **Route 53** → **Hosted zones**
2. Select your domain
3. Click **Create record**
4. **Record name**: Leave blank for root domain, or `www` for subdomain
5. **Record type**: `A`
6. **Value**: `34.225.194.2`
7. **TTL**: `300`
8. Click **Create records**

---

## After Adding DNS Records

1. **Wait for DNS Propagation** (5 minutes to 48 hours, usually 5-30 minutes)
2. **Verify DNS is working**:
   ```bash
   # Check if DNS is resolving
   nslookup huzaifaiftikhar.engineer
   # or
   dig huzaifaiftikhar.engineer
   ```
   Should return: `34.225.194.2`

3. **Test HTTP Access**:
   ```bash
   curl -I http://huzaifaiftikhar.engineer
   ```

---

## SSL Certificate Setup

After DNS is configured and pointing to your EC2 instance:

1. **SSH into your EC2 instance**:
   ```bash
   ssh -i ~/ehealth-key-1766435634.pem ubuntu@34.225.194.2
   ```

2. **Install Certbot**:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   ```

3. **Get SSL Certificate**:
   ```bash
   sudo certbot --nginx -d huzaifaiftikhar.engineer -d www.huzaifaiftikhar.engineer
   ```

4. **Follow the prompts**:
   - Enter your email
   - Agree to terms
   - Choose whether to redirect HTTP to HTTPS (recommended: Yes)

Certbot will automatically:
- Get SSL certificate from Let's Encrypt
- Configure Nginx for HTTPS
- Set up auto-renewal

---

## Important Notes

1. **DNS Propagation**: It can take 5 minutes to 48 hours for DNS changes to propagate globally. Most changes take 5-30 minutes.

2. **SSL Certificate**: You can only get an SSL certificate after DNS is pointing to your server. Let's Encrypt needs to verify domain ownership.

3. **Nginx Configuration**: After SSL is set up, Certbot will automatically update your Nginx configuration. Make sure Nginx is configured to serve your application on ports 80 and 443.

4. **Firewall**: Ensure your EC2 security group allows:
   - Port 80 (HTTP)
   - Port 443 (HTTPS)
   - Port 22 (SSH)

---

## Troubleshooting

### DNS Not Resolving

1. Check if DNS records are correct in your domain provider
2. Wait for propagation (can take up to 48 hours)
3. Use `nslookup` or `dig` to check DNS resolution
4. Clear your local DNS cache:
   ```bash
   # macOS
   sudo dscacheutil -flushcache
   
   # Linux
   sudo systemd-resolve --flush-caches
   ```

### SSL Certificate Fails

1. Ensure DNS is pointing to `34.225.194.2`
2. Ensure port 80 is open in security group
3. Ensure Nginx is running and accessible
4. Check Certbot logs: `sudo tail -f /var/log/letsencrypt/letsencrypt.log`

---

## Summary

**Add these DNS records to your domain provider:**

```
A Record:
- Name: @ (or blank)
- Value: 34.225.194.2
- TTL: 3600

A Record (optional):
- Name: www
- Value: 34.225.194.2
- TTL: 3600
```

After DNS propagates, run SSL setup on the server, and your site will be live at `https://huzaifaiftikhar.engineer`! 🚀

