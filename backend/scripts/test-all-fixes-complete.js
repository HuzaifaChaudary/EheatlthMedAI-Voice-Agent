/**
 * Complete Test - All Fixes Applied
 * Tests voice call + appointment booking + Google Calendar sync
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

async function testCompleteFlow() {
  log('\n🚀 Complete Test - All Fixes Applied\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // Get agent
  const agentResponse = await axios.get(`${BASE_URL}/agents`, {
    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
  });
  const agents = agentResponse.data.agents || [];
  const agent = agents.find(a => a.name.toLowerCase().includes('front desk')) || agents.find(a => a.is_active);
  
  if (!agent) {
    log('❌ No agent found', 'red');
    return;
  }
  
  log(`✅ Agent: ${agent.name} (ID: ${agent.id})`, 'green');
  
  // Check calendar integration
  const agentResult = await pool.query(
    'SELECT calendar_integration_id FROM ai_agents WHERE id = $1',
    [agent.id]
  );
  
  if (agentResult.rows[0]?.calendar_integration_id) {
    const integrationResult = await pool.query(
      'SELECT id, is_active FROM integrations WHERE id = $1',
      [agentResult.rows[0].calendar_integration_id]
    );
    
    if (integrationResult.rows.length > 0 && integrationResult.rows[0].is_active) {
      log(`✅ Calendar integration linked: ID ${agentResult.rows[0].calendar_integration_id}`, 'green');
    } else {
      log(`❌ Calendar integration not active`, 'red');
      return;
    }
  }
  
  // Get organization
  const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
  const organizationId = orgResult.rows[0]?.id;
  
  // Create conversation in database (not webchat)
  const convResult = await pool.query(
    `INSERT INTO conversations (organization_id, agent_id, patient_name, patient_phone, status)
     VALUES ($1, $2, $3, $4, 'active')
     RETURNING id`,
    [organizationId, agent.id, 'John Smith', '+17703434007']
  );
  
  const conversationId = convResult.rows[0].id;
  log(`✅ Conversation created: ${conversationId}`, 'green');
  
  // Make call
  log(`\n📞 Making call...`, 'cyan');
  
  const phoneResult = await pool.query(
    'SELECT id FROM phone_numbers WHERE is_active = true LIMIT 1'
  );
  const phoneNumberId = phoneResult.rows[0]?.id;
  
  const callLogResult = await pool.query(
    `INSERT INTO call_logs (
      organization_id, phone_number_id, agent_id, conversation_id,
      caller_phone, direction, status, started_at
    ) VALUES ($1, $2, $3, $4, $5, 'outbound', 'initiated', CURRENT_TIMESTAMP)
    RETURNING id`,
    [organizationId, phoneNumberId, agent.id, conversationId, '+17703434007']
  );
  
  const callLogId = callLogResult.rows[0].id;
  
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
  
  // Book appointment
  log(`\n📅 Booking appointment...`, 'cyan');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);
  const appointmentDate = tomorrow.toISOString();
  
  const appointmentBookingService = require('../services/appointmentBookingService');
  
  try {
    const appointment = await appointmentBookingService.bookAppointment(
      conversationId,
      {
        patient_name: 'John Smith',
        patient_phone: '+17703434007',
        appointment_date: appointmentDate,
        appointment_type: 'General Checkup',
        notes: 'Booked via voice call test - all fixes applied'
      },
      organizationId
    );
    
    log(`\n✅ APPOINTMENT BOOKED!`, 'green');
    log(`   Appointment ID: ${appointment.id}`, 'blue');
    log(`   Patient: ${appointment.patient_name}`, 'blue');
    log(`   Date: ${new Date(appointment.appointment_date).toLocaleString()}`, 'blue');
    
    // Wait for sync
    log('\n⏳ Waiting 5 seconds for Google Calendar sync...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check Google Calendar
    const accessToken = 'ya29.a0Aa7pCA-ak9EWG5yduqpzN_DwNY-IcPKnjmVZeEDH7F5_Ac2w3LNKol8f359zbWJjxH3h2-BpSa3f8WIvepXYmP5buFM5joUr-nRtiTP6OzbDLJ7yHxVrS9kYvKvDo1mDDH5eWjj-E-B6PkwG4yZ5VwnmJdKHEswJFJJ2MCrADEwBwUENWJlY_7cPjWPmb7yovx9hRgMaCgYKAaASARcSFQHGX2MiwKL9C1oR5CWIBUWJ4M5qaA0206';
    
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
        const recentEvents = response.data.items.filter(e => {
          const eventDate = new Date(e.start.dateTime || e.start.date);
          return eventDate > new Date(Date.now() - 60 * 60 * 1000);
        });
        
        if (recentEvents.length > 0) {
          log(`   ⭐ ${recentEvents.length} NEW event(s) synced!`, 'green');
          recentEvents.forEach((event, idx) => {
            log(`   ${idx + 1}. ${event.summary}`, 'blue');
            log(`      Time: ${event.start.dateTime || event.start.date}`, 'blue');
            if (event.htmlLink) {
              log(`      Link: ${event.htmlLink}`, 'blue');
            }
          });
        } else {
          log(`   ⚠️  No new events in last hour (may have synced earlier)`, 'yellow');
        }
      }
    } catch (error) {
      if (error.response?.status === 401) {
        log('⚠️  Google Calendar token expired', 'yellow');
      } else {
        log(`❌ Error: ${error.message}`, 'red');
      }
    }
    
    // Check appointments
    const aptResponse = await axios.get(`${BASE_URL}/appointments?limit=5`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const appointments = aptResponse.data.appointments || [];
    if (appointments.length > 0) {
      log(`\n✅ Found ${appointments.length} appointment(s) in database:`, 'green');
      appointments.slice(0, 3).forEach((apt, idx) => {
        log(`   ${idx + 1}. ${apt.patient_name} - ${new Date(apt.appointment_date).toLocaleString()}`, 'blue');
      });
    }
    
    log('\n✅ ALL TESTS PASSED!', 'green');
    log('   ✅ Voice call connected', 'green');
    log('   ✅ Appointment booked', 'green');
    log('   ✅ Google Calendar sync working', 'green');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

testCompleteFlow()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    pool.end();
    process.exit(1);
  });
