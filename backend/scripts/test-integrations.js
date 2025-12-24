/**
 * Test Calendar and EHR/CRM Integration Status
 * Checks if integrations are configured and active
 */

const db = require('../config/database');

async function testIntegrations() {
  try {
    console.log('🔍 Testing Calendar and EHR/CRM Integration Status...\n');

    // 1. Check Calendar Integrations (Google Calendar, GoHighLevel, etc.)
    console.log('📅 CALENDAR INTEGRATIONS:');
    console.log('─'.repeat(50));
    
    const calendarIntegrations = await db.query(
      `SELECT id, name, type, provider, is_active, last_sync_at, created_at, organization_id
       FROM integrations 
       WHERE type = 'scheduling' OR provider IN ('google_calendar', 'gohighlevel', 'calendly', 'zocdoc')
       ORDER BY created_at DESC`
    );

    if (calendarIntegrations.rows.length === 0) {
      console.log('❌ No calendar integrations found');
      console.log('   → Users need to configure calendar integrations in Settings → Integrations');
    } else {
      calendarIntegrations.rows.forEach(integration => {
        const status = integration.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
        const lastSync = integration.last_sync_at 
          ? new Date(integration.last_sync_at).toLocaleString() 
          : 'Never';
        console.log(`   ${status} - ${integration.name} (${integration.provider})`);
        console.log(`      Organization ID: ${integration.organization_id || 'NULL'}`);
        console.log(`      Last Sync: ${lastSync}`);
        console.log(`      Created: ${new Date(integration.created_at).toLocaleString()}`);
        console.log('');
      });
    }

    // 2. Check EHR Systems
    console.log('\n🏥 EHR SYSTEMS:');
    console.log('─'.repeat(50));
    
    const ehrSystems = await db.query(
      `SELECT e.*, 
              CASE 
                WHEN e.connector_type = 'hl7' THEN h.name
                WHEN e.connector_type = 'fhir' THEN f.name
              END as connector_name
       FROM ehr_systems e
       LEFT JOIN hl7_connectors h ON e.connector_id = h.id AND e.connector_type = 'hl7'
       LEFT JOIN fhir_connectors f ON e.connector_id = f.id AND e.connector_type = 'fhir'
       ORDER BY e.created_at DESC`
    );

    if (ehrSystems.rows.length === 0) {
      console.log('❌ No EHR systems configured');
      console.log('   → Users need to configure EHR systems in Architecture → EHR');
    } else {
      ehrSystems.rows.forEach(system => {
        const status = system.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
        const connectorStatus = system.connector_id && system.connector_type 
          ? `✅ Linked to ${system.connector_type.toUpperCase()} connector: ${system.connector_name || 'Unknown'}`
          : '❌ No connector linked';
        const syncStatus = system.sync_enabled ? '✅ Sync Enabled' : '❌ Sync Disabled';
        
        console.log(`   ${status} - ${system.name} (${system.vendor})`);
        console.log(`      Organization ID: ${system.organization_id || 'NULL'}`);
        console.log(`      ${connectorStatus}`);
        console.log(`      ${syncStatus} (${system.sync_frequency || 'N/A'})`);
        console.log(`      Connection Type: ${system.connection_type || system.ehr_type || 'N/A'}`);
        console.log('');
      });
    }

    // 3. Check HL7 Connectors
    console.log('\n📡 HL7 CONNECTORS:');
    console.log('─'.repeat(50));
    
    const hl7Connectors = await db.query(
      'SELECT id, name, hl7_version, endpoint_url, is_active, organization_id, created_at FROM hl7_connectors ORDER BY created_at DESC'
    );

    if (hl7Connectors.rows.length === 0) {
      console.log('❌ No HL7 connectors configured');
      console.log('   → Users need to configure HL7 connectors in Architecture → HL7');
    } else {
      hl7Connectors.rows.forEach(connector => {
        const status = connector.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
        console.log(`   ${status} - ${connector.name}`);
        console.log(`      Organization ID: ${connector.organization_id || 'NULL'}`);
        console.log(`      HL7 Version: ${connector.hl7_version || 'N/A'}`);
        console.log(`      Endpoint: ${connector.endpoint_url || 'N/A'}`);
        console.log('');
      });
    }

    // 4. Check FHIR Connectors
    console.log('\n🔗 FHIR CONNECTORS:');
    console.log('─'.repeat(50));
    
    const fhirConnectors = await db.query(
      'SELECT id, name, fhir_version, base_url, is_active, organization_id, created_at FROM fhir_connectors ORDER BY created_at DESC'
    );

    if (fhirConnectors.rows.length === 0) {
      console.log('❌ No FHIR connectors configured');
      console.log('   → Users need to configure FHIR connectors in Architecture → FHIR');
    } else {
      fhirConnectors.rows.forEach(connector => {
        const status = connector.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
        console.log(`   ${status} - ${connector.name}`);
        console.log(`      Organization ID: ${connector.organization_id || 'NULL'}`);
        console.log(`      FHIR Version: ${connector.fhir_version || 'N/A'}`);
        console.log(`      Base URL: ${connector.base_url || 'N/A'}`);
        console.log('');
      });
}

    // 5. Check CRM Integrations
    console.log('\n💼 CRM INTEGRATIONS:');
    console.log('─'.repeat(50));
    
    const crmIntegrations = await db.query(
      `SELECT id, name, type, provider, is_active, last_sync_at, created_at, organization_id
       FROM integrations 
       WHERE type = 'crm' OR provider IN ('salesforce', 'hubspot', 'zendesk', 'freshdesk')
       ORDER BY created_at DESC`
    );

    if (crmIntegrations.rows.length === 0) {
      console.log('❌ No CRM integrations found');
      console.log('   → Users need to configure CRM integrations in Settings → Integrations');
    } else {
      crmIntegrations.rows.forEach(integration => {
        const status = integration.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
        const lastSync = integration.last_sync_at 
          ? new Date(integration.last_sync_at).toLocaleString() 
          : 'Never';
        console.log(`   ${status} - ${integration.name} (${integration.provider})`);
        console.log(`      Organization ID: ${integration.organization_id || 'NULL'}`);
        console.log(`      Last Sync: ${lastSync}`);
        console.log('');
      });
    }

    // 6. Summary
    console.log('\n📊 SUMMARY:');
    console.log('─'.repeat(50));
    console.log(`   Calendar Integrations: ${calendarIntegrations.rows.length} (${calendarIntegrations.rows.filter(i => i.is_active).length} active)`);
    console.log(`   EHR Systems: ${ehrSystems.rows.length} (${ehrSystems.rows.filter(s => s.is_active).length} active)`);
    console.log(`   HL7 Connectors: ${hl7Connectors.rows.length} (${hl7Connectors.rows.filter(c => c.is_active).length} active)`);
    console.log(`   FHIR Connectors: ${fhirConnectors.rows.length} (${fhirConnectors.rows.filter(c => c.is_active).length} active)`);
    console.log(`   CRM Integrations: ${crmIntegrations.rows.length} (${crmIntegrations.rows.filter(i => i.is_active).length} active)`);

    // 7. Check if integrations are properly linked
    console.log('\n🔗 LINKAGE STATUS:');
    console.log('─'.repeat(50));
    
    const unlinkedEHR = ehrSystems.rows.filter(s => !s.connector_id || !s.connector_type);
    if (unlinkedEHR.length > 0) {
      console.log(`   ⚠️  ${unlinkedEHR.length} EHR system(s) without connectors:`);
      unlinkedEHR.forEach(system => {
        console.log(`      - ${system.name} (ID: ${system.id})`);
    });
      console.log('   → These systems need to be linked to HL7 or FHIR connectors to work');
    } else if (ehrSystems.rows.length > 0) {
      console.log('   ✅ All EHR systems are properly linked to connectors');
    }

    // 8. Check organization isolation
    console.log('\n🏢 ORGANIZATION ISOLATION:');
    console.log('─'.repeat(50));
    
    const orgsWithIntegrations = await db.query(
      `SELECT DISTINCT organization_id, COUNT(*) as integration_count
       FROM (
         SELECT organization_id FROM integrations
         UNION ALL
         SELECT organization_id FROM ehr_systems
         UNION ALL
         SELECT organization_id FROM hl7_connectors
         UNION ALL
         SELECT organization_id FROM fhir_connectors
       ) AS all_integrations
       WHERE organization_id IS NOT NULL
       GROUP BY organization_id`
    );

    if (orgsWithIntegrations.rows.length === 0) {
      console.log('   ⚠️  All integrations are at organization_id = NULL (not isolated)');
    } else {
      console.log(`   ✅ Integrations found for ${orgsWithIntegrations.rows.length} organization(s):`);
      orgsWithIntegrations.rows.forEach(org => {
        console.log(`      - Organization ID ${org.organization_id}: ${org.integration_count} integration(s)`);
      });
    }

    console.log('\n✅ Integration check complete!\n');
    
  } catch (error) {
    console.error('❌ Error testing integrations:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run the test
testIntegrations();
