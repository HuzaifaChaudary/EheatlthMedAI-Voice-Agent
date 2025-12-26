# Migration Status - All Integration Fixes

## ✅ Migrations Required

### 1. calendar_integration_id (Per-Agent Calendar) ⚠️ **NOT RUN YET**

**Status**: Migration script created, but **NOT EXECUTED**

**What it does**:
- Adds `calendar_integration_id` column to `ai_agents` table
- Allows each agent to have its own calendar integration
- Prevents cross-client calendar conflicts

**Migration File**: `backend/config/add-calendar-integration-to-agents.sql`

**Script**: `backend/scripts/run-calendar-integration-migration.js`

**To Run**:
```bash
# Option 1: Using script
node backend/scripts/run-calendar-integration-migration.js

# Option 2: Direct SQL
psql -d your_database -f backend/config/add-calendar-integration-to-agents.sql

# Option 3: Manual SQL
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS calendar_integration_id INTEGER REFERENCES integrations(id);

CREATE INDEX IF NOT EXISTS idx_ai_agents_calendar_integration ON ai_agents(calendar_integration_id);
```

## ✅ No Migration Needed (Code Only Changes)

### 2. Delete/Disconnect Calendar Integration
- ✅ Backend DELETE endpoint added
- ✅ Frontend delete button added
- **No migration needed** - uses existing `integrations` table

### 3. User Organization Assignment
- ✅ Backend accepts `organizationId` when creating users
- ✅ Frontend has organization dropdown
- **No migration needed** - uses existing `organization_id` column in `users` table

### 4. Multi-System Appointment Booking
- ✅ Appointment booking syncs to Calendar + CRM + EHR
- **No migration needed** - uses existing tables

### 5. Emergency Call Forwarding
- ✅ Emergency forwarding service created
- ✅ Integrated into AI functions
- **No migration needed** - uses existing `escalation_rules` JSONB column in `ai_agents`

### 6. Telephony Dashboard - Show Linked Agents
- ✅ Backend returns agent info with phone numbers
- ✅ Frontend displays linked agents
- **No migration needed** - uses existing relationships

## 📋 Summary

**Total Migrations Required**: **1**

**Status**: 
- ❌ **NOT RUN** - `calendar_integration_id` migration needs to be executed

**Impact if Not Run**:
- Per-agent calendar configuration will NOT work
- Agent calendar selector in UI will not save properly
- Appointments will fall back to organization-level calendar only

## 🚀 Quick Fix

Run this SQL in your database:

```sql
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS calendar_integration_id INTEGER REFERENCES integrations(id);

CREATE INDEX IF NOT EXISTS idx_ai_agents_calendar_integration ON ai_agents(calendar_integration_id);
```

Or use the script:
```bash
node backend/scripts/run-calendar-integration-migration.js
```

