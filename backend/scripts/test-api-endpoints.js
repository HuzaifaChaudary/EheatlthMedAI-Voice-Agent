/**
 * Test API endpoints for phone number linking
 * Make sure backend is running: npm run dev (in backend directory)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const jwt = require('jsonwebtoken')

const API_URL = process.env.API_URL || 'http://localhost:5000/api'
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret'

// Create a test token (you may need to adjust userId based on your actual user)
const testToken = jwt.sign(
  { userId: 1, email: 'test@test.com', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
)

async function testEndpoints() {
  console.log('🧪 Testing API Endpoints for Phone Number Linking\n')
  console.log(`API URL: ${API_URL}\n`)

  const headers = {
    'Authorization': `Bearer ${testToken}`,
    'Content-Type': 'application/json'
  }

  try {
    // 1. GET phone numbers
    console.log('1. GET /telephony/phone-numbers')
    const phoneRes = await fetch(`${API_URL}/telephony/phone-numbers`, { headers })
    const phoneData = await phoneRes.json()
    console.log(`   Status: ${phoneRes.status}`)
    if (phoneData.phone_numbers && phoneData.phone_numbers.length > 0) {
      const phoneId = phoneData.phone_numbers[0].id
      console.log(`   ✅ Found ${phoneData.phone_numbers.length} phone number(s)`)
      console.log(`   First phone number ID: ${phoneId}`)
      
      // 2. GET all agents
      console.log('\n2. GET /agents')
      const agentsRes = await fetch(`${API_URL}/agents`, { headers })
      const agentsData = await agentsRes.json()
      console.log(`   Status: ${agentsRes.status}`)
      if (agentsData.agents && agentsData.agents.length > 0) {
        const agentId = agentsData.agents[0].id
        console.log(`   ✅ Found ${agentsData.agents.length} agent(s)`)
        console.log(`   First agent ID: ${agentId}`)
        console.log(`   First agent phone_number_id: ${agentsData.agents[0].phone_number_id || 'NULL'}`)

        // 3. GET agent by ID
        console.log(`\n3. GET /agents/${agentId}`)
        const agentRes = await fetch(`${API_URL}/agents/${agentId}`, { headers })
        const agentData = await agentRes.json()
        console.log(`   Status: ${agentRes.status}`)
        if (agentData.agent) {
          console.log(`   ✅ Agent retrieved: ${agentData.agent.name}`)
          console.log(`   phone_number_id: ${agentData.agent.phone_number_id || 'NULL'}`)
          console.log(`   Has phone_number_id field: ${agentData.agent.hasOwnProperty('phone_number_id')}`)
        }

        // 4. UPDATE agent with phone_number_id
        console.log(`\n4. PUT /agents/${agentId} (link to phone number ${phoneId})`)
        const updateRes = await fetch(`${API_URL}/agents/${agentId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            phone_number_id: phoneId,
            system_prompt: agentData.agent.system_prompt || 'Test prompt',
            is_active: agentData.agent.is_active,
            voice_model: agentData.agent.voice_model || 'openai'
          })
        })
        const updateData = await updateRes.json()
        console.log(`   Status: ${updateRes.status}`)
        if (updateData.agent) {
          console.log(`   ✅ Agent updated`)
          console.log(`   phone_number_id: ${updateData.agent.phone_number_id || 'NULL'}`)
        } else {
          console.log(`   Response:`, JSON.stringify(updateData, null, 2))
        }

        // 5. Verify update worked
        console.log(`\n5. GET /agents/${agentId} (verify update)`)
        const verifyRes = await fetch(`${API_URL}/agents/${agentId}`, { headers })
        const verifyData = await verifyRes.json()
        if (verifyData.agent && verifyData.agent.phone_number_id == phoneId) {
          console.log(`   ✅ Phone number linked correctly: ${verifyData.agent.phone_number_id}`)
        } else {
          console.log(`   ⚠️  Phone number not linked. Current: ${verifyData.agent?.phone_number_id || 'NULL'}`)
        }

        // 6. CREATE new agent with phone_number_id
        console.log(`\n6. POST /agents (create with phone_number_id)`)
        const createRes = await fetch(`${API_URL}/agents`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: 'API Test Agent',
            type: 'test_type',
            description: 'Test agent created via API',
            phone_number_id: phoneId,
            voice_model: 'openai',
            is_active: true,
            configuration: {},
            system_prompt: 'You are a test agent.'
          })
        })
        const createData = await createRes.json()
        console.log(`   Status: ${createRes.status}`)
        if (createData.agent) {
          console.log(`   ✅ Agent created: ID ${createData.agent.id}`)
          console.log(`   phone_number_id: ${createData.agent.phone_number_id || 'NULL'}`)
          
          // Cleanup: Delete test agent
          console.log(`\n7. DELETE test agent (cleanup)`)
          // Note: There might not be a DELETE endpoint, so we'll just note it
          console.log(`   ℹ️  Test agent ID ${createData.agent.id} should be deleted manually if needed`)
        } else {
          console.log(`   Response:`, JSON.stringify(createData, null, 2))
        }

      } else {
        console.log('   ⚠️  No agents found')
      }
    } else {
      console.log('   ⚠️  No phone numbers found. Please add a phone number first.')
    }

    console.log('\n✅ API endpoint tests completed!')
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    if (error.message.includes('fetch')) {
      console.error('   Make sure the backend server is running: cd backend && npm run dev')
    }
  }
}

testEndpoints()

