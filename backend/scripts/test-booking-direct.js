/**
 * Direct Appointment Booking Test
 * Provides all required info upfront to trigger booking
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const API_URL = 'https://ehealthmed.ai';
const BASE_URL = `${API_URL}/api`;
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

async function testDirectBooking() {
  log('\n🚀 Direct Appointment Booking Test\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // Get Front Desk Assistant agent
  const agentResponse = await axios.get(`${BASE_URL}/agents`, {
    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
  });
  const agents = agentResponse.data.agents || [];
  const agent = agents.find(a => a.name.toLowerCase().includes('front desk')) || agents.find(a => a.is_active);
  
  if (!agent) {
    log('❌ No agent found', 'red');
    return;
  }
  
  log(`✅ Using agent: ${agent.name} (ID: ${agent.id}, Type: ${agent.type})`, 'green');
  
  // Create conversation
  const convResponse = await axios.post(`${BASE_URL}/webchat/conversation`, {
    agent_id: agent.id,
    patient_name: 'John Smith'
  });
  
  const conversationId = convResponse.data.conversation_id;
  log(`✅ Conversation created: ${conversationId}`, 'green');
  log(`🤖 Bot: ${convResponse.data.greeting_message}`, 'green');
  
  // Calculate tomorrow at 2 PM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);
  const appointmentDate = tomorrow.toISOString();
  
  // Send complete booking request
  log(`\n👤 User: I want to book an appointment for John Smith on ${tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at 2:00 PM for a general checkup. My phone is 555-123-4567.`, 'yellow');
  
  const response = await axios.post(`${BASE_URL}/webchat/message`, {
    conversation_id: conversationId,
    message: `Book an appointment for John Smith on ${appointmentDate} at 2 PM for a general checkup. Phone: 555-123-4567`,
    agent_id: agent.id
  });
  
  const aiResponse = response.data.assistant_message || response.data.response || 'No response';
  log(`🤖 Bot: ${aiResponse}`, 'green');
  
  // Check for function call
  if (response.data.function_call || response.data.functionCall) {
    log(`\n🔧 Function called!`, 'cyan');
  }
  
  // Wait and check appointments
  log('\n⏳ Waiting 3 seconds for appointment to be created...', 'yellow');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await checkAppointments();
  await checkGoogleCalendar();
}

async function checkAppointments() {
  try {
    const response = await axios.get(`${BASE_URL}/appointments?limit=5`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const appointments = response.data.appointments || [];
    if (appointments.length > 0) {
      log(`\n✅ Found ${appointments.length} appointment(s):`, 'green');
      appointments.forEach((apt, idx) => {
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
  const accessToken = 'ya29.a0Aa7pCA8F8ZB-YeXdbW-5uI_9XYB1LSDAjaFEzY8pRXbhuVwbVve0CUlCPxFlnTho-_Gfaj6OuX1jCSCV_o1BYjWWfLgc-FNtFzrYUC0oNdENckwsSsdIgJSrUrhMmcMABnV3rctW35mF4xG_WpmqNmc-uhwe7HRBYvrN-uGrOkeBfTWmNTks7wqWm2U1xlJKVIwxTxcaCgYKAX0SARcSFQHGX2Miy_Ae7l3UO6xl78D33822fg0206';
  
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
    log(`❌ Error: ${error.response?.status} - ${error.response?.data?.error?.message || error.message}`, 'red');
  }
}

testDirectBooking()
  .then(() => {
    log('\n✅ Test completed!', 'green');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
