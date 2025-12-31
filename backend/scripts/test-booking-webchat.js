/**
 * Test Appointment Booking via Web Chat
 * Simulates a conversation to book an appointment and verify Google Calendar sync
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

async function testBooking() {
  log('\n🚀 Testing Appointment Booking via Web Chat\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // Get agents
  log('\n🤖 Fetching agents...', 'cyan');
  const agentResponse = await axios.get(`${BASE_URL}/agents`, {
    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
  });
  const agents = agentResponse.data.agents || [];
  
  // Find Front Desk Assistant or first active agent
  let agent = agents.find(a => a.name.toLowerCase().includes('front desk')) || 
              agents.find(a => a.is_active) || 
              agents[0];
  
  if (!agent) {
    log('❌ No agent found', 'red');
    return;
  }
  
  log(`✅ Using agent: ${agent.name} (ID: ${agent.id})`, 'green');
  
  // Get organization ID
  const orgResponse = await axios.get(`${BASE_URL}/users/me`, {
    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
  });
  const organizationId = orgResponse.data.user?.organization_id;
  
  // Create conversation via webchat (webchat doesn't require auth)
  log('\n💬 Creating webchat conversation...', 'cyan');
  let conversationId;
  
  try {
    const convResponse = await axios.post(
      `${BASE_URL}/webchat/conversation`,
      {
        agent_id: agent.id,
        patient_name: 'John Smith'
      }
    );
    
    conversationId = convResponse.data.conversation_id;
    log(`✅ Conversation created: ${conversationId}`, 'green');
    
    const greeting = convResponse.data.greeting_message || 'Hello!';
    log(`\n🤖 Bot: ${greeting}`, 'green');
  } catch (error) {
    log(`❌ Error creating conversation: ${error.response?.data?.message || error.message}`, 'red');
    if (error.response?.data) {
      log(`   Details: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return;
  }
  
  // Continue conversation - provide all info needed for booking
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);
  const appointmentDate = tomorrow.toISOString();
  
  // More direct conversation to trigger booking
  const messages = [
    { text: "I want to book an appointment for John Smith", delay: 2000 },
    { text: `Book me for ${tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at 2:00 PM`, delay: 3000 },
    { text: `My phone number is 555-123-4567 and the appointment type is general checkup. The date is ${appointmentDate}. Please book it now using the book_appointment function.`, delay: 3000 }
  ];
  
  let appointmentBooked = false;
  
  for (const msg of messages) {
    log(`\n👤 User: ${msg.text}`, 'yellow');
    
    try {
      const response = await axios.post(
        `${BASE_URL}/webchat/message`,
        {
          conversation_id: conversationId,
          message: msg.text,
          agent_id: agent.id
        }
      );
      
      // Parse response - webchat returns { conversation_id, user_message, assistant_message, timestamp }
      let aiResponse = '';
      if (response.data.assistant_message) {
        aiResponse = response.data.assistant_message;
      } else if (response.data.response) {
        aiResponse = response.data.response;
      } else if (response.data.message) {
        aiResponse = response.data.message;
      } else if (response.data.content) {
        aiResponse = response.data.content;
      } else {
        aiResponse = JSON.stringify(response.data);
      }
      
      log(`🤖 Bot: ${aiResponse}`, 'green');
      
      // Check for function call in response
      if (response.data.function_call || response.data.functionCall) {
        const funcCall = response.data.function_call || response.data.functionCall;
        log(`   🔧 Function called: ${funcCall.name}`, 'cyan');
        if (funcCall.name === 'book_appointment') {
          log(`   📅 Booking appointment...`, 'cyan');
        }
      }
      
      // Check if appointment was booked
      if ((aiResponse.toLowerCase().includes('booked') || 
           aiResponse.toLowerCase().includes('scheduled') ||
           aiResponse.toLowerCase().includes('appointment')) && !appointmentBooked) {
        log('\n📅 ⭐ APPOINTMENT BOOKING DETECTED! ⭐', 'cyan');
        appointmentBooked = true;
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for sync
        await checkAppointments();
        await checkGoogleCalendar();
      }
      
      await new Promise(resolve => setTimeout(resolve, msg.delay));
    } catch (error) {
      log(`❌ Error: ${error.response?.data?.message || error.message}`, 'red');
      if (error.response?.data) {
        log(`   Details: ${JSON.stringify(error.response.data)}`, 'red');
      }
    }
  }
  
  // Final check
  log('\n📅 Final check for appointments...', 'cyan');
  await checkAppointments();
  await checkGoogleCalendar();
}

async function checkAppointments() {
  try {
    const response = await axios.get(
      `${BASE_URL}/appointments?limit=5`,
      {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      }
    );
    
    const appointments = response.data.appointments || [];
    if (appointments.length > 0) {
      log(`\n✅ Found ${appointments.length} appointment(s):`, 'green');
      appointments.slice(0, 3).forEach((apt, idx) => {
        log(`   ${idx + 1}. ${apt.patient_name} - ${new Date(apt.appointment_date).toLocaleString()}`, 'blue');
        log(`      Type: ${apt.appointment_type || 'N/A'}`, 'blue');
        log(`      Status: ${apt.status}`, 'blue');
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
  // Use token from .env
  const accessToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN || 
                     'ya29.a0Aa7pCA8F8ZB-YeXdbW-5uI_9XYB1LSDAjaFEzY8pRXbhuVwbVve0CUlCPxFlnTho-_Gfaj6OuX1jCSCV_o1BYjWWfLgc-FNtFzrYUC0oNdENckwsSsdIgJSrUrhMmcMABnV3rctW35mF4xG_WpmqNmc-uhwe7HRBYvrN-uGrOkeBfTWmNTks7wqWm2U1xlJKVIwxTxcaCgYKAX0SARcSFQHGX2Miy_Ae7l3UO6xl78D33822fg0206';
  
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
    log(`❌ Error: ${error.message}`, 'red');
  }
}

testBooking()
  .then(() => {
    log('\n✅ Test completed!', 'green');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
