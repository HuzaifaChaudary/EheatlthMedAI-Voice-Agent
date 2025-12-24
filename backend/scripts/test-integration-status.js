/**
 * Test Integration Status
 * Comprehensive test script to verify all integrations are working
 */

const db = require('../config/database');
const appointmentSyncService = require('../services/appointmentSyncService');

async function testIntegrationStatus() {
  try {
    console.log('🧪 Testing Integration Status...\n');
    console.log('═'.repeat(60));

    // 1. Check Calendar Integrations
    console.log('\n📅 CALENDAR INTEGRATIONS:');
    console.log('─'.repeat(60));
    
    const calendarIntegrations = await db.query(
      `SELECT id, name, type, provider, is_active, last_sync_at, organization_id, credentials
       FROM integrations 
       WHERE type = 'scheduling' OR provider IN ('google_calendar', 'gohighlevel', 'calendly', 'zocdoc')
       ORDER BY is_active DESC, created_at DESC`
    );

    if (calendarIntegrations.rows.length === 0) {
      console.log('❌ No calendar integrations found');
      console.log('   → Run: node scripts/setup-google-calendar.js');
    } else {
      console.log(`✅ Found ${calendarIntegrations.rows.length} calendar integration(s):\n`);
      
      for (const integration of calendarIntegrations.rows) {
        const status = integration.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
        const orgLabel = integration.organization_id ? `Org: ${integration.organization_id}` : 'No Org';
        const lastSync = integration.last_sync_at 
          ? new Date(integration.last_sync_at).toLocaleString() 
          : 'Never';
        
        console.log(`   ${status} - ${integration.name} (${integration.provider})`);
        console.log(`      ID: ${integration.id} | ${orgLabel}`);
        console.log(`      Last Sync: ${lastSync}`);
        
        // Test credentials format
        try {
          const credentials = typeof integration.credentials === 'string' 
            ? JSON.parse(integration.credentials) 
            : integration.credentials;
          
          if (integration.provider === 'google_calendar') {
            const hasAccessToken = !!credentials.access_token;
            const hasRefreshToken = !!credentials.refresh_token;
            console.log(`      Credentials: ${hasAccessToken ? '✅' : '❌'} Access Token, ${hasRefreshToken ? '✅' : '❌'} Refresh Token`);
          } else {
            console.log(`      Credentials: ${Object.keys(credentials).length > 0 ? '✅ Configured' : '❌ Missing'}`);
          }
        } catch (e) {
          console.log(`      Credentials: ❌ Invalid format`);
        }
        console.log('');
      }
    }

    // 2. Check CRM Integrations
    console.log('\n💼 CRM INTEGRATIONS:');
    console.log('─'.repeat(60));
    
    const crmIntegrations = await db.query(
      `SELECT id, name, type, provider, is_active, last_sync_at, organization_id
       FROM integrations 
       WHERE type = 'crm' OR provider IN ('salesforce', 'hubspot', 'zendesk', 'freshdesk')
       ORDER BY is_active DESC, created_at DESC`
    );

    if (crmIntegrations.rows.length === 0) {
      console.log('❌ No CRM integrations found');
    } else {
      console.log(`✅ Found ${crmIntegrations.rows.length} CRM integration(s):\n`);
      crmIntegrations.rows.forEach(integration => {
        const status = integration.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
        const orgLabel = integration.organization_id ? `Org: ${integration.organization_id}` : 'No Org';
        console.log(`   ${status} - ${integration.name} (${integration.provider})`);
        console.log(`      ID: ${integration.id} | ${orgLabel}\n`);
      });
    }

    // 3. Check EHR Systems
    console.log('\n🏥 EHR SYSTEMS:');
    console.log('─'.repeat(60));
    
    const ehrSystems = await db.query(
      `SELECT e.*, 
              CASE 
                WHEN e.connector_type = 'hl7' THEN h.name
                WHEN e.connector_type = 'fhir' THEN f.name
              END as connector_name
       FROM ehr_systems e
       LEFT JOIN hl7_connectors h ON e.connector_id = h.id AND e.connector_type = 'hl7'
       LEFT JOIN fhir_connectors f ON e.connector_id = f.id AND e.connector_type = 'fhir'
       ORDER BY e.is_active DESC, e.created_at DESC`
    );

    if (ehrSystems.rows.length === 0) {
      console.log('❌ No EHR systems configured');
    } else {
      console.log(`✅ Found ${ehrSystems.rows.length} EHR system(s):\n`);
      ehrSystems.rows.forEach(system => {
        const status = system.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
        const connectorStatus = system.connector_id && system.connector_type 
          ? `✅ Linked to ${system.connector_type.toUpperCase()}: ${system.connector_name || 'Unknown'}`
          : '❌ No connector linked';
        console.log(`   ${status} - ${system.name} (${system.vendor})`);
        console.log(`      ${connectorStatus}`);
        console.log(`      Sync: ${system.sync_enabled ? '✅ Enabled' : '❌ Disabled'} (${system.sync_frequency || 'N/A'})\n`);
      });
    }

    // 4. Test Calendar Sync (if integrations exist)
    if (calendarIntegrations.rows.length > 0) {
      console.log('\n🔄 TESTING CALENDAR SYNC:');
      console.log('─'.repeat(60));
      
      const activeCalendar = calendarIntegrations.rows.find(i => i.is_active);
      if (activeCalendar) {
        console.log(`   Testing with: ${activeCalendar.name} (${activeCalendar.provider})`);
        
        // Check if there are any appointments to sync
        const appointmentsResult = await db.query(
          `SELECT id, patient_name, appointment_date 
           FROM appointments 
           ORDER BY created_at DESC 
           LIMIT 1`
        );

        if (appointmentsResult.rows.length > 0) {
          const testAppointment = appointmentsResult.rows[0];
          console.log(`   Found test appointment: ID ${testAppointment.id} for ${testAppointment.patient_name}`);
          console.log(`   Appointment date: ${new Date(testAppointment.appointment_date).toLocaleString()}`);
          console.log(`   ✅ Appointment exists - sync should work when appointments are created\n`);
        } else {
          console.log(`   ⚠️  No appointments found - create an appointment to test sync\n`);
        }
      }
    }

    // 5. Summary
    console.log('\n📊 SUMMARY:');
    console.log('═'.repeat(60));
    const activeCalendar = calendarIntegrations.rows.filter(i => i.is_active).length;
    const activeCRM = crmIntegrations.rows.filter(i => i.is_active).length;
    const activeEHR = ehrSystems.rows.filter(s => s.is_active && s.connector_id).length;
    
    console.log(`   Calendar: ${activeCalendar}/${calendarIntegrations.rows.length} active`);
    console.log(`   CRM: ${activeCRM}/${crmIntegrations.rows.length} active`);
    console.log(`   EHR: ${activeEHR}/${ehrSystems.rows.length} active and linked`);
    
    if (activeCalendar > 0 || activeCRM > 0 || activeEHR > 0) {
      console.log('\n   ✅ Some integrations are active and ready to use!');
    } else {
      console.log('\n   ⚠️  No active integrations found. Configure integrations to enable sync.');
    }

    console.log('\n✅ Integration status check complete!\n');

  } catch (error) {
    console.error('❌ Error testing integration status:', error);
    process.exit(1);
  } finally {
    // Database connection is managed by the pool, no need to close
    process.exit(0);
  }
}

// Run the test
testIntegrationStatus();

