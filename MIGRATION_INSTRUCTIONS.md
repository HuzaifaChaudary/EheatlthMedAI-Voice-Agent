# Migration Instructions: Add calendar_integration_id to ai_agents

## Option 1: Run the Migration Script (Recommended)

If your database is configured in `.env`:

```bash
cd /Users/muhammadharis/Developer/EHealthMedAI
node backend/scripts/run-calendar-integration-migration.js
```

## Option 2: Run SQL Directly

If you prefer to run the SQL directly using `psql`:

```bash
psql -d your_database_name -f backend/config/add-calendar-integration-to-agents.sql
```

Or connect to your database and run:

```sql
-- Add calendar_integration_id to ai_agents table for per-agent calendar configuration
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS calendar_integration_id INTEGER REFERENCES integrations(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_agents_calendar_integration ON ai_agents(calendar_integration_id);

-- Add comment
COMMENT ON COLUMN ai_agents.calendar_integration_id IS 'Calendar integration ID for this agent. Each agent can have its own calendar.';
```

## Option 3: Using Database GUI Tool

1. Open your database management tool (pgAdmin, DBeaver, etc.)
2. Connect to your database
3. Open a SQL query window
4. Copy and paste the SQL from `backend/config/add-calendar-integration-to-agents.sql`
5. Execute the query

## Verification

After running the migration, verify it worked:

```sql
-- Check if column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ai_agents' 
AND column_name = 'calendar_integration_id';

-- Check if index exists
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'ai_agents' 
AND indexname = 'idx_ai_agents_calendar_integration';
```

## What This Migration Does

1. Adds `calendar_integration_id` column to `ai_agents` table
2. Creates a foreign key reference to `integrations(id)`
3. Creates an index for faster lookups
4. Adds a comment explaining the column's purpose

This allows each agent to have its own calendar integration, preventing cross-client calendar conflicts.

