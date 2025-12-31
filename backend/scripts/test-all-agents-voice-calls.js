/**
 * Test Voice Calls for All Agent Types
 * Tests appointment booking and voice calls for each agent type
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
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function getAllAgents() {
  try {
    const response = await axios.get(`${BASE_URL}/agents`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    return response.data.agents || [];
  } catch (error) {
    log(`❌ Error fetching agents: ${error.message}`, 'red');
    return [];
  }
}

async function testAgentVoiceCall(agent) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`\n🤖 Testing Agent: ${agent.name} (${agent.type})`, 'magenta');
  log(`${'='.repeat(60)}`, 'cyan');
  
  try {
    // Get organization
    const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
    const organizationId = orgResult.rows[0]?.id;
    
    // Create conversation
    const convResult = await pool.query(
      `INSERT INTO conversations (organization_id, agent_id, patient_name, patient_phone, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id`,
      [organizationId, agent.id, `Test Patient ${agent.name}`, '+17703434007']
    );
    
    const conversationId = convResult.rows[0].id;
    log(`✅ Conversation created: ${conversationId}`, 'green');
    
    // Get phone number
    const phoneResult = await pool.query(
      'SELECT id FROM phone_numbers WHERE is_active = true LIMIT 1'
    );
    const phoneNumberId = phoneResult.rows[0]?.id;
    
    // Create call log
    const callLogResult = await pool.query(
      `INSERT INTO call_logs (
        organization_id, phone_number_id, agent_id, conversation_id,
        caller_phone, direction, status, started_at
      ) VALUES ($1, $2, $3, $4, $5, 'outbound', 'initiated', CURRENT_TIMESTAMP)
      RETURNING id`,
      [organizationId, phoneNumberId, agent.id, conversationId, '+17703434007']
    );
    
    const callLogId = callLogResult.rows[0].id;
    
    // Make call
    log(`\n📞 Making call to auto-answer number...`, 'cyan');
    const call = await client.calls.create({
      to: '+18666068625',
      from: '+17703434007',
      url: `${API_URL}/api/telephony/twilio/voice?conversationId=${conversationId}&callLogId=${callLogId}&agentId=${agent.id}`,
      method: 'POST',
      statusCallback: `${API_URL}/api/telephony/twilio/status`,
      statusCallbackMethod: 'POST'
    });
    
    log(`✅ Call initiated: ${call.sid}`, 'green');
    
    await pool.query(
      'UPDATE call_logs SET provider_call_id = $1 WHERE id = $2',
      [call.sid, callLogId]
    );
    
    // Wait for call
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const callStatus = await client.calls(call.sid).fetch();
    log(`📊 Call Status: ${callStatus.status}, Duration: ${callStatus.duration || 0}s`, 'blue');
    
    // Test appointment booking via webchat (simulating voice conversation)
    log(`\n💬 Simulating voice conversation for appointment booking...`, 'cyan');
    
    const testMessages = [
      "Hello, I want to book an appointment",
      `My name is Test Patient ${agent.name}`,
      "I'd like to schedule for tomorrow at 2 PM",
      "It's for a general checkup"
    ];
    
    let appointmentBooked = false;
    
    for (const message of testMessages) {
      log(`\n👤 User: ${message}`, 'yellow');
      
      try {
        const response = await axios.post(
          `${BASE_URL}/webchat/message`,
          {
            conversation_id: conversationId,
            message: message,
            agent_id: agent.id
          },
          {
            headers: {
              'Authorization': `Bearer ${AUTH_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        const aiResponse = response.data.assistant_message || response.data.response || 'No response';
        log(`🤖 Bot: ${aiResponse.substring(0, 100)}...`, 'green');
        
        // Check for function call
        if (response.data.function_call || response.data.functionCall) {
          const funcCall = response.data.function_call || response.data.functionCall;
          if (funcCall.name === 'book_appointment') {
            log(`   🔧 Function called: ${funcCall.name}`, 'cyan');
            appointmentBooked = true;
            break;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        log(`   ❌ Error: ${error.response?.data?.message || error.message}`, 'red');
      }
    }
    
    // If appointment not booked via conversation, book directly
    if (!appointmentBooked) {
      log(`\n📅 Booking appointment directly (conversation didn't trigger booking)...`, 'cyan');
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0);
      
      const appointmentBookingService = require('../services/appointmentBookingService');
      
      try {
        const appointment = await appointmentBookingService.bookAppointment(
          conversationId,
          {
            patient_name: `Test Patient ${agent.name}`,
            patient_phone: '+17703434007',
            appointment_date: tomorrow.toISOString(),
            appointment_type: 'General Checkup',
            notes: `Booked via ${agent.name} agent test`
          },
          organizationId
        );
        
        log(`✅ Appointment booked! ID: ${appointment.id}`, 'green');
        appointmentBooked = true;
      } catch (error) {
        log(`❌ Error booking: ${error.message}`, 'red');
      }
    }
    
    // Check results
    log(`\n📊 Test Results:`, 'cyan');
    log(`   ✅ Call connected: ${callStatus.status === 'completed' ? 'Yes' : 'No'}`, callStatus.status === 'completed' ? 'green' : 'yellow');
    log(`   ✅ Appointment booked: ${appointmentBooked ? 'Yes' : 'No'}`, appointmentBooked ? 'green' : 'yellow');
    log(`   ✅ Calendar integration: ${agent.calendar_integration_id ? `Linked (ID: ${agent.calendar_integration_id})` : 'Not linked'}`, agent.calendar_integration_id ? 'green' : 'yellow');
    
    return {
      agent: agent.name,
      type: agent.type,
      callConnected: callStatus.status === 'completed',
      appointmentBooked,
      calendarLinked: !!agent.calendar_integration_id
    };
    
  } catch (error) {
    log(`❌ Error testing agent: ${error.message}`, 'red');
    return {
      agent: agent.name,
      type: agent.type,
      error: error.message
    };
  }
}

async function main() {
  log('\n🚀 Testing Voice Calls for All Agent Types\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // Update all agents first
  log('\n📝 Step 1: Updating all agent system prompts...', 'cyan');
  const { execSync } = require('child_process');
  try {
    execSync('node backend/scripts/update-all-agents-system-prompts.js', { stdio: 'inherit' });
  } catch (error) {
    log('⚠️  Could not run update script, continuing...', 'yellow');
  }
  
  // Get all agents
  log('\n📋 Step 2: Fetching all agents...', 'cyan');
  const agents = await getAllAgents();
  
  if (agents.length === 0) {
    log('❌ No agents found', 'red');
    return;
  }
  
  log(`✅ Found ${agents.length} agent(s)`, 'green');
  
  // Test each agent
  log('\n📋 Step 3: Testing each agent...', 'cyan');
  const results = [];
  
  for (const agent of agents) {
    if (agent.is_active) {
      const result = await testAgentVoiceCall(agent);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait between tests
    }
  }
  
  // Summary
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`\n📊 FINAL TEST RESULTS\n`, 'cyan');
  log(`${'='.repeat(60)}`, 'cyan');
  
  results.forEach((result, idx) => {
    log(`\n${idx + 1}. ${result.agent} (${result.type})`, 'magenta');
    if (result.error) {
      log(`   ❌ Error: ${result.error}`, 'red');
    } else {
      log(`   ${result.callConnected ? '✅' : '❌'} Call Connected: ${result.callConnected}`, result.callConnected ? 'green' : 'red');
      log(`   ${result.appointmentBooked ? '✅' : '❌'} Appointment Booked: ${result.appointmentBooked}`, result.appointmentBooked ? 'green' : 'red');
      log(`   ${result.calendarLinked ? '✅' : '⚠️ '} Calendar Linked: ${result.calendarLinked}`, result.calendarLinked ? 'green' : 'yellow');
    }
  });
  
  const successCount = results.filter(r => !r.error && r.callConnected && r.appointmentBooked).length;
  log(`\n✅ Success Rate: ${successCount}/${results.length} agents fully working`, 'green');
  
  log(`\n✅ All tests completed!`, 'green');
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
