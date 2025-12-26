# Run Migration: calendar_integration_id

## Quick Run

The migration script is ready. You can run it in one of these ways:

### Method 1: Using Node.js Script (if database is configured in .env)

```bash
cd /Users/muhammadharis/Developer/EHealthMedAI
node backend/scripts/run-calendar-integration-migration.js
```

### Method 2: Direct SQL (Recommended)

Connect to your PostgreSQL database and run:

```sql
-- Add calendar_integration_id to ai_agents table
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS calendar_integration_id INTEGER REFERENCES integrations(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_agents_calendar_integration ON ai_agents(calendar_integration_id);

-- Add comment
COMMENT ON COLUMN ai_agents.calendar_integration_id IS 'Calendar integration ID for this agent. Each agent can have its own calendar.';
```

### Method 3: Using psql command line

```bash
psql -d your_database_name -f backend/config/add-calendar-integration-to-agents.sql
```

## What This Does

- ✅ Adds `calendar_integration_id` column to `ai_agents` table
- ✅ Links it to `integrations(id)` via foreign key
- ✅ Creates index for performance
- ✅ Safe to run multiple times (uses `IF NOT EXISTS`)

## After Migration

Once the migration is complete, you can:
1. Go to any agent configuration page
2. Select a calendar from the dropdown
3. Save - the agent will now use that calendar for appointments

The migration is **idempotent** - safe to run multiple times.

