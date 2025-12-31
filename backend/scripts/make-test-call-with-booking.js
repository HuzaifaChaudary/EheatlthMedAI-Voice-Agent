/**
 * Test Script: Make Outbound Call and Test Appointment Booking
 * Calls from +17703434007 to 404-738-7870 and tests appointment booking with Google Calendar
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const { Pool } = require('pg');

const API_URL = process.env.API_URL || process.env.FRONTEND_URL || 'https://ehealthmed.ai';
const BASE_URL = API_URL.replace(/\/api\/?$/, '') + '/api';

// Database connection - use DATABASE_URL from .env
const dbConfig = process.env.DATABASE_URL 
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'ehealthmedai',
      user: process.env.DB_USER || 'ehealthmedai',
      password: process.env.DB_PASSWORD || 'str0ng'
    };

const pool = new Pool(dbConfig);

// Colors for console
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

async function setupGoogleCalendarIntegration() {
  log('\n📅 Setting up Google Calendar Integration...', 'cyan');
  
  try {
    // Check if integration exists
    const result = await pool.query(
      `SELECT id, credentials FROM integrations 
       WHERE provider = 'google_calendar' 
       AND type = 'scheduling' 
       AND is_active = true 
       LIMIT 1`
    );
    
    let integrationId;
    
    if (result.rows.length > 0) {
      integrationId = result.rows[0].id;
      log(`✅ Found existing Google Calendar integration (ID: ${integrationId})`, 'green');
      
      // Update credentials
      const credentials = {
        access_token: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN,
        refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
        calendar_id: process.env.GOOGLE_CALENDAR_ID || 'primary',
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET
      };
      
      await pool.query(
        'UPDATE integrations SET credentials = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [JSON.stringify(credentials), integrationId]
      );
      
      log('✅ Updated Google Calendar credentials', 'green');
    } else {
      // Create new integration
      const credentials = {
        access_token: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN,
        refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
        calendar_id: process.env.GOOGLE_CALENDAR_ID || 'primary',
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET
      };
      
      // Get first organization
      const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
      const organizationId = orgResult.rows[0]?.id || null;
      
      const insertResult = await pool.query(
        `INSERT INTO integrations (organization_id, name, type, provider, credentials, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [organizationId, 'Google Calendar', 'scheduling', 'google_calendar', JSON.stringify(credentials), true]
      );
      
      integrationId = insertResult.rows[0].id;
      log(`✅ Created Google Calendar integration (ID: ${integrationId})`, 'green');
    }
    
    return integrationId;
  } catch (error) {
    log(`❌ Error setting up Google Calendar: ${error.message}`, 'red');
    throw error;
  }
}

async function findOrCreateAgent(phoneNumberId) {
  log('\n🤖 Finding or creating agent...', 'cyan');
  
  try {
    // Get first organization
    const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
    const organizationId = orgResult.rows[0]?.id || null;
    
    // Find agent linked to phone number
    const agentResult = await pool.query(
      `SELECT id, name, phone_number_id, calendar_integration_id 
       FROM ai_agents 
       WHERE phone_number_id = $1 AND organization_id = $2 
       LIMIT 1`,
      [phoneNumberId, organizationId]
    );
    
    if (agentResult.rows.length > 0) {
      const agent = agentResult.rows[0];
      log(`✅ Found agent: ${agent.name} (ID: ${agent.id})`, 'green');
      
      // Get Google Calendar integration
      const calendarResult = await pool.query(
        `SELECT id FROM integrations 
         WHERE provider = 'google_calendar' 
         AND type = 'scheduling' 
         AND is_active = true 
         LIMIT 1`
      );
      
      if (calendarResult.rows.length > 0) {
        const calendarIntegrationId = calendarResult.rows[0].id;
        
        // Update agent with calendar integration
        await pool.query(
          'UPDATE ai_agents SET calendar_integration_id = $1 WHERE id = $2',
          [calendarIntegrationId, agent.id]
        );
        
        log(`✅ Linked agent to Google Calendar integration (ID: ${calendarIntegrationId})`, 'green');
      }
      
      return agent.id;
    } else {
      // Create new agent
      const calendarResult = await pool.query(
        `SELECT id FROM integrations 
         WHERE provider = 'google_calendar' 
         AND type = 'scheduling' 
         AND is_active = true 
         LIMIT 1`
      );
      
      const calendarIntegrationId = calendarResult.rows.length > 0 ? calendarResult.rows[0].id : null;
      
      const insertResult = await pool.query(
        `INSERT INTO ai_agents (
          organization_id, name, type, description, 
          phone_number_id, calendar_integration_id,
          system_prompt, is_active, voice_model
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          organizationId,
          'Front Desk Assistant',
          'front_desk',
          'Handles appointment booking and patient inquiries',
          phoneNumberId,
          calendarIntegrationId,
          'You are a professional front desk assistant for a medical practice. Help patients with appointment scheduling, general inquiries, and routing calls appropriately. IMPORTANT: When a patient wants to book, schedule, or make an appointment, you MUST use the book_appointment function to create the appointment. Do not just confirm verbally - actually book it using the function. Always collect the patient\'s name, preferred date and time, appointment type (if specified), and contact information before booking.',
          true,
          'openai'
        ]
      );
      
      const agentId = insertResult.rows[0].id;
      log(`✅ Created agent: Front Desk Assistant (ID: ${agentId})`, 'green');
      return agentId;
    }
  } catch (error) {
    log(`❌ Error finding/creating agent: ${error.message}`, 'red');
    throw error;
  }
}

async function findPhoneNumber(phoneNumber) {
  log(`\n📞 Finding phone number: ${phoneNumber}...`, 'cyan');
  
  try {
    // Normalize phone number
    const { normalizePhoneNumber } = require('../utils/phoneUtils');
    const normalized = normalizePhoneNumber(phoneNumber);
    
    const result = await pool.query(
      'SELECT id, phone_number, organization_id FROM phone_numbers WHERE phone_number = $1 OR phone_number = $2',
      [phoneNumber, normalized]
    );
    
    if (result.rows.length > 0) {
      const phone = result.rows[0];
      log(`✅ Found phone number: ${phone.phone_number} (ID: ${phone.id})`, 'green');
      return phone.id;
    } else {
      log(`⚠️  Phone number not found. Creating...`, 'yellow');
      
      // Get first organization
      const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
      const organizationId = orgResult.rows[0]?.id || null;
      
      const insertResult = await pool.query(
        `INSERT INTO phone_numbers (organization_id, phone_number, provider, is_active)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [organizationId, normalized, 'twilio', true]
      );
      
      const phoneId = insertResult.rows[0].id;
      log(`✅ Created phone number: ${normalized} (ID: ${phoneId})`, 'green');
      return phoneId;
    }
  } catch (error) {
    log(`❌ Error finding phone number: ${error.message}`, 'red');
    throw error;
  }
}

async function makeOutboundCall(fromNumber, toNumber, agentId, phoneNumberId, organizationId) {
  log(`\n📞 Making outbound call...`, 'cyan');
  log(`   From: ${fromNumber}`, 'blue');
  log(`   To: ${toNumber}`, 'blue');
  log(`   Agent ID: ${agentId}`, 'blue');
  
  try {
    // Get auth token (you'll need to provide this or login)
    const authToken = process.env.TEST_TOKEN || '';
    
    if (!authToken) {
      log('⚠️  No auth token provided. Skipping API call.', 'yellow');
      log('   To make the call, set TEST_TOKEN environment variable or login first.', 'yellow');
      return null;
    }
    
    const response = await axios.post(
      `${BASE_URL}/telephony/calls/make`,
      {
        phone_number_id: phoneNumberId,
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

async function monitorAppointments() {
  log('\n📅 Monitoring for new appointments...', 'cyan');
  
  try {
    // Get recent appointments
    const result = await pool.query(
      `SELECT id, patient_name, appointment_date, appointment_type, created_at
       FROM appointments
       ORDER BY created_at DESC
       LIMIT 5`
    );
    
    if (result.rows.length > 0) {
      log(`✅ Found ${result.rows.length} recent appointment(s):`, 'green');
      result.rows.forEach((apt, idx) => {
        log(`   ${idx + 1}. ${apt.patient_name} - ${new Date(apt.appointment_date).toLocaleString()}`, 'blue');
      });
    } else {
      log('⚠️  No appointments found yet', 'yellow');
    }
    
    return result.rows;
  } catch (error) {
    log(`❌ Error monitoring appointments: ${error.message}`, 'red');
    return [];
  }
}

async function checkGoogleCalendarEvents() {
  log('\n📅 Checking Google Calendar for events...', 'cyan');
  
  try {
    const accessToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    
    if (!accessToken) {
      log('⚠️  No Google Calendar access token provided', 'yellow');
      return;
    }
    
    // Get events from last hour
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
        log(`   ${idx + 1}. ${event.summary} - ${event.start.dateTime || event.start.date}`, 'blue');
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
      log(`   Error: ${JSON.stringify(error.response.data)}`, 'red');
    }
  }
}

async function main() {
  log('\n🚀 Starting Test Call with Appointment Booking\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  try {
    // Step 1: Setup Google Calendar integration
    const calendarIntegrationId = await setupGoogleCalendarIntegration();
    
    // Step 2: Find or create phone number (404-738-7870)
    const toPhoneNumber = '404-738-7870';
    const phoneNumberId = await findPhoneNumber(toPhoneNumber);
    
    // Step 3: Find or create agent
    const agentId = await findOrCreateAgent(phoneNumberId);
    
    // Step 4: Get organization ID
    const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
    const organizationId = orgResult.rows[0]?.id || null;
    
    // Step 5: Find from phone number (+17703434007)
    const fromPhoneNumber = '+17703434007';
    const fromPhoneNumberId = await findPhoneNumber(fromPhoneNumber);
    
    // Step 6: Make outbound call
    const callResult = await makeOutboundCall(
      fromPhoneNumber,
      toPhoneNumber,
      agentId,
      fromPhoneNumberId,
      organizationId
    );
    
    if (callResult) {
      log('\n⏳ Waiting 10 seconds for call to connect...', 'yellow');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Step 7: Monitor for appointments
      await monitorAppointments();
      
      // Step 8: Check Google Calendar
      await checkGoogleCalendarEvents();
      
      log('\n✅ Test call completed!', 'green');
      log('\n📝 Next Steps:', 'cyan');
      log('   1. Answer the call when it rings', 'blue');
      log('   2. Say: "I want to book an appointment"', 'blue');
      log('   3. Provide your name and preferred date/time', 'blue');
      log('   4. The bot should book the appointment and sync to Google Calendar', 'blue');
      log('   5. Check Google Calendar to verify the appointment appears', 'blue');
    } else {
      log('\n⚠️  Call was not initiated. Check logs above for errors.', 'yellow');
    }
    
  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { main };
