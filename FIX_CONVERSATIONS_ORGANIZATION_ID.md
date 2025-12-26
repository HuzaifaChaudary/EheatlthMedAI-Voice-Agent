# Fix: Missing organization_id in conversations table

## Problem

When trying to make a test call, the client got this error:
```
Error: column "organization_id" of relation "conversations" does not exist
```

## Root Cause

The `conversations` table in the database is missing the `organization_id` column, but the code tries to insert conversations with `organization_id` for multi-tenancy support.

## Solution

### 1. **Database Migration**

Run the migration script to add the `organization_id` column:

```bash
# On local:
node backend/scripts/add-organization-id-to-conversations.js

# On production (SSH to server):
cd /home/ubuntu/EHealthMedAI
node backend/scripts/add-organization-id-to-conversations.js
```

**What it does:**
- Adds `organization_id` column to `conversations` table
- Creates index for better performance
- Updates existing conversations with organization_id based on:
  - User's organization (if conversation has user_id)
  - Agent's organization (if conversation has agent_id)

### 2. **Code Updates (Already Done)**

I've updated the code to handle the missing column gracefully:

**Files Updated:**
- ✅ `backend/services/telephonyService.js` - Added fallback for missing column
- ✅ `backend/routes/telephony.js` - Added fallback for missing column  
- ✅ `backend/services/smsService.js` - Added fallback for missing column
- ✅ `backend/config/db.sql` - Updated schema to include organization_id

**How it works:**
- Code tries to insert with `organization_id` first
- If column doesn't exist, falls back to insert without it
- This allows the code to work even before migration runs

## Testing Locally

1. **Run the migration:**
   ```bash
   node backend/scripts/add-organization-id-to-conversations.js
   ```

2. **Test making a call:**
   - Go to Telephony page
   - Click "Make Call"
   - Fill in phone numbers and agent
   - Click "Make Call" button
   - Should work without errors

3. **Verify in database:**
   ```sql
   SELECT id, organization_id, agent_id, patient_phone, status 
   FROM conversations 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

## Production Deployment

1. **SSH to production server:**
   ```bash
   ssh ubuntu@34.225.194.2
   ```

2. **Navigate to project:**
   ```bash
   cd /home/ubuntu/EHealthMedAI
   ```

3. **Pull latest code:**
   ```bash
   git pull origin main
   ```

4. **Run migration:**
   ```bash
   node backend/scripts/add-organization-id-to-conversations.js
   ```

5. **Restart backend (if needed):**
   ```bash
   pm2 restart ehealth-backend
   ```

## Verification

After running the migration, verify:

1. **Column exists:**
   ```sql
   \d conversations
   ```
   Should show `organization_id` column

2. **Index exists:**
   ```sql
   \d conversations
   ```
   Should show `idx_conversations_organization_id` index

3. **Test call works:**
   - Try making a test call from UI
   - Should not show the error anymore

## Files Changed

1. **Migration Script:**
   - `backend/scripts/add-organization-id-to-conversations.js` (NEW)

2. **SQL Migration:**
   - `backend/config/add-organization-id-to-conversations.sql` (NEW)

3. **Code Updates:**
   - `backend/services/telephonyService.js` - Added fallback
   - `backend/routes/telephony.js` - Added fallback
   - `backend/services/smsService.js` - Added fallback
   - `backend/config/db.sql` - Updated schema

## Notes

- The migration is **safe to run multiple times** - it checks if column exists first
- Existing conversations will be updated with organization_id based on user/agent
- New conversations will automatically have organization_id set
- The code has fallbacks, so it works even if migration hasn't run yet (but organization_id won't be set)

