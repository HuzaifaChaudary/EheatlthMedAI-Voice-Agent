#!/bin/bash
# Run Migration Script
# This adds calendar_integration_id column to ai_agents table

cd /Users/muhammadharis/Developer/EHealthMedAI

# Use your DATABASE_URL directly
psql postgresql://ehealthmedai:str0ng@localhost:5432/ehealthmedai -f backend/config/add-calendar-integration-to-agents.sql

# Verify it worked
echo ""
echo "Verifying migration..."
psql postgresql://ehealthmedai:str0ng@localhost:5432/ehealthmedai -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_agents' AND column_name = 'calendar_integration_id';"

echo ""
echo "✅ Migration complete! Check output above."

