/**
 * Test DELETE /api/integrations/:id endpoint
 * Usage: node backend/scripts/test-delete-integration-endpoint.js [token] [integrationId]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const API_URL = process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000';
const BASE_URL = `${API_URL}/api`;

// Get token and integration ID from command line
const token = process.argv[2] || process.env.TEST_TOKEN || '';
const integrationId = process.argv[3] || '';

if (!token) {
  console.error('❌ Error: Authentication token required');
  console.log('Usage: node test-delete-integration-endpoint.js YOUR_TOKEN [INTEGRATION_ID]');
  console.log('   or set TEST_TOKEN environment variable');
  process.exit(1);
}

async function testDeleteEndpoint() {
  try {
    console.log('🧪 Testing DELETE /api/integrations/:id endpoint\n');
    
    // First, get list of integrations to find an ID
    console.log('1️⃣ Fetching integrations list...');
    const listResponse = await fetch(`${BASE_URL}/integrations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const listData = await listResponse.json();
    console.log('   Status:', listResponse.status);
    console.log('   Response:', JSON.stringify(listData, null, 2));

    if (!listResponse.ok) {
      console.error('❌ Failed to fetch integrations');
      return;
    }

    const integrations = listData.integrations || [];
    console.log(`\n✅ Found ${integrations.length} integration(s)\n`);

    if (integrations.length === 0) {
      console.log('⚠️  No integrations found. Cannot test delete endpoint.');
      return;
    }

    // Use provided ID or first integration
    const testId = integrationId || integrations[0].id;
    const integration = integrations.find(i => i.id === parseInt(testId)) || integrations[0];
    
    console.log(`2️⃣ Testing DELETE on integration:`);
    console.log(`   ID: ${integration.id}`);
    console.log(`   Name: ${integration.name}`);
    console.log(`   Type: ${integration.type}`);
    console.log(`   Provider: ${integration.provider}\n`);

    // Test DELETE endpoint
    console.log(`3️⃣ Sending DELETE request to /api/integrations/${integration.id}...`);
    const deleteResponse = await fetch(`${BASE_URL}/integrations/${integration.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const deleteData = await deleteResponse.json();
    console.log('   Status:', deleteResponse.status);
    console.log('   Response:', JSON.stringify(deleteData, null, 2));

    if (deleteResponse.ok) {
      console.log('\n✅ DELETE endpoint works correctly!');
      console.log(`   Integration ${integration.id} deleted successfully.`);
    } else {
      console.error('\n❌ DELETE endpoint failed!');
      console.error('   Error:', deleteData.message || deleteData.error);
      
      if (deleteResponse.status === 404) {
        console.error('\n💡 Possible issues:');
        console.error('   - Route not registered in server.js');
        console.error('   - Route path mismatch');
        console.error('   - Integration ID not found');
      } else if (deleteResponse.status === 403) {
        console.error('\n💡 Possible issues:');
        console.error('   - User does not have admin role');
        console.error('   - Authentication token invalid');
      } else if (deleteResponse.status === 401) {
        console.error('\n💡 Possible issues:');
        console.error('   - Authentication token expired or invalid');
      }
    }

    // Verify deletion
    console.log('\n4️⃣ Verifying deletion...');
    const verifyResponse = await fetch(`${BASE_URL}/integrations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const verifyData = await verifyResponse.json();
    const remainingIntegrations = verifyData.integrations || [];
    const stillExists = remainingIntegrations.some(i => i.id === integration.id);

    if (stillExists) {
      console.log('   ⚠️  Integration still exists in list (may not have been deleted)');
    } else {
      console.log('   ✅ Integration removed from list (deletion confirmed)');
    }

  } catch (error) {
    console.error('❌ Error testing endpoint:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testDeleteEndpoint();

