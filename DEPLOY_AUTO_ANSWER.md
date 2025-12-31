# Deploy Auto-Answer Endpoint to Production

## Issue
The auto-answer endpoint exists in code but isn't deployed to production yet. That's why calls are showing "busy".

## Solution: Deploy to EC2

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Add auto-answer endpoint for testing"
git push origin main
```

### Step 2: Deploy to EC2
SSH into your EC2 instance and run:

```bash
# SSH into EC2
ssh -i ~/ehealth-key-1766435634.pem ubuntu@34.225.194.2

# Navigate to project
cd EHealthMedAI

# Pull latest code
git pull origin main

# Install dependencies (if needed)
cd backend && npm install
cd ../frontend && npm install

# Restart PM2 services
pm2 restart all

# Or restart specific services
pm2 restart backend
pm2 restart frontend
```

### Step 3: Verify Endpoint is Live
```bash
curl -X POST https://ehealthmed.ai/api/test-telephony/auto-answer \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B17703434007&To=%2B18666068625&CallSid=test123"
```

**Expected Response**: XML TwiML response (not JSON error)

### Step 4: Test Again
```bash
node backend/scripts/test-auto-answer-call.js
```

---

## Quick Deploy Script

Create a file `deploy-auto-answer.sh`:

```bash
#!/bin/bash
echo "🚀 Deploying auto-answer endpoint to production..."

# SSH and deploy
ssh -i ~/ehealth-key-1766435634.pem ubuntu@34.225.194.2 << 'EOF'
cd EHealthMedAI
git pull origin main
cd backend && npm install
cd ..
pm2 restart backend
echo "✅ Deployment complete!"
EOF

echo "✅ Done! Test with: node backend/scripts/test-auto-answer-call.js"
```

Make it executable:
```bash
chmod +x deploy-auto-answer.sh
./deploy-auto-answer.sh
```

---

## Alternative: Use Existing Deploy Script

If you have `deploy-to-production.sh` or similar:

```bash
./deploy-to-production.sh
```

Then restart PM2:
```bash
ssh -i ~/ehealth-key-1766435634.pem ubuntu@34.225.194.2 "cd EHealthMedAI && pm2 restart backend"
```

---

## After Deployment

1. **Verify endpoint is accessible**:
   ```bash
   curl https://ehealthmed.ai/api/test-telephony/auto-answer
   ```
   Should return XML, not JSON error.

2. **Test the call**:
   ```bash
   node backend/scripts/test-auto-answer-call.js
   ```

3. **Check Twilio Console**:
   - Status should be "Completed" (not "Busy")
   - Duration should be > 0 seconds

---

## Why It's Not Working Now

- ✅ Code exists locally
- ✅ Route is registered in server.js
- ❌ **Not deployed to production EC2 server**
- ❌ Endpoint returns "Endpoint not found"

Once deployed, the endpoint will be accessible and calls will auto-answer!
