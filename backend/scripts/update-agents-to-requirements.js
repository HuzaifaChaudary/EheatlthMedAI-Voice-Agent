/**
 * Script to update agents to match requirements
 * Removes Billing Specialist and Collections Specialist
 * Updates agent names and descriptions to match requirements
 * Usage: node scripts/update-agents-to-requirements.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('../config/database')

const requiredAgents = [
  {
    name: 'Front Desk',
    type: 'front_desk',
    description: 'Role-specific voice agent for appointment booking, reminders, and medication refill requests',
    is_active: true
  },
  {
    name: 'Medical Assistant',
    type: 'medical_assistant',
    description: 'Role-specific voice agent for pre-visit intake, EMR documentation hooks, and care coordination',
    is_active: true
  },
  {
    name: 'Triage Nurse Assistant',
    type: 'triage_nurse',
    description: 'Role-specific voice agent for triage, symptom checker with red-flag escalation, and initial patient assessment',
    is_active: true
  }
]

async function updateAgents() {
  try {
    console.log('Updating agents to match requirements...\n')

    // Delete agents that are not in the requirements
    const agentsToDelete = ['billing_specialist', 'collections_specialist']
    
    for (const type of agentsToDelete) {
      try {
        const deleteResult = await db.query(
          'DELETE FROM ai_agents WHERE type = $1',
          [type]
        )
        console.log(`✓ Deleted agents with type: ${type}`)
      } catch (error) {
        console.log(`- Could not delete ${type}: ${error.message}`)
      }
    }

    // Update or create required agents
    for (const agent of requiredAgents) {
      try {
        // Check if agent exists by type
        const existing = await db.query(
          'SELECT id FROM ai_agents WHERE type = $1 LIMIT 1',
          [agent.type]
        )

        if (existing.rows.length > 0) {
          // Update existing agent
          await db.query(
            `UPDATE ai_agents 
             SET name = $1, description = $2, is_active = $3
             WHERE type = $4`,
            [agent.name, agent.description, agent.is_active, agent.type]
          )
          console.log(`✓ Updated agent: ${agent.name} (${agent.type})`)
        } else {
          // Create new agent
          // Try to get organization_id
          let orgId = null
          try {
            const orgResult = await db.query('SELECT id FROM organizations LIMIT 1')
            if (orgResult.rows.length > 0) {
              orgId = orgResult.rows[0].id
            }
          } catch (error) {
            // Organization table might not exist
          }

          if (orgId) {
            await db.query(
              `INSERT INTO ai_agents (organization_id, name, type, description, is_active, voice_model, temperature, max_tokens)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [orgId, agent.name, agent.type, agent.description, agent.is_active, 'openai', 0.7, 1000]
            )
          } else {
            await db.query(
              `INSERT INTO ai_agents (name, type, description, is_active, voice_model, temperature, max_tokens)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [agent.name, agent.type, agent.description, agent.is_active, 'openai', 0.7, 1000]
            )
          }
          console.log(`✓ Created agent: ${agent.name} (${agent.type})`)
        }
      } catch (error) {
        console.error(`Error processing agent "${agent.name}":`, error.message)
      }
    }

    console.log('\n✓ Agent update complete!')
    console.log('\nRequired agents:')
    requiredAgents.forEach(agent => {
      console.log(`  - ${agent.name} (${agent.type})`)
    })

    process.exit(0)
  } catch (error) {
    console.error('Error updating agents:', error)
    process.exit(1)
  }
}

updateAgents()

