# EC2 Deployment Instructions

## Quick Deploy Commands

Since I cannot directly SSH into your EC2 server, here are the commands to run:

### Option 1: Run Script on EC2 (Recommended)

1. **SSH into your EC2 server:**
   ```bash
   ssh -i ~/ehealth-key-1766435634.pem ubuntu@34.225.194.2
   ```

2. **Once connected, run the deployment script:**
   ```bash
   cd /home/ubuntu/EHealthMedAI
   bash run-on-ec2-deploy.sh
   ```

   Or if the script isn't there yet, copy-paste these commands directly:

### Option 2: Manual Commands (Copy-Paste)

SSH into EC2 and run these commands one by one:

```bash
cd /home/ubuntu/EHealthMedAI

# Step 1: Backup .env files
cp backend/.env backend/.env.backup 2>/dev/null || true
cp frontend/.env frontend/.env.backup 2>/dev/null || true

# Step 2: Pull latest code
git stash push -m "Backup $(date)" 2>/dev/null || true
git fetch origin
git pull origin main || git reset --hard origin/main

# Step 3: Restore .env files
mv backend/.env.backup backend/.env 2>/dev/null || true
mv frontend/.env.backup frontend/.env 2>/dev/null || true

# Step 4: Load database credentials
cd backend
export $(grep -v '^#' .env | grep -v '^$' | xargs)

# Step 5: Run migration
psql "$DATABASE_URL" -f config/add-calendar-integration-to-agents.sql 2>&1 | grep -v "NOTICE:" || {
    # If file doesn't exist, run SQL directly
    psql "$DATABASE_URL" << 'SQL'
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS calendar_integration_id INTEGER REFERENCES integrations(id);

CREATE INDEX IF NOT EXISTS idx_ai_agents_calendar_integration ON ai_agents(calendar_integration_id);
SQL
}

# Step 6: Verify migration
psql "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_agents' AND column_name = 'calendar_integration_id';"

# Step 7: Install dependencies
cd /home/ubuntu/EHealthMedAI
cd backend && npm install --production
cd ../frontend && npm install --production

# Step 8: Build frontend
cd /home/ubuntu/EHealthMedAI/frontend
rm -rf .next
npm run build

# Step 9: Restart services
cd /home/ubuntu/EHealthMedAI
pm2 restart ehealth-backend || pm2 start ecosystem.config.js --only ehealth-backend
pm2 restart ehealth-frontend || pm2 start ecosystem.config.js --only ehealth-frontend

# Step 10: Check status
pm2 status
```

## Migrations to Run

### Migration 1: calendar_integration_id

**File**: `backend/config/add-calendar-integration-to-agents.sql`

**SQL**:
```sql
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS calendar_integration_id INTEGER REFERENCES integrations(id);

CREATE INDEX IF NOT EXISTS idx_ai_agents_calendar_integration ON ai_agents(calendar_integration_id);
```

**How to run**:
```bash
cd /home/ubuntu/EHealthMedAI/backend
export $(grep -v '^#' .env | xargs)
psql "$DATABASE_URL" -f config/add-calendar-integration-to-agents.sql
```

## Verification

After deployment, verify:

1. **Migration worked**:
   ```bash
   psql "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_agents' AND column_name = 'calendar_integration_id';"
   ```
   Should return 1 row.

2. **Services running**:
   ```bash
   pm2 status
   ```
   Should show both `ehealth-backend` and `ehealth-frontend` as online.

3. **Check logs**:
   ```bash
   pm2 logs
   ```

## Troubleshooting

### If migration fails:
- Check database connection: `psql "$DATABASE_URL" -c "SELECT 1;"`
- Check if table exists: `psql "$DATABASE_URL" -c "\d ai_agents"`
- Run SQL manually if needed

### If services don't start:
- Check PM2: `pm2 list`
- Check logs: `pm2 logs ehealth-backend`
- Manual start: `cd backend && pm2 start server.js --name ehealth-backend`

### If .env is missing:
- Restore from backup: `cp backend/.env.backup backend/.env`
- Or recreate from your notes

