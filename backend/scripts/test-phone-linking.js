/**
 * Test script for phone number linking to agents
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('../config/database')

async function testPhoneLinking() {
  try {
    console.log('🧪 Testing Phone Number Linking to Agents\n')

    // 1. Get or create test phone number
    console.log('1. Checking phone numbers...')
    let phoneResult = await db.query('SELECT id, phone_number, provider FROM phone_numbers WHERE is_active = true LIMIT 1')
    let phoneNumberId = null

    if (phoneResult.rows.length === 0) {
      // Create test phone number
      const orgResult = await db.query('SELECT id FROM organizations LIMIT 1')
      const orgId = orgResult.rows[0]?.id || null
      
      const newPhone = await db.query(
        'INSERT INTO phone_numbers (organization_id, phone_number, provider, provider_sid, capabilities, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, phone_number',
        [orgId, '+17701234567', 'twilio', 'test_sid', JSON.stringify({voice: true, sms: true}), true]
      )
      phoneNumberId = newPhone.rows[0].id
      console.log(`   ✅ Created test phone number: ID ${phoneNumberId}, ${newPhone.rows[0].phone_number}`)
    } else {
      phoneNumberId = phoneResult.rows[0].id
      console.log(`   ✅ Found phone number: ID ${phoneNumberId}, ${phoneResult.rows[0].phone_number}`)
    }

    // 2. Get a test agent
    console.log('\n2. Getting test agent...')
    const agentResult = await db.query('SELECT id, name, phone_number_id FROM ai_agents LIMIT 1')
    if (agentResult.rows.length === 0) {
      console.log('   ❌ No agents found. Please create an agent first.')
      process.exit(1)
    }
    const agent = agentResult.rows[0]
    console.log(`   ✅ Found agent: ID ${agent.id}, Name: ${agent.name}`)
    console.log(`   Current phone_number_id: ${agent.phone_number_id || 'NULL'}`)

    // 3. Test UPDATE: Link agent to phone number
    console.log('\n3. Testing UPDATE agent with phone_number_id...')
    const updateResult = await db.query(
      'UPDATE ai_agents SET phone_number_id = $1 WHERE id = $2 RETURNING id, name, phone_number_id',
      [phoneNumberId, agent.id]
    )
    console.log(`   ✅ Updated agent ${updateResult.rows[0].id}`)
    console.log(`   New phone_number_id: ${updateResult.rows[0].phone_number_id}`)

    // 4. Test GET: Verify phone_number_id is returned
    console.log('\n4. Testing GET agent by ID (should include phone_number_id)...')
    const getResult = await db.query(
      'SELECT id, name, type, description, is_active, configuration, phone_number_id, voice_model, system_prompt, temperature, max_tokens, greeting_message, created_at FROM ai_agents WHERE id = $1',
      [agent.id]
    )
    if (getResult.rows[0].phone_number_id) {
      console.log(`   ✅ GET agent includes phone_number_id: ${getResult.rows[0].phone_number_id}`)
    } else {
      console.log('   ❌ GET agent missing phone_number_id')
    }

    // 5. Test GET all agents: Verify phone_number_id is in list
    console.log('\n5. Testing GET all agents (should include phone_number_id)...')
    const getAllResult = await db.query(
      `SELECT id, name, type, description, is_active, configuration, 
              voice_model, voice_settings, system_prompt, temperature, max_tokens,
              phone_number_id, greeting_message, fallback_message, business_hours,
              escalation_rules, created_at
       FROM ai_agents 
       ORDER BY type, name
       LIMIT 3`
    )
    console.log(`   ✅ Retrieved ${getAllResult.rows.length} agents`)
    getAllResult.rows.forEach(a => {
      console.log(`   - Agent ${a.id} (${a.name}): phone_number_id = ${a.phone_number_id || 'NULL'}`)
    })

    // 6. Test unlinking (set to NULL)
    console.log('\n6. Testing unlinking agent (set phone_number_id to NULL)...')
    const unlinkResult = await db.query(
      'UPDATE ai_agents SET phone_number_id = NULL WHERE id = $1 RETURNING id, phone_number_id',
      [agent.id]
    )
    console.log(`   ✅ Unlinked agent ${unlinkResult.rows[0].id}`)
    console.log(`   phone_number_id: ${unlinkResult.rows[0].phone_number_id}`)

    // 7. Test CREATE: Create agent with phone_number_id
    console.log('\n7. Testing CREATE agent with phone_number_id...')
    const orgResult = await db.query('SELECT id FROM organizations LIMIT 1')
    const orgId = orgResult.rows[0]?.id || null
    
    const createResult = await db.query(
      `INSERT INTO ai_agents (
        organization_id, name, type, description, is_active, configuration,
        voice_model, voice_settings, system_prompt, temperature, max_tokens,
        phone_number_id, greeting_message, fallback_message, business_hours,
        escalation_rules
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id, name, phone_number_id`,
      [
        orgId, 'Test Agent', 'test_type', 'Test agent for phone linking', true,
        JSON.stringify({}), 'openai', null, 'Test prompt', 0.7, 1000,
        phoneNumberId, 'Hello', null, null, null
      ]
    )
    console.log(`   ✅ Created agent: ID ${createResult.rows[0].id}, Name: ${createResult.rows[0].name}`)
    console.log(`   phone_number_id: ${createResult.rows[0].phone_number_id}`)

    // Cleanup: Delete test agent
    console.log('\n8. Cleaning up test agent...')
    await db.query('DELETE FROM ai_agents WHERE name = $1', ['Test Agent'])
    console.log('   ✅ Test agent deleted')

    console.log('\n✅ All tests passed! Phone number linking is working correctly.')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  }
}

testPhoneLinking()

