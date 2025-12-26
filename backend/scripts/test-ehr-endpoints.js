/**
 * Test EHR Endpoints with Dummy Payloads
 * Tests all EHR-related endpoints and reports status
 * 
 * Usage: node backend/scripts/test-ehr-endpoints.js [token]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Get base URL - handle cases where it might already include /api
let API_URL = process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000';
// Remove trailing /api if present to avoid duplication
API_URL = API_URL.replace(/\/api\/?$/, '');
const BASE_URL = `${API_URL}/api`;

// Get token from command line or environment
const token = process.argv[2] || process.env.TEST_TOKEN || '';

if (!token) {
  console.error('❌ Error: Authentication token required');
  console.log('Usage: node test-ehr-endpoints.js YOUR_TOKEN');
  console.log('   or set TEST_TOKEN environment variable');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

// Test results
const results = {
  passed: [],
  failed: [],
  skipped: []
};

async function testEndpoint(name, method, endpoint, payload = null) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   ${method} ${endpoint}`);
    
    const options = {
      method,
      headers
    };
    
    if (payload && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(payload);
      console.log(`   Payload:`, JSON.stringify(payload, null, 2));
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ PASSED: ${name}`);
      console.log('   Status:', response.status);
      console.log('   Response:', JSON.stringify(data, null, 2));
      results.passed.push({ name, method, endpoint, status: response.status, data });
      return data;
    } else {
      console.error(`❌ FAILED: ${name}`);
      console.error('   Status:', response.status);
      console.error('   Error:', JSON.stringify(data, null, 2));
      results.failed.push({ name, method, endpoint, status: response.status, error: data });
      return null;
    }
  } catch (error) {
    console.error(`❌ FAILED (Network/Unhandled Error): ${name}`);
    console.error('   Error:', error.message);
    results.failed.push({ name, method, endpoint, error: error.message });
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting EHR Endpoint Tests...\n');

  // --- 1. Test HL7 Connectors ---
  console.log('\n--- HL7 Connector Tests ---');
  
  // Get HL7 connectors
  const hl7Connectors = await testEndpoint('Get HL7 Connectors', 'GET', '/integrations-ehr/hl7');
  let hl7ConnectorId = null;
  
  if (hl7Connectors && hl7Connectors.connectors && hl7Connectors.connectors.length > 0) {
    hl7ConnectorId = hl7Connectors.connectors[0].id;
    console.log(`   Using existing HL7 connector ID: ${hl7ConnectorId}`);
  } else {
    // Create HL7 connector
    const createHL7Payload = {
      name: `Test HL7 Connector ${Date.now()}`,
      hl7_version: '2.8',
      message_types: ['ADT', 'ORM'],
      endpoint_url: 'http://test-ehr.example.com/hl7',
      authentication_type: 'basic',
      credentials: {
        username: 'test_user',
        password: 'test_password'
      }
    };
    const newHL7 = await testEndpoint('Create HL7 Connector', 'POST', '/integrations-ehr/hl7', createHL7Payload);
    if (newHL7 && newHL7.connector) {
      hl7ConnectorId = newHL7.connector.id;
    }
  }

  // --- 2. Test FHIR Connectors ---
  console.log('\n--- FHIR Connector Tests ---');
  
  // Get FHIR connectors
  const fhirConnectors = await testEndpoint('Get FHIR Connectors', 'GET', '/integrations-ehr/fhir');
  let fhirConnectorId = null;
  
  if (fhirConnectors && fhirConnectors.connectors && fhirConnectors.connectors.length > 0) {
    fhirConnectorId = fhirConnectors.connectors[0].id;
    console.log(`   Using existing FHIR connector ID: ${fhirConnectorId}`);
  } else {
    // Create FHIR connector
    const createFHIRPayload = {
      name: `Test FHIR Connector ${Date.now()}`,
      fhir_version: 'R4',
      base_url: 'https://test-fhir.example.com/fhir',
      resource_types: ['Patient', 'Appointment', 'Encounter'],
      authentication_type: 'oauth2',
      credentials: {
        client_id: 'test_client_id',
        client_secret: 'test_client_secret',
        token_url: 'https://test-fhir.example.com/oauth/token'
      }
    };
    const newFHIR = await testEndpoint('Create FHIR Connector', 'POST', '/integrations-ehr/fhir', createFHIRPayload);
    if (newFHIR && newFHIR.connector) {
      fhirConnectorId = newFHIR.connector.id;
    }
  }

  // --- 3. Test EHR Systems ---
  console.log('\n--- EHR System Tests ---');
  
  // Get EHR systems
  const ehrSystems = await testEndpoint('Get EHR Systems', 'GET', '/integrations-ehr/ehr');
  let ehrSystemId = null;
  
  if (ehrSystems && ehrSystems.ehr_systems && ehrSystems.ehr_systems.length > 0) {
    ehrSystemId = ehrSystems.ehr_systems[0].id;
    const system = ehrSystems.ehr_systems[0];
    console.log(`   Using existing EHR system ID: ${ehrSystemId}`);
    console.log(`   System: ${system.name} (${system.vendor})`);
    console.log(`   Connector ID: ${system.connector_id || 'NOT LINKED'}`);
    console.log(`   Connector Type: ${system.connector_type || 'NONE'}`);
    
    // If no connector linked, try to link one
    if (!system.connector_id) {
      console.log('\n   ⚠️  EHR system has no connector linked!');
      if (fhirConnectorId && system.connection_type === 'fhir') {
        console.log(`   Attempting to link FHIR connector ${fhirConnectorId}...`);
        const linkPayload = {
          connector_id: fhirConnectorId,
          connector_type: 'fhir',
          sync_enabled: true,
          is_active: true
        };
        await testEndpoint(`Link FHIR Connector to EHR System ${ehrSystemId}`, 'PUT', `/integrations-ehr/ehr/${ehrSystemId}`, linkPayload);
      } else if (hl7ConnectorId && system.connection_type === 'hl7') {
        console.log(`   Attempting to link HL7 connector ${hl7ConnectorId}...`);
        const linkPayload = {
          connector_id: hl7ConnectorId,
          connector_type: 'hl7',
          sync_enabled: true,
          is_active: true
        };
        await testEndpoint(`Link HL7 Connector to EHR System ${ehrSystemId}`, 'PUT', `/integrations-ehr/ehr/${ehrSystemId}`, linkPayload);
      } else {
        console.log('   ⚠️  No matching connector available to link');
      }
    }
  } else {
    // Create EHR system
    const createEHRPayload = {
      name: `Test EHR System ${Date.now()}`,
      vendor: 'Epic',
      ehr_type: 'fhir',
      connection_type: 'fhir',
      connector_id: fhirConnectorId, // Link to FHIR connector if available
      connector_type: 'fhir',
      sync_enabled: true,
      sync_frequency: 'real-time'
    };
    const newEHR = await testEndpoint('Create EHR System', 'POST', '/integrations-ehr/ehr', createEHRPayload);
    if (newEHR && newEHR.ehr_system) {
      ehrSystemId = newEHR.ehr_system.id;
    }
  }

  // --- 4. Test EHR Sync (if system exists) ---
  if (ehrSystemId) {
    console.log('\n--- EHR Sync Tests ---');
    
    // Test sync patient data
    const syncPatientPayload = {
      patient_id: 'test-patient-123',
      patient_name: 'John Doe',
      date_of_birth: '1980-01-01',
      gender: 'male',
      phone: '+1234567890',
      email: 'john.doe@example.com'
    };
    await testEndpoint('Sync Patient to EHR', 'POST', `/integrations-ehr/ehr/${ehrSystemId}/sync/patient`, syncPatientPayload);
    
    // Test sync appointment
    const syncAppointmentPayload = {
      appointment_id: 'test-appt-123',
      patient_id: 'test-patient-123',
      appointment_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      appointment_type: 'General Checkup',
      provider_name: 'Dr. Smith',
      notes: 'Test appointment sync'
    };
    await testEndpoint('Sync Appointment to EHR', 'POST', `/integrations-ehr/ehr/${ehrSystemId}/sync/appointment`, syncAppointmentPayload);
  } else {
    console.log('\n--- EHR Sync Tests ---');
    console.log('⏭️  Skipped: No EHR system available for sync tests');
    results.skipped.push({ name: 'EHR Sync Tests', reason: 'No EHR system available' });
  }

  // --- Summary ---
  console.log('\n--- Test Summary ---');
  console.log(`  ✅ Passed: ${results.passed.length}`);
  console.log(`  ❌ Failed: ${results.failed.length}`);
  console.log(`  ⏭️ Skipped: ${results.skipped.length}`);

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(test => {
      console.error(`- ${test.name} (${test.method} ${test.endpoint})`);
      if (test.status) console.error(`  Status: ${test.status}`);
      if (test.error) console.error(`  Error:`, JSON.stringify(test.error, null, 2));
    });
  }

  if (results.passed.length > 0) {
    console.log('\n✅ Passed Tests:');
    results.passed.forEach(test => {
      console.log(`- ${test.name} (${test.method} ${test.endpoint}) - Status: ${test.status}`);
    });
  }

  // Check connector linking status
  console.log('\n--- Connector Linking Status ---');
  const finalEHRCheck = await testEndpoint('Final EHR Systems Check', 'GET', '/integrations-ehr/ehr');
  if (finalEHRCheck && finalEHRCheck.ehr_systems) {
    finalEHRCheck.ehr_systems.forEach((system) => {
      if (system.connector_id) {
        console.log(`✅ ${system.name}: Linked to ${system.connector_type} connector ${system.connector_id}`);
      } else {
        console.log(`⚠️  ${system.name}: NOT LINKED to any connector`);
        console.log(`   Action needed: Link a ${system.connection_type} connector in /architecture/ehr`);
      }
    });
  }

  process.exit(results.failed.length > 0 ? 1 : 0);
}

runTests();

