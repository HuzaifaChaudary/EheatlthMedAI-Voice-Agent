/**
 * Force Booking Test - Directly calls book_appointment function
 * Tests the booking flow end-to-end
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

async function setupGoogleCalendar(organizationId) {
  log('\n📅 Setting up Google Calendar integration...', 'cyan');
  
  try {
    // Use provided organization ID or get first one
    let orgId = organizationId;
    if (!orgId) {
      const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
      orgId = orgResult.rows[0]?.id || null;
    }
    
    // Check if integration exists for this org
    const result = await pool.query(
      `SELECT id, credentials FROM integrations 
       WHERE provider = 'google_calendar' 
       AND type = 'scheduling' 
       AND organization_id = $1
       AND is_active = true 
       LIMIT 1`,
      [orgId]
    );
    
    let integrationId;
    
    if (result.rows.length > 0) {
      const integration = result.rows[0];
      integrationId = integration.id;
      const credentials = typeof integration.credentials === 'string' 
        ? JSON.parse(integration.credentials) 
        : integration.credentials;
      
      // Update with fresh tokens
      credentials.access_token = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
      credentials.refresh_token = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
      credentials.client_id = process.env.GOOGLE_CALENDAR_CLIENT_ID;
      credentials.client_secret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '';
      credentials.calendar_id = process.env.GOOGLE_CALENDAR_ID || 'primary';
      
      await pool.query(
        'UPDATE integrations SET credentials = $1, is_active = true WHERE id = $2',
        [JSON.stringify(credentials), integrationId]
      );
      
      log(`✅ Updated Google Calendar integration (ID: ${integrationId})`, 'green');
    } else {
      // Create new
      const credentials = {
        access_token: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN,
        refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '',
        calendar_id: process.env.GOOGLE_CALENDAR_ID || 'primary'
      };
      
      const insertResult = await pool.query(
        `INSERT INTO integrations (organization_id, name, type, provider, credentials, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [orgId, 'Google Calendar', 'scheduling', 'google_calendar', JSON.stringify(credentials), true]
      );
      
      integrationId = insertResult.rows[0].id;
      log(`✅ Created Google Calendar integration (ID: ${integrationId})`, 'green');
    }
    
    return integrationId;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    console.error(error);
    return null;
  }
}

async function linkAgentToCalendar(agentId, calendarIntegrationId) {
  try {
    await pool.query(
      'UPDATE ai_agents SET calendar_integration_id = $1 WHERE id = $2',
      [calendarIntegrationId, agentId]
    );
    log(`✅ Linked agent ${agentId} to calendar integration ${calendarIntegrationId}`, 'green');
  } catch (error) {
    log(`❌ Error linking: ${error.message}`, 'red');
  }
}

async function testDirectBooking() {
  log('\n🚀 Force Booking Test - Direct Function Call\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // Get organization from database first
  const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
  const organizationId = orgResult.rows[0]?.id || null;
  log(`✅ Organization ID: ${organizationId}`, 'green');
  
  // Setup Google Calendar with organization ID
  const calendarIntegrationId = await setupGoogleCalendar(organizationId);
  
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
  
  // Link to calendar
  if (calendarIntegrationId) {
    await linkAgentToCalendar(agent.id, calendarIntegrationId);
  }
  
  // Create conversation directly in database to ensure it exists
  const orgCheckResult = await pool.query('SELECT id FROM organizations LIMIT 1');
  const orgId = orgCheckResult.rows[0]?.id || organizationId;
  
  const convResult = await pool.query(
    `INSERT INTO conversations (organization_id, agent_id, patient_name, patient_phone, status)
     VALUES ($1, $2, $3, $4, 'active')
     RETURNING id`,
    [orgId, agent.id, 'John Smith', '555-123-4567']
  );
  
  const conversationId = convResult.rows[0].id;
  log(`✅ Conversation created: ${conversationId}`, 'green');
  
  // Calculate appointment date (tomorrow at 2 PM)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);
  const appointmentDate = tomorrow.toISOString();
  
  log(`\n📅 Booking appointment directly...`, 'cyan');
  log(`   Patient: John Smith`, 'blue');
  log(`   Date: ${appointmentDate}`, 'blue');
  log(`   Type: General Checkup`, 'blue');
  
  // Directly call the booking service
  const appointmentBookingService = require('../services/appointmentBookingService');
  
  try {
    const appointment = await appointmentBookingService.bookAppointment(
      conversationId,
      {
        patient_name: 'John Smith',
        patient_phone: '555-123-4567',
        appointment_date: appointmentDate,
        appointment_type: 'General Checkup',
        notes: 'Test appointment booking'
      },
      organizationId
    );
    
    log(`\n✅ APPOINTMENT BOOKED!`, 'green');
    log(`   Appointment ID: ${appointment.id}`, 'blue');
    log(`   Patient: ${appointment.patient_name}`, 'blue');
    log(`   Date: ${new Date(appointment.appointment_date).toLocaleString()}`, 'blue');
    log(`   Status: ${appointment.status}`, 'blue');
    
    // Manually sync to Google Calendar
    if (calendarIntegrationId) {
      log('\n📅 Syncing to Google Calendar...', 'cyan');
      try {
        const appointmentSyncService = require('../services/appointmentSyncService');
        const syncResult = await appointmentSyncService.syncAppointment(
          appointment.id,
          calendarIntegrationId,
          organizationId
        );
        log(`✅ Synced to Google Calendar!`, 'green');
        log(`   Event ID: ${syncResult.eventId}`, 'blue');
        log(`   Link: ${syncResult.htmlLink}`, 'blue');
      } catch (syncError) {
        log(`⚠️  Sync error: ${syncError.message}`, 'yellow');
        log(`   Appointment is saved in database, but Google Calendar sync failed.`, 'yellow');
      }
    }
    
    // Wait and check
    log('\n⏳ Waiting 2 seconds...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check Google Calendar
    await checkGoogleCalendar();
    
  } catch (error) {
    log(`❌ Error booking: ${error.message}`, 'red');
    console.error(error);
  }
}

async function checkGoogleCalendar() {
  const accessToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  
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
      log('⚠️  Google Calendar token expired. Need to refresh.', 'yellow');
      log('   The appointment was created in database, but sync to Google Calendar failed.', 'yellow');
    } else {
      log(`❌ Error: ${error.message}`, 'red');
    }
  }
}

testDirectBooking()
  .then(() => {
    log('\n✅ Test completed!', 'green');
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    pool.end();
    process.exit(1);
  });
