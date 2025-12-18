/**
 * Script to create default AI agents
 * Usage: node scripts/create-default-agents.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('../config/database')

const defaultAgents = [
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

async function createDefaultAgents() {
  try {
    // Get or create default organization
    let orgId = null
    try {
      const orgResult = await db.query('SELECT id FROM organizations LIMIT 1')
      if (orgResult.rows.length > 0) {
        orgId = orgResult.rows[0].id
      } else {
        // Create default organization
        const newOrg = await db.query(
          `INSERT INTO organizations (name, subdomain, is_active, subscription_tier, max_agents, max_users, max_calls_per_month)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          ['Default Organization', 'default', true, 'enterprise', 100, 1000, 100000]
        )
        orgId = newOrg.rows[0].id
        console.log(`✓ Created default organization (ID: ${orgId})`)
      }
    } catch (error) {
      // Organization table might not exist, continue without it
      console.log('Note: Organization not set (table may not exist)')
    }

    let createdCount = 0
    let existingCount = 0

    for (const agent of defaultAgents) {
      try {
        // Check if agent already exists
        let checkQuery
        if (orgId) {
          checkQuery = await db.query(
            'SELECT id FROM ai_agents WHERE name = $1 AND type = $2 AND organization_id = $3',
            [agent.name, agent.type, orgId]
          )
        } else {
          checkQuery = await db.query(
            'SELECT id FROM ai_agents WHERE name = $1 AND type = $2',
            [agent.name, agent.type]
          )
        }

        if (checkQuery.rows.length > 0) {
          existingCount++
          console.log(`- Agent "${agent.name}" already exists`)
          continue
        }

        // Create agent
        let result
        if (orgId) {
          result = await db.query(
            `INSERT INTO ai_agents (organization_id, name, type, description, is_active, voice_model, temperature, max_tokens)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, name, type`,
            [orgId, agent.name, agent.type, agent.description, agent.is_active, 'openai', 0.7, 1000]
          )
        } else {
          result = await db.query(
            `INSERT INTO ai_agents (name, type, description, is_active, voice_model, temperature, max_tokens)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, name, type`,
            [agent.name, agent.type, agent.description, agent.is_active, 'openai', 0.7, 1000]
          )
        }

        createdCount++
        console.log(`✓ Created agent: ${agent.name} (${agent.type})`)
      } catch (error) {
        if (error.code === '23505') {
          // Unique constraint violation
          existingCount++
          console.log(`- Agent "${agent.name}" already exists`)
        } else {
          console.error(`Error creating agent "${agent.name}":`, error.message)
        }
      }
    }

    console.log(`\n✓ Summary:`)
    console.log(`  Created: ${createdCount} agents`)
    console.log(`  Already existed: ${existingCount} agents`)
    console.log(`  Total: ${createdCount + existingCount} agents`)

    process.exit(0)
  } catch (error) {
    console.error('Error creating default agents:', error)
    process.exit(1)
  }
}

createDefaultAgents()

