/**
 * Script to create default agents for production
 * Usage: node scripts/create-production-agents.js [organization_id]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('../config/database')

const defaultAgents = [
  {
    name: 'Front Desk Assistant',
    type: 'Front Desk Assistant',
    description: 'Handles appointment scheduling, patient check-ins, and general inquiries',
    is_active: true
  },
  {
    name: 'Medical Assistant',
    type: 'Medical Assistant',
    description: 'Assists with medical information, symptom assessment, and care coordination',
    is_active: true
  },
  {
    name: 'Triage Nurse',
    type: 'Triage Nurse',
    description: 'Performs initial patient assessment and prioritizes care based on urgency',
    is_active: true
  },
  {
    name: 'Billing Specialist',
    type: 'Billing Specialist',
    description: 'Manages billing inquiries, payment processing, and insurance questions',
    is_active: true
  },
  {
    name: 'Collections Specialist',
    type: 'Collections Specialist',
    description: 'Handles payment collections and payment plan arrangements',
    is_active: true
  }
]

async function createProductionAgents() {
  try {
    let orgId = process.argv[2] // Get from command line if provided
    
    // If not provided, get the first organization
    if (!orgId) {
      const orgResult = await db.query('SELECT id FROM organizations ORDER BY id LIMIT 1')
      if (orgResult.rows.length > 0) {
        orgId = orgResult.rows[0].id
        console.log(`Using organization ID: ${orgId}`)
      } else {
        console.log('No organization found. Creating agents without organization_id...')
      }
    }

    let createdCount = 0
    let existingCount = 0

    for (const agent of defaultAgents) {
      try {
        // Check if agent already exists for this organization
        let checkQuery
        if (orgId) {
          checkQuery = await db.query(
            'SELECT id FROM ai_agents WHERE name = $1 AND type = $2 AND organization_id = $3',
            [agent.name, agent.type, orgId]
          )
        } else {
          checkQuery = await db.query(
            'SELECT id FROM ai_agents WHERE name = $1 AND type = $2 AND organization_id IS NULL',
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
    console.log(`  Organization ID: ${orgId || 'NULL (global)'}`)

    process.exit(0)
  } catch (error) {
    console.error('Error creating production agents:', error)
    process.exit(1)
  }
}

createProductionAgents()

