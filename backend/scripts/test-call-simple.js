/**
 * Simple Test Call Script - Uses API instead of direct database access
 * Makes outbound call and monitors for appointment booking
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const API_URL = process.env.API_URL || process.env.FRONTEND_URL || 'https://ehealthmed.ai';
const BASE_URL = API_URL.replace(/\/api\/?$/, '') + '/api';

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

async function makeCall(authToken, fromPhoneId, toNumber, agentId) {
  log('\n📞 Making outbound call...', 'cyan');
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
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    log('✅ Call initiated successfully!', 'green');
    log(`   Call SID: ${response.data.callSid}`, 'blue');
    log(`   Call Log ID: ${response.data.callLogId}`, 'blue');
    log(`   Conversation ID: ${response.data.conversationId}`, 'blue');
    
    return response.data;
  } catch (error) {
    log(`❌ Error making call: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Error: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return null;
  }
}

async function checkAppointments(authToken) {
  log('\n📅 Checking for appointments...', 'cyan');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/appointments?limit=5`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );
    
    if (response.data.appointments && response.data.appointments.length > 0) {
      log(`✅ Found ${response.data.appointments.length} appointment(s):`, 'green');
      response.data.appointments.forEach((apt, idx) => {
        log(`   ${idx + 1}. ${apt.patient_name} - ${new Date(apt.appointment_date).toLocaleString()}`, 'blue');
        log(`      Type: ${apt.appointment_type || 'N/A'}`, 'blue');
        log(`      Status: ${apt.status}`, 'blue');
      });
      return response.data.appointments;
    } else {
      log('⚠️  No appointments found yet', 'yellow');
      return [];
    }
  } catch (error) {
    log(`❌ Error checking appointments: ${error.message}`, 'red');
    return [];
  }
}

async function checkGoogleCalendar() {
  log('\n📅 Checking Google Calendar...', 'cyan');
  
  const accessToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
  
  if (!accessToken) {
    log('⚠️  No Google Calendar access token provided', 'yellow');
    return;
  }
  
  try {
    const timeMin = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const response = await axios.get(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        params: {
          timeMin: timeMin,
          maxResults: 10,
          singleEvents: true,
          orderBy: 'startTime'
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (response.data.items && response.data.items.length > 0) {
      log(`✅ Found ${response.data.items.length} event(s) in Google Calendar:`, 'green');
      response.data.items.forEach((event, idx) => {
        log(`   ${idx + 1}. ${event.summary}`, 'blue');
        log(`      Time: ${event.start.dateTime || event.start.date}`, 'blue');
        if (event.htmlLink) {
          log(`      Link: ${event.htmlLink}`, 'blue');
        }
      });
    } else {
      log('⚠️  No recent events found in Google Calendar', 'yellow');
    }
  } catch (error) {
    log(`❌ Error checking Google Calendar: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
    }
  }
}

async function main() {
  log('\n🚀 Test Call with Appointment Booking\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // Get auth token
  const authToken = process.env.TEST_TOKEN || '';
  if (!authToken) {
    log('⚠️  No TEST_TOKEN provided. Please set it in .env or as environment variable.', 'yellow');
    log('   You can get a token by logging in and checking localStorage.getItem("ehealth_token")', 'yellow');
    return;
  }
  
  // Configuration
  const fromPhoneNumber = '+17703434007';
  const toPhoneNumber = '404-738-7870';
  
  // You'll need to provide these IDs
  const fromPhoneId = process.env.FROM_PHONE_ID || 1; // ID of +17703434007 in database
  const agentId = process.env.AGENT_ID || 1; // ID of the agent
  
  log(`\n📋 Configuration:`, 'cyan');
  log(`   From: ${fromPhoneNumber} (ID: ${fromPhoneId})`, 'blue');
  log(`   To: ${toPhoneNumber}`, 'blue');
  log(`   Agent ID: ${agentId}`, 'blue');
  
  // Make the call
  const callResult = await makeCall(authToken, fromPhoneId, toPhoneNumber, agentId);
  
  if (callResult) {
    log('\n⏳ Waiting 15 seconds for call to connect and conversation to start...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Check for appointments
    await checkAppointments(authToken);
    
    // Check Google Calendar
    await checkGoogleCalendar();
    
    log('\n✅ Test call completed!', 'green');
    log('\n📝 Instructions:', 'cyan');
    log('   1. Answer the call when it rings', 'blue');
    log('   2. Say: "I want to book an appointment"', 'blue');
    log('   3. Provide your name and preferred date/time', 'blue');
    log('   4. The bot should book the appointment and sync to Google Calendar', 'blue');
    log('   5. Run this script again to check if appointment appears', 'blue');
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { main };
