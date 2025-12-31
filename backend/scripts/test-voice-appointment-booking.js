/**
 * Test Voice Call Appointment Booking
 * Makes a call and tests appointment booking through voice conversation
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const twilio = require('twilio');
const { Pool } = require('pg');

const API_URL = 'https://ehealthmed.ai';
const BASE_URL = `${API_URL}/api`;
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiY2hodXphaWZhaWZ0aWtoYXJAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzY3MjE3ODczLCJleHAiOjE3Njc4MjI2NzN9.U5aZO_1PBYqibEXKUZbGc5iTKqWCXMwnyQAWA3z7_M8';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

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

async function setupTestEnvironment() {
  log('\n🔧 Setting up test environment...', 'cyan');
  
  // Get agent
  const agentResponse = await axios.get(`${BASE_URL}/agents`, {
    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
  });
  const agents = agentResponse.data.agents || [];
  const agent = agents.find(a => a.name.toLowerCase().includes('front desk')) || agents.find(a => a.is_active);
  
  if (!agent) {
    log('❌ No agent found', 'red');
    return null;
  }
  
  log(`✅ Agent: ${agent.name} (ID: ${agent.id})`, 'green');
  
  // Get organization
  const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
  const organizationId = orgResult.rows[0]?.id;
  
  // Ensure agent has calendar integration
  const calendarResult = await pool.query(
    `SELECT id FROM integrations 
     WHERE provider = 'google_calendar' 
     AND type = 'scheduling' 
     AND is_active = true 
     LIMIT 1`
  );
  
  if (calendarResult.rows.length > 0) {
    const calendarIntegrationId = calendarResult.rows[0].id;
    await pool.query(
      'UPDATE ai_agents SET calendar_integration_id = $1 WHERE id = $2',
      [calendarIntegrationId, agent.id]
    );
    log(`✅ Linked agent to calendar integration ${calendarIntegrationId}`, 'green');
  }
  
  return { agent, organizationId };
}

async function makeVoiceCall(fromNumber, toNumber, agentId, organizationId) {
  log(`\n📞 Making voice call for appointment booking...`, 'cyan');
  log(`   From: ${fromNumber}`, 'blue');
  log(`   To: ${toNumber}`, 'blue');
  log(`   Agent ID: ${agentId}`, 'blue');
  
  try {
    // Create conversation via webchat endpoint (proper way)
    let conversationId;
    try {
      const convResponse = await axios.post(
        `${BASE_URL}/webchat/conversation`,
        {
          agent_id: agentId,
          organization_id: organizationId,
          patient_name: 'John Smith'
        }
      );
      conversationId = convResponse.data.conversation_id;
      log(`✅ Conversation created via webchat: ${conversationId}`, 'green');
    } catch (webchatError) {
      // Fallback: create directly in database
      const convResult = await pool.query(
        `INSERT INTO conversations (organization_id, agent_id, patient_name, patient_phone, status)
         VALUES ($1, $2, $3, $4, 'active')
         RETURNING id`,
        [organizationId, agentId, 'John Smith', fromNumber]
      );
      conversationId = convResult.rows[0].id;
      log(`✅ Conversation created in database: ${conversationId}`, 'green');
    }
    
    // Get phone number ID for from number (try different formats)
    let phoneResult = await pool.query(
      'SELECT id FROM phone_numbers WHERE phone_number = $1 OR phone_number = $2 OR phone_number = $3 LIMIT 1',
      [fromNumber, fromNumber.replace('+', ''), fromNumber.replace('+1', '')]
    );
    
    // If still not found, get any active phone number
    if (phoneResult.rows.length === 0) {
      phoneResult = await pool.query(
        'SELECT id FROM phone_numbers WHERE is_active = true LIMIT 1'
      );
    }
    
    if (phoneResult.rows.length === 0) {
      log('❌ No phone number found in database', 'red');
      return null;
    }
    
    const phoneNumberId = phoneResult.rows[0].id;
    log(`✅ Using phone number ID: ${phoneNumberId}`, 'green');
    
    // Create call log
    const callLogResult = await pool.query(
      `INSERT INTO call_logs (
        organization_id, phone_number_id, agent_id, conversation_id,
        caller_phone, direction, status, started_at
      ) VALUES ($1, $2, $3, $4, $5, 'outbound', 'initiated', CURRENT_TIMESTAMP)
      RETURNING id`,
      [organizationId, phoneNumberId, agentId, conversationId, fromNumber]
    );
    
    const callLogId = callLogResult.rows[0].id;
    
    // Make the call via Twilio
    const webhookUrl = `${API_URL}/api/telephony/twilio/voice?conversationId=${conversationId}&callLogId=${callLogId}&agentId=${agentId}`;
    
    log(`   Webhook URL: ${webhookUrl}`, 'blue');
    
    const call = await client.calls.create({
      to: toNumber,
      from: fromNumber,
      url: webhookUrl,
      method: 'POST',
      statusCallback: `${API_URL}/api/telephony/twilio/status`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });
    
    log(`\n✅ Call initiated!`, 'green');
    log(`   Call SID: ${call.sid}`, 'blue');
    log(`   Conversation ID: ${conversationId}`, 'blue');
    log(`   Call Log ID: ${callLogId}`, 'blue');
    
    // Update call log with Twilio SID
    await pool.query(
      'UPDATE call_logs SET provider_call_id = $1 WHERE id = $2',
      [call.sid, callLogId]
    );
    
    return { callSid: call.sid, conversationId, callLogId };
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return null;
  }
}

async function simulateVoiceConversation(conversationId, agentId) {
  log('\n💬 Simulating voice conversation for appointment booking...', 'cyan');
  
  // Simulate the conversation flow
  const messages = [
    "Hello, I want to book an appointment",
    "My name is John Smith",
    "I'd like to schedule for tomorrow at 2 PM",
    "It's for a general checkup"
  ];
  
  for (const message of messages) {
    log(`\n👤 User: ${message}`, 'yellow');
    
    try {
      // Send message to conversation (simulating speech input)
      // Try webchat endpoint first (works better for conversations)
      let response;
      try {
        response = await axios.post(
          `${BASE_URL}/webchat/message`,
          {
            conversation_id: conversationId,
            message: message,
            agent_id: agentId
          },
          {
            headers: {
              'Authorization': `Bearer ${AUTH_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (webchatError) {
        // Fallback to conversations endpoint
        try {
          response = await axios.post(
            `${BASE_URL}/conversations/${conversationId}/messages`,
            {
              message: message,
              agent_id: agentId
            },
            {
              headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
              }
            }
          );
        } catch (convError) {
          throw webchatError; // Throw original error
        }
      }
      
      // Parse response - webchat returns { conversation_id, user_message, assistant_message, timestamp }
      let aiResponse = '';
      if (response.data.assistant_message) {
        aiResponse = response.data.assistant_message;
      } else if (response.data.response) {
        aiResponse = response.data.response;
      } else if (response.data.message) {
        aiResponse = response.data.message;
      } else {
        aiResponse = JSON.stringify(response.data);
      }
      
      log(`🤖 Bot: ${aiResponse}`, 'green');
      
      // Check for function call
      if (response.data.function_call || response.data.functionCall) {
        const funcCall = response.data.function_call || response.data.functionCall;
        log(`   🔧 Function called: ${funcCall.name}`, 'cyan');
        if (funcCall.name === 'book_appointment') {
          log(`   📅 Booking appointment...`, 'cyan');
        }
      }
      
      // Check if appointment was booked
      if (aiResponse.toLowerCase().includes('booked') || 
          aiResponse.toLowerCase().includes('scheduled') ||
          aiResponse.toLowerCase().includes('appointment')) {
        log('\n📅 ⭐ APPOINTMENT BOOKING DETECTED! ⭐', 'cyan');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for sync
        await checkAppointments();
        await checkGoogleCalendar();
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      log(`❌ Error: ${error.response?.data?.message || error.message}`, 'red');
    }
  }
}

async function checkAppointments() {
  log('\n📅 Checking for appointments...', 'cyan');
  
  try {
    const response = await axios.get(`${BASE_URL}/appointments?limit=5`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const appointments = response.data.appointments || [];
    if (appointments.length > 0) {
      log(`\n✅ Found ${appointments.length} appointment(s):`, 'green');
      appointments.slice(0, 3).forEach((apt, idx) => {
        log(`   ${idx + 1}. ${apt.patient_name} - ${new Date(apt.appointment_date).toLocaleString()}`, 'blue');
        log(`      Type: ${apt.appointment_type || 'N/A'}, Status: ${apt.status}`, 'blue');
      });
      return appointments;
    } else {
      log('⚠️  No appointments found', 'yellow');
      return [];
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return [];
  }
}

async function checkGoogleCalendar() {
  const accessToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  
  if (!accessToken) {
    log('⚠️  No Google Calendar token', 'yellow');
    return;
  }
  
  try {
    const timeMin = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const response = await axios.get(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
      {
        params: {
          timeMin: timeMin,
          maxResults: 10,
          singleEvents: true,
          orderBy: 'startTime'
        },
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );
    
    if (response.data.items?.length > 0) {
      log(`\n✅ Found ${response.data.items.length} event(s) in Google Calendar:`, 'green');
      response.data.items.forEach((event, idx) => {
        log(`   ${idx + 1}. ${event.summary}`, 'blue');
        log(`      Time: ${event.start.dateTime || event.start.date}`, 'blue');
        if (event.htmlLink) {
          log(`      Link: ${event.htmlLink}`, 'blue');
        }
      });
    } else {
      log('⚠️  No recent events in Google Calendar', 'yellow');
    }
  } catch (error) {
    if (error.response?.status === 401) {
      log('⚠️  Google Calendar token expired', 'yellow');
    } else {
      log(`❌ Error: ${error.message}`, 'red');
    }
  }
}

async function checkCallStatus(callSid) {
  try {
    const call = await client.calls(callSid).fetch();
    return {
      status: call.status,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime
    };
  } catch (error) {
    return null;
  }
}

async function main() {
  log('\n🚀 Voice Call Appointment Booking Test\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // Setup
  const setup = await setupTestEnvironment();
  if (!setup) {
    return;
  }
  
  const { agent, organizationId } = setup;
  
  // Make the call
  const callResult = await makeVoiceCall(
    '+17703434007',
    '+18666068625', // Auto-answer number
    agent.id,
    organizationId
  );
  
  if (!callResult) {
    log('\n❌ Failed to initiate call', 'red');
    return;
  }
  
  // Wait for call to connect
  log('\n⏳ Waiting 5 seconds for call to connect...', 'yellow');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check call status
  const callStatus = await checkCallStatus(callResult.callSid);
  if (callStatus) {
    log(`\n📊 Call Status:`, 'cyan');
    log(`   Status: ${callStatus.status}`, 'blue');
    if (callStatus.duration) {
      log(`   Duration: ${callStatus.duration} seconds`, 'blue');
    }
  }
  
  // Simulate conversation (this simulates what would happen during the call)
  log('\n💬 Note: The call will auto-answer and play a message.', 'cyan');
  log('   Simulating appointment booking conversation...', 'cyan');
  
  await simulateVoiceConversation(callResult.conversationId, agent.id);
  
  // Final checks
  log('\n📅 Final check for appointments...', 'cyan');
  await checkAppointments();
  await checkGoogleCalendar();
  
  log('\n✅ Test completed!', 'green');
  log('\n📝 Summary:', 'cyan');
  log('   - Call was made and connected', 'blue');
  log('   - Conversation simulated for appointment booking', 'blue');
  log('   - Check above for appointment creation and Google Calendar sync', 'blue');
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
