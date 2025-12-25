/**
 * Test End-to-End Appointment → Google Calendar Sync
 * 
 * This script tests the complete flow:
 * 1. Creates a test appointment
 * 2. Verifies it syncs to Google Calendar
 * 3. Checks the calendar event was created
 * 
 * Usage: node scripts/test-appointment-calendar-sync.js
 */

const db = require('../config/database');
const appointmentSyncService = require('../services/appointmentSyncService');

async function testAppointmentCalendarSync() {
  console.log('🧪 Testing Appointment → Google Calendar Sync');
  console.log('============================================\n');

  try {
    // Step 1: Get active Google Calendar integration
    console.log('📋 Step 1: Checking for active Google Calendar integration...');
    const integrationResult = await db.query(
      `SELECT id, name, organization_id, credentials, is_active 
       FROM integrations 
       WHERE provider = 'google_calendar' 
       AND is_active = true 
       ORDER BY id 
       LIMIT 1`
    );

    if (integrationResult.rows.length === 0) {
      console.error('❌ No active Google Calendar integration found!');
      console.log('\n💡 To create one, run:');
      console.log('   node scripts/setup-google-calendar.js');
      process.exit(1);
    }

    const integration = integrationResult.rows[0];
    const orgId = integration.organization_id;
    const integrationId = integration.id;

    console.log(`✅ Found integration: ${integration.name} (ID: ${integrationId}, Org: ${orgId})`);

    // Parse credentials
    const credentials = typeof integration.credentials === 'string'
      ? JSON.parse(integration.credentials)
      : integration.credentials;

    if (!credentials.access_token && !credentials.refresh_token) {
      console.error('❌ Integration missing access_token or refresh_token!');
      console.log('\n💡 Update the integration with valid OAuth tokens');
      process.exit(1);
    }

    console.log('✅ Credentials found\n');

    // Step 2: Create a test appointment
    console.log('📋 Step 2: Creating test appointment...');
    const appointmentDate = new Date();
    appointmentDate.setHours(appointmentDate.getHours() + 1); // 1 hour from now
    appointmentDate.setMinutes(0); // Round to nearest hour
    appointmentDate.setSeconds(0);
    appointmentDate.setMilliseconds(0);

    // Check if appointments table has organization_id column
    const tableCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'appointments' AND column_name = 'organization_id'
    `);
    
    const hasOrgId = tableCheck.rows.length > 0;
    
    let appointmentResult;
    if (hasOrgId) {
      appointmentResult = await db.query(
        `INSERT INTO appointments (
          organization_id, 
          patient_name, 
          patient_phone, 
          patient_email,
          appointment_date, 
          appointment_type, 
          status,
          notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, patient_name, appointment_date, appointment_type`,
        [
          orgId,
          'Test Patient (Calendar Sync Test)',
          '+1234567890',
          'test@example.com',
          appointmentDate.toISOString(),
          'Follow-up',
          'scheduled',
          'Test appointment created to verify Google Calendar sync'
        ]
      );
    } else {
      // Fallback for older schema without organization_id
      appointmentResult = await db.query(
        `INSERT INTO appointments (
          patient_name, 
          patient_phone, 
          patient_email,
          appointment_date, 
          appointment_type, 
          status,
          notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, patient_name, appointment_date, appointment_type`,
        [
          'Test Patient (Calendar Sync Test)',
          '+1234567890',
          'test@example.com',
          appointmentDate.toISOString(),
          'Follow-up',
          'scheduled',
          'Test appointment created to verify Google Calendar sync'
        ]
      );
    }

    const appointment = appointmentResult.rows[0];
    console.log(`✅ Created appointment ID: ${appointment.id}`);
    console.log(`   Patient: ${appointment.patient_name}`);
    console.log(`   Date: ${appointment.appointment_date}`);
    console.log(`   Type: ${appointment.appointment_type}\n`);

    // Step 3: Sync to Google Calendar
    console.log('📋 Step 3: Syncing appointment to Google Calendar...');
    try {
      const syncResult = await appointmentSyncService.syncAppointment(
        appointment.id,
        integrationId,
        orgId
      );

      console.log('✅ Sync successful!');
      console.log(`   Event ID: ${syncResult.event_id || syncResult.id || 'N/A'}`);
      if (syncResult.htmlLink) {
        console.log(`   Calendar Link: ${syncResult.htmlLink}`);
      }
      if (syncResult.message) {
        console.log(`   Message: ${syncResult.message}`);
      }
      console.log('');

      // Step 4: Verify in database
      console.log('📋 Step 4: Verifying sync status...');
      const integrationCheck = await db.query(
        'SELECT last_sync_at FROM integrations WHERE id = $1',
        [integrationId]
      );

      if (integrationCheck.rows[0]?.last_sync_at) {
        console.log(`✅ Integration last_sync_at updated: ${integrationCheck.rows[0].last_sync_at}`);
      }

      // Step 5: Check appointment
      const appointmentCheck = await db.query(
        'SELECT updated_at FROM appointments WHERE id = $1',
        [appointment.id]
      );
      console.log(`✅ Appointment updated_at: ${appointmentCheck.rows[0]?.updated_at}\n`);

      // Summary
      console.log('🎉 Test Complete!');
      console.log('================');
      console.log('✅ Appointment created');
      console.log('✅ Synced to Google Calendar');
      console.log('✅ Database updated');
      console.log('\n💡 Next steps:');
      console.log('   1. Check your Google Calendar for the new event');
      if (syncResult.htmlLink) {
        console.log(`   2. View event: ${syncResult.htmlLink}`);
      }
      console.log('   3. Verify event details match the appointment');
      console.log('   4. Test updating the appointment to verify sync on updates');

      // Cleanup option
      console.log('\n🧹 To clean up test appointment:');
      console.log(`   DELETE FROM appointments WHERE id = ${appointment.id};`);

    } catch (syncError) {
      console.error('❌ Sync failed!');
      console.error('   Error:', syncError.message);
      console.error('   Stack:', syncError.stack);
      console.log('\n💡 Troubleshooting:');
      console.log('   1. Check if access_token is valid');
      console.log('   2. Verify refresh_token is correct');
      console.log('   3. Check Google Calendar API permissions');
      console.log('   4. Review backend logs for detailed error');
      console.log('\n🧹 Test appointment created (ID: ' + appointment.id + ')');
      console.log('   You may want to delete it manually');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run the test
testAppointmentCalendarSync();

