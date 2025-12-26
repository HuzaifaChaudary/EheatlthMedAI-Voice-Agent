-- Add calendar_integration_id to ai_agents table for per-agent calendar configuration
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS calendar_integration_id INTEGER REFERENCES integrations(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_agents_calendar_integration ON ai_agents(calendar_integration_id);

-- Add comment
COMMENT ON COLUMN ai_agents.calendar_integration_id IS 'Calendar integration ID for this agent. Each agent can have its own calendar.';

