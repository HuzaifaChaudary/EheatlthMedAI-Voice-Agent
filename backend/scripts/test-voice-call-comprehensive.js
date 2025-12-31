/**
 * Comprehensive Voice Call Test
 * Tests the complete call flow from initiation to connection
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const { Pool } = require('pg');

const API_URL = 'https://ehealthmed.ai';
const BASE_URL = `${API_URL}/api`;
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiY2hodXphaWZhaWZ0aWtoYXJAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzY3MjE3ODczLCJleHAiOjE3Njc4MjI2NzN9.U5aZO_1PBYqibEXKUZbGc5iTKqWCXMwnyQAWA3z7_M8';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://ehealthmedai:str0ng@localhost:5432/ehealthmedai'
});

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkPhoneNumberSetup() {
  log('\n📞 Checking Phone Number Setup...', 'cyan');
  
  try {
    // Get phone numbers
    const response = await axios.get(`${BASE_URL}/telephony/phone-numbers`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const phoneNumbers = response.data.phone_numbers || [];
    
    // Find target phone (404-738-7870)
    const targetPhone = phoneNumbers.find(pn => 
      pn.phone_number.includes('4047387870') || 
      pn.phone_number.includes('404-738-7870')
    );
    
    if (!targetPhone) {
      log('❌ Target phone number (404-738-7870) not found', 'red');
      log('Available phone numbers:', 'yellow');
      phoneNumbers.forEach(pn => {
        log(`   - ${pn.phone_number} (ID: ${pn.id}, Active: ${pn.is_active})`, 'blue');
      });
      return null;
    }
    
    log(`✅ Found target phone: ${targetPhone.phone_number} (ID: ${targetPhone.id})`, 'green');
    log(`   Status: ${targetPhone.is_active ? 'Active' : 'Inactive'}`, 'blue');
    log(`   Provider: ${targetPhone.provider}`, 'blue');
    log(`   Linked Agent: ${targetPhone.agent_id ? `ID ${targetPhone.agent_id}` : 'None'}`, 'blue');
    
    // Check agent
    if (targetPhone.agent_id) {
      const agentResponse = await axios.get(`${BASE_URL}/agents/${targetPhone.agent_id}`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
      const agent = agentResponse.data.agent;
      log(`   Agent Name: ${agent.name}`, 'blue');
      log(`   Agent Type: ${agent.type}`, 'blue');
      log(`   Agent Active: ${agent.is_active}`, 'blue');
    } else {
      log('⚠️  Phone number not linked to any agent!', 'yellow');
    }
    
    // Find from phone (+17703434007)
    const fromPhone = phoneNumbers.find(pn => 
      pn.phone_number.includes('17703434007') ||
      pn.phone_number.includes('770-343-4007')
    );
    
    if (!fromPhone) {
      log('⚠️  From phone (+17703434007) not found, will use first active phone', 'yellow');
      return { targetPhone, fromPhone: phoneNumbers.find(pn => pn.is_active) || phoneNumbers[0] };
    }
    
    log(`✅ Found from phone: ${fromPhone.phone_number} (ID: ${fromPhone.id})`, 'green');
    
    return { targetPhone, fromPhone };
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return null;
  }
}

async function checkTwilioConfig() {
  log('\n🔧 Checking Twilio Configuration...', 'cyan');
  
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!twilioSid || !twilioToken) {
    log('❌ Twilio not configured!', 'red');
    log(`   TWILIO_ACCOUNT_SID: ${twilioSid ? 'Set' : 'Missing'}`, 'yellow');
    log(`   TWILIO_AUTH_TOKEN: ${twilioToken ? 'Set' : 'Missing'}`, 'yellow');
    return false;
  }
  
  log(`✅ Twilio Account SID: ${twilioSid.substring(0, 10)}...`, 'green');
  log(`✅ Twilio Auth Token: ${twilioToken ? 'Set' : 'Missing'}`, 'green');
  
  // Check webhook URL
  const webhookUrl = `${API_URL}/api/telephony/twilio/inbound`;
  log(`   Webhook URL: ${webhookUrl}`, 'blue');
  
  return true;
}

async function checkAgentConfig(agentId) {
  log('\n🤖 Checking Agent Configuration...', 'cyan');
  
  try {
    const response = await axios.get(`${BASE_URL}/agents/${agentId}`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const agent = response.data.agent;
    
    log(`✅ Agent: ${agent.name} (ID: ${agent.id})`, 'green');
    log(`   Type: ${agent.type}`, 'blue');
    log(`   Active: ${agent.is_active}`, 'blue');
    log(`   Voice Model: ${agent.voice_model || 'Not set'}`, 'blue');
    log(`   System Prompt: ${agent.system_prompt ? 'Set' : 'Missing'}`, 'blue');
    
    // Check OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      log('⚠️  OPENAI_API_KEY not set - AI responses will fail!', 'yellow');
    } else {
      log(`✅ OPENAI_API_KEY: Set`, 'green');
    }
    
    return agent;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return null;
  }
}

async function makeTestCall(fromPhoneId, toNumber, agentId) {
  log('\n📞 Making Test Call...', 'cyan');
  log(`   From Phone ID: ${fromPhoneId}`, 'blue');
  log(`   To: ${toNumber}`, 'blue');
  log(`   Agent ID: ${agentId}`, 'blue');
  
  try {
    const response = await axios.post(
      `${BASE_URL}/telephony/calls/make`,
      {
        phone_number_id: fromPhoneId,
        to: toNumber,
        agent_id: agentId
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    log('\n✅ Call Initiated!', 'green');
    log(`   Call SID: ${response.data.callSid}`, 'blue');
    log(`   Call Log ID: ${response.data.callLogId}`, 'blue');
    log(`   Conversation ID: ${response.data.conversationId}`, 'blue');
    log(`   Status: ${response.data.status}`, 'blue');
    
    return response.data;
  } catch (error) {
    log(`\n❌ Error making call: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Error: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return null;
  }
}

async function checkCallStatus(callSid) {
  log('\n📊 Checking Call Status...', 'cyan');
  
  try {
    // Check via database
    const result = await pool.query(
      'SELECT * FROM call_logs WHERE provider_call_id = $1 ORDER BY created_at DESC LIMIT 1',
      [callSid]
    );
    
    if (result.rows.length > 0) {
      const callLog = result.rows[0];
      log(`✅ Call Log Found:`, 'green');
      log(`   ID: ${callLog.id}`, 'blue');
      log(`   Status: ${callLog.status}`, 'blue');
      log(`   Direction: ${callLog.direction}`, 'blue');
      log(`   Started: ${callLog.started_at}`, 'blue');
      log(`   Ended: ${callLog.ended_at || 'Still active'}`, 'blue');
      log(`   Duration: ${callLog.duration || 'N/A'}`, 'blue');
      
      return callLog;
    } else {
      log('⚠️  Call log not found in database', 'yellow');
      return null;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return null;
  }
}

async function checkDatabasePhoneNumbers() {
  log('\n🗄️  Checking Database Phone Numbers...', 'cyan');
  
  try {
    const result = await pool.query(
      'SELECT id, phone_number, is_active, agent_id, provider FROM phone_numbers ORDER BY created_at DESC LIMIT 10'
    );
    
    log(`Found ${result.rows.length} phone numbers:`, 'blue');
    result.rows.forEach(pn => {
      log(`   ${pn.phone_number} (ID: ${pn.id}, Active: ${pn.is_active}, Agent: ${pn.agent_id || 'None'})`, 'blue');
    });
    
    return result.rows;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return [];
  }
}

async function main() {
  log('\n🚀 Comprehensive Voice Call Test\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // Step 1: Check phone number setup
  const phoneSetup = await checkPhoneNumberSetup();
  if (!phoneSetup) {
    log('\n❌ Cannot proceed without phone number setup', 'red');
    return;
  }
  
  const { targetPhone, fromPhone } = phoneSetup;
  
  // Step 2: Check Twilio config
  const twilioOk = await checkTwilioConfig();
  if (!twilioOk) {
    log('\n❌ Cannot proceed without Twilio configuration', 'red');
    return;
  }
  
  // Step 3: Check agent config
  if (!targetPhone.agent_id) {
    log('\n⚠️  Target phone not linked to agent. Linking...', 'yellow');
    // Get first active agent
    const agentsResponse = await axios.get(`${BASE_URL}/agents`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    const agents = agentsResponse.data.agents || [];
    const agent = agents.find(a => a.is_active) || agents[0];
    
    if (agent) {
      // Link phone to agent
      await axios.put(
        `${BASE_URL}/telephony/phone-numbers/${targetPhone.id}/link-agent`,
        { agent_id: agent.id },
        { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } }
      );
      log(`✅ Linked phone to agent ${agent.id}`, 'green');
      targetPhone.agent_id = agent.id;
    }
  }
  
  const agent = await checkAgentConfig(targetPhone.agent_id);
  if (!agent) {
    log('\n❌ Cannot proceed without agent', 'red');
    return;
  }
  
  // Step 4: Check database
  await checkDatabasePhoneNumbers();
  
  // Step 5: Make test call
  log('\n📞 Ready to make test call...', 'cyan');
  log('   This will call 404-738-7870', 'yellow');
  log('   Answer the call when it rings!', 'yellow');
  
  const callResult = await makeTestCall(
    fromPhone.id,
    '404-738-7870',
    targetPhone.agent_id
  );
  
  if (callResult) {
    // Wait a bit
    log('\n⏳ Waiting 5 seconds for call to connect...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check call status
    await checkCallStatus(callResult.callSid);
    
    log('\n📝 Next Steps:', 'cyan');
    log('   1. Answer the call when it rings', 'yellow');
    log('   2. Say: "I want to book an appointment"', 'yellow');
    log('   3. Provide your name and date/time', 'yellow');
    log('   4. Check backend logs for any errors', 'yellow');
  }
  
  log('\n✅ Test completed!', 'green');
}

main()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    pool.end();
    process.exit(1);
  });
