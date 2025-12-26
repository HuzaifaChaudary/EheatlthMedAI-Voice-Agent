/**
 * Test "Add EHR System" Endpoint Only
 * Tests POST /api/integrations-ehr/ehr with dummy payload
 * 
 * Usage: node backend/scripts/test-add-ehr-system-only.js [token]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Get base URL - handle cases where API_URL might already include /api
let API_URL = process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000';
// Remove trailing /api if present to avoid duplication
API_URL = API_URL.replace(/\/api\/?$/, '');
const BASE_URL = `${API_URL}/api`;

// Get token from command line or environment
const token = process.argv[2] || process.env.TEST_TOKEN || '';

if (!token) {
  console.error('❌ Error: Authentication token required');
  console.log('Usage: node test-add-ehr-system-only.js YOUR_TOKEN');
  console.log('   or set TEST_TOKEN environment variable');
  console.log('\n💡 To get your token:');
  console.log('   1. Login to the app');
  console.log('   2. Open browser DevTools (F12)');
  console.log('   3. Go to Console tab');
  console.log('   4. Run: localStorage.getItem("token")');
  console.log('   5. Copy the token and use it here');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

async function testAddEHRSystem() {
  console.log('🧪 Testing "Add EHR System" Endpoint\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Check if we need a connector first
    console.log('\n📋 Step 1: Checking for existing connectors...');
    
    const fhirResponse = await fetch(`${BASE_URL}/integrations-ehr/fhir`, {
      method: 'GET',
      headers
    });
    const fhirData = await fhirResponse.json();
    
    let fhirConnectorId = null;
    if (fhirData.connectors && fhirData.connectors.length > 0) {
      fhirConnectorId = fhirData.connectors[0].id;
      console.log(`✅ Found FHIR connector: ${fhirData.connectors[0].name} (ID: ${fhirConnectorId})`);
    } else {
      console.log('⚠️  No FHIR connectors found. Creating one...');
      
      const createConnectorPayload = {
        name: `Test FHIR Connector ${Date.now()}`,
        fhir_version: 'R4',
        base_url: 'https://test-fhir.example.com/fhir',
        resource_types: ['Patient', 'Appointment'],
        authentication_type: 'oauth2',
        credentials: {
          client_id: 'test_client',
          client_secret: 'test_secret',
          token_url: 'https://test-fhir.example.com/oauth/token'
        }
      };
      
      const createConnectorResponse = await fetch(`${BASE_URL}/integrations-ehr/fhir`, {
        method: 'POST',
        headers,
        body: JSON.stringify(createConnectorPayload)
      });
      
      const createConnectorData = await createConnectorResponse.json();
      
      if (createConnectorResponse.ok && createConnectorData.connector) {
        fhirConnectorId = createConnectorData.connector.id;
        console.log(`✅ Created FHIR connector (ID: ${fhirConnectorId})`);
      } else {
        console.log('⚠️  Could not create connector, will test without connector_id');
      }
    }

    // Step 2: Test Add EHR System
    console.log('\n📋 Step 2: Testing POST /api/integrations-ehr/ehr');
    console.log('   Endpoint: POST /api/integrations-ehr/ehr');
    
    const addEHRPayload = {
      name: `Test EHR System ${Date.now()}`,
      vendor: 'Epic',
      ehr_type: 'fhir',
      connection_type: 'fhir',
      connector_id: fhirConnectorId, // Link to connector if available
      connector_type: 'fhir',
      sync_enabled: true,
      sync_frequency: 'real-time'
    };
    
    console.log('\n   Payload:');
    console.log(JSON.stringify(addEHRPayload, null, 2));
    
    const response = await fetch(`${BASE_URL}/integrations-ehr/ehr`, {
      method: 'POST',
      headers,
      body: JSON.stringify(addEHRPayload)
    });
    
    const data = await response.json();
    
    console.log('\n   Response Status:', response.status);
    console.log('   Response Body:');
    console.log(JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ SUCCESS: "Add EHR System" endpoint is WORKING!');
      console.log(`   Created EHR System ID: ${data.ehr_system?.id || 'N/A'}`);
      console.log(`   Name: ${data.ehr_system?.name || 'N/A'}`);
      console.log(`   Vendor: ${data.ehr_system?.vendor || 'N/A'}`);
      console.log(`   Connector ID: ${data.ehr_system?.connector_id || 'NOT LINKED'}`);
      
      if (!data.ehr_system?.connector_id) {
        console.log('\n⚠️  NOTE: EHR System created but NOT linked to a connector.');
        console.log('   To link a connector:');
        console.log(`   PUT /api/integrations-ehr/ehr/${data.ehr_system.id}`);
        console.log('   { "connector_id": <connector_id>, "connector_type": "fhir" }');
      } else {
        console.log('\n✅ EHR System is linked to connector and ready to use!');
      }
      
      return { success: true, data };
    } else {
      console.log('\n❌ FAILED: "Add EHR System" endpoint returned an error');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.message || JSON.stringify(data)}`);
      
      if (response.status === 403) {
        console.log('\n💡 Issue: Admin access required');
        console.log('   Make sure you are logged in as an admin user');
      } else if (response.status === 401) {
        console.log('\n💡 Issue: Authentication failed');
        console.log('   Your token may be expired. Please login again and get a new token');
      } else if (response.status === 400) {
        console.log('\n💡 Issue: Bad request');
        console.log('   Check the payload format and required fields');
      }
      
      return { success: false, error: data };
    }
  } catch (error) {
    console.error('\n❌ ERROR: Network or unhandled error');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    return { success: false, error: error.message };
  }
}

// Run the test
testAddEHRSystem().then(result => {
  console.log('\n' + '='.repeat(60));
  if (result.success) {
    console.log('✅ TEST RESULT: "Add EHR System" endpoint is WORKING');
    process.exit(0);
  } else {
    console.log('❌ TEST RESULT: "Add EHR System" endpoint has ISSUES');
    process.exit(1);
  }
});

