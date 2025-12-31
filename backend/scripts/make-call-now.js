/**
 * Make Test Call - Quick Script
 * Calls from +17703434007 to 404-738-7870
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const API_URL = 'https://ehealthmed.ai';
const BASE_URL = `${API_URL}/api`;

// Auth token from browser
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiY2hodXphaWZhaWZ0aWtoYXJAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzY3MjE3ODczLCJleHAiOjE3Njc4MjI2NzN9.U5aZO_1PBYqibEXKUZbGc5iTKqWCXMwnyQAWA3z7_M8';

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

async function getPhoneNumbers() {
  try {
    const response = await axios.get(`${BASE_URL}/telephony/phone-numbers`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    return response.data.phone_numbers || [];
  } catch (error) {
    log(`Error: ${error.message}`, 'red');
    return [];
  }
}

async function getAgents() {
  try {
    const response = await axios.get(`${BASE_URL}/agents`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    return response.data.agents || [];
  } catch (error) {
    log(`Error: ${error.message}`, 'red');
    return [];
  }
}

async function makeCall(fromPhoneId, toNumber, agentId) {
  log('\n📞 Making outbound call...', 'cyan');
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
    
    log('\n✅ Call initiated successfully!', 'green');
    log(`   Call SID: ${response.data.callSid}`, 'blue');
    log(`   Call Log ID: ${response.data.callLogId}`, 'blue');
    log(`   Conversation ID: ${response.data.conversationId}`, 'blue');
    log(`   Status: ${response.data.status}`, 'blue');
    
    log('\n📝 Next Steps:', 'cyan');
    log('   1. Answer the call when it rings', 'yellow');
    log('   2. Say: "I want to book an appointment"', 'yellow');
    log('   3. Provide your name and preferred date/time', 'yellow');
    log('   4. The bot will book the appointment and sync to Google Calendar', 'yellow');
    log('   5. Check backend logs for: 📅 APPOINTMENT BOOKED and 📅 GOOGLE CALENDAR SYNC SUCCESS', 'yellow');
    
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

async function main() {
  log('\n🚀 Making Test Call\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // Get phone numbers
  log('\n📞 Fetching phone numbers...', 'cyan');
  const phoneNumbers = await getPhoneNumbers();
  
  if (phoneNumbers.length === 0) {
    log('❌ No phone numbers found. Please add phone numbers first.', 'red');
    return;
  }
  
  log(`✅ Found ${phoneNumbers.length} phone number(s):`, 'green');
  phoneNumbers.forEach((pn, idx) => {
    log(`   ${idx + 1}. ${pn.phone_number} (ID: ${pn.id}) - ${pn.is_active ? 'Active' : 'Inactive'}`, 'blue');
    if (pn.agent_name) {
      log(`      Linked Agent: ${pn.agent_name} (ID: ${pn.agent_id})`, 'blue');
    }
  });
  
  // Find from phone number (+17703434007)
  let fromPhone = phoneNumbers.find(pn => 
    pn.phone_number === '+17703434007' || 
    pn.phone_number === '17703434007' ||
    pn.phone_number.includes('17703434007')
  );
  
  // If not found, add it
  if (!fromPhone) {
    log('\n⚠️  Phone number +17703434007 not found. Adding it...', 'yellow');
    try {
      const addResponse = await axios.post(
        `${BASE_URL}/telephony/phone-numbers`,
        {
          phone_number: '+17703434007',
          provider: 'twilio',
          capabilities: { voice: true, sms: true },
          is_active: true
        },
        {
          headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      fromPhone = addResponse.data.phone_number;
      log(`✅ Added phone number: ${fromPhone.phone_number} (ID: ${fromPhone.id})`, 'green');
    } catch (error) {
      log(`❌ Error adding phone number: ${error.message}`, 'red');
      // Use existing phone number as fallback
      fromPhone = phoneNumbers.find(pn => pn.is_active) || phoneNumbers[0];
      log(`⚠️  Using existing phone number: ${fromPhone.phone_number} (ID: ${fromPhone.id})`, 'yellow');
    }
  }
  
  log(`\n✅ Found from phone: ${fromPhone.phone_number} (ID: ${fromPhone.id})`, 'green');
  
  // Get agents
  log('\n🤖 Fetching agents...', 'cyan');
  const agents = await getAgents();
  
  if (agents.length === 0) {
    log('❌ No agents found. Please create an agent first.', 'red');
    return;
  }
  
  log(`✅ Found ${agents.length} agent(s):`, 'green');
  agents.forEach((agent, idx) => {
    log(`   ${idx + 1}. ${agent.name} (ID: ${agent.id}) - ${agent.is_active ? 'Active' : 'Inactive'}`, 'blue');
    if (agent.phone_number_id) {
      log(`      Phone Number ID: ${agent.phone_number_id}`, 'blue');
    }
  });
  
  // Find agent linked to from phone, or use first active agent
  let agent = agents.find(a => a.phone_number_id === fromPhone.id && a.is_active);
  if (!agent) {
    agent = agents.find(a => a.is_active);
  }
  
  if (!agent) {
    log('\n❌ No active agent found.', 'red');
    return;
  }
  
  log(`\n✅ Using agent: ${agent.name} (ID: ${agent.id})`, 'green');
  
  // Make the call
  const toNumber = '404-738-7870'; // Will be normalized to +14047387870
  const callResult = await makeCall(fromPhone.id, toNumber, agent.id);
  
  if (callResult) {
    log('\n⏳ Call is ringing...', 'yellow');
    log('   Monitor backend logs for appointment booking:', 'yellow');
    log('   pm2 logs ehealth-backend | grep "APPOINTMENT BOOKED"', 'blue');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
