/**
 * Comprehensive Integration Testing Script
 * Tests all integration endpoints with payloads
 * 
 * Usage: node backend/scripts/test-all-integrations-comprehensive.js [token]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const API_URL = process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000';
const BASE_URL = `${API_URL}/api`;

// Get token from command line or environment
const token = process.argv[2] || process.env.TEST_TOKEN || '';

if (!token) {
  console.error('❌ Error: Authentication token required');
  console.log('Usage: node test-all-integrations-comprehensive.js YOUR_TOKEN');
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
      console.log(`   ✅ Success:`, JSON.stringify(data, null, 2).substring(0, 200));
      results.passed.push({ name, endpoint, status: response.status });
      return { success: true, data };
    } else {
      console.log(`   ❌ Failed: ${response.status} - ${data.message || data.error || 'Unknown error'}`);
      results.failed.push({ name, endpoint, status: response.status, error: data.message || data.error });
      return { success: false, error: data.message || data.error };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    results.failed.push({ name, endpoint, error: error.message });
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting Comprehensive Integration Tests\n');
  console.log(`API URL: ${BASE_URL}`);
  console.log(`Token: ${token.substring(0, 20)}...\n`);

  // ============================================
  // 1. CALENDAR INTEGRATIONS
  // ============================================
  console.log('\n📅 ===== CALENDAR INTEGRATIONS =====\n');

  // 1.1 Get all integrations
  await testEndpoint('Get All Integrations', 'GET', '/integrations');

  // 1.2 Create Google Calendar Integration
  const googleCalendarPayload = {
    name: 'Test Google Calendar',
    type: 'scheduling',
    provider: 'google_calendar',
    credentials: {
      access_token: process.env.TEST_GOOGLE_ACCESS_TOKEN || 'test_token',
      refresh_token: process.env.TEST_GOOGLE_REFRESH_TOKEN || 'test_refresh_token',
      client_id: process.env.TEST_GOOGLE_CLIENT_ID || 'test_client_id',
      client_secret: process.env.TEST_GOOGLE_CLIENT_SECRET || 'test_client_secret',
      calendar_id: 'primary'
    }
  };
  const createCalendarResult = await testEndpoint(
    'Create Google Calendar Integration',
    'POST',
    '/integrations',
    googleCalendarPayload
  );

  let calendarIntegrationId = null;
  if (createCalendarResult.success && createCalendarResult.data?.integration) {
    calendarIntegrationId = createCalendarResult.data.integration.id;
  }

  // 1.3 Test Calendar Connection
  if (calendarIntegrationId) {
    await testEndpoint(
      'Test Google Calendar Connection',
      'POST',
      '/integrations/test/scheduling/google-calendar',
      { integration_id: calendarIntegrationId }
    );
  }

  // 1.4 Update Integration
  if (calendarIntegrationId) {
    await testEndpoint(
      'Update Calendar Integration',
      'PUT',
      `/integrations/${calendarIntegrationId}`,
      { is_active: true }
    );
  }

  // 1.5 Delete Integration (cleanup)
  if (calendarIntegrationId) {
    await testEndpoint(
      'Delete Calendar Integration',
      'DELETE',
      `/integrations/${calendarIntegrationId}`
    );
  }

  // ============================================
  // 2. CRM INTEGRATIONS (GoHighLevel)
  // ============================================
  console.log('\n💼 ===== CRM INTEGRATIONS (GoHighLevel) =====\n');

  // 2.1 Get GHL Auth URL
  await testEndpoint('Get GoHighLevel Auth URL', 'GET', '/integrations/ghl/auth-url');

  // 2.2 Test GHL Callback (requires actual code)
  // await testEndpoint(
  //   'GoHighLevel Callback',
  //   'POST',
  //   '/integrations/ghl/callback',
  //   { code: 'test_code' }
  // );

  // ============================================
  // 3. APPOINTMENT BOOKING (Multi-System)
  // ============================================
  console.log('\n📋 ===== APPOINTMENT BOOKING =====\n');

  // 3.1 Create Appointment
  const appointmentPayload = {
    patient_name: 'John Doe',
    patient_phone: '+1234567890',
    patient_email: 'john@example.com',
    appointment_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    appointment_type: 'General Checkup',
    notes: 'Test appointment from comprehensive test script'
  };

  // First, get or create a conversation
  const conversationsResult = await testEndpoint('Get Conversations', 'GET', '/conversations?limit=1');
  let conversationId = null;
  
  if (conversationsResult.success && conversationsResult.data?.conversations?.length > 0) {
    conversationId = conversationsResult.data.conversations[0].id;
  } else {
    // Create a test conversation
    const agentsResult = await testEndpoint('Get Agents', 'GET', '/agents');
    if (agentsResult.success && agentsResult.data?.agents?.length > 0) {
      const agentId = agentsResult.data.agents[0].id;
      const createConvResult = await testEndpoint(
        'Create Test Conversation',
        'POST',
        '/conversations',
        { agent_id: agentId, patient_name: 'Test Patient', patient_phone: '+1234567890' }
      );
      if (createConvResult.success && createConvResult.data?.conversation) {
        conversationId = createConvResult.data.conversation.id;
      }
    }
  }

  if (conversationId) {
    const appointmentResult = await testEndpoint(
      'Create Appointment (Multi-System Sync)',
      'POST',
      '/appointments',
      { ...appointmentPayload, conversation_id: conversationId }
    );

    // 3.2 Test Appointment Sync
    if (appointmentResult.success && appointmentResult.data?.appointment) {
      const appointmentId = appointmentResult.data.appointment.id;
      
      if (calendarIntegrationId) {
        await testEndpoint(
          'Sync Appointment to Calendar',
          'POST',
          `/integrations/appointments/${appointmentId}/sync`,
          { integration_id: calendarIntegrationId }
        );
      }
    }
  }

  // ============================================
  // 4. EHR INTEGRATIONS
  // ============================================
  console.log('\n🏥 ===== EHR INTEGRATIONS =====\n');

  // 4.1 Get EHR Systems
  await testEndpoint('Get EHR Systems', 'GET', '/integrations-ehr/systems');

  // 4.2 Test FHIR Endpoint
  await testEndpoint('Test FHIR Resource Creation', 'POST', '/integrations-ehr/fhir/resource', {
    resourceType: 'Patient',
    name: [{ given: ['John'], family: 'Doe' }],
    telecom: [{ system: 'phone', value: '+1234567890' }]
  });

  // ============================================
  // 5. AGENT CALENDAR CONFIGURATION
  // ============================================
  console.log('\n🤖 ===== AGENT CALENDAR CONFIGURATION =====\n');

  // 5.1 Get Agents
  const agentsResult = await testEndpoint('Get Agents', 'GET', '/agents');
  
  if (agentsResult.success && agentsResult.data?.agents?.length > 0) {
    const agentId = agentsResult.data.agents[0].id;
    
    // 5.2 Update Agent with Calendar
    if (calendarIntegrationId) {
      await testEndpoint(
        'Update Agent with Calendar Integration',
        'PUT',
        `/agents/${agentId}`,
        { calendar_integration_id: calendarIntegrationId }
      );
    }

    // 5.3 Get Agent Details (verify calendar_integration_id)
    await testEndpoint('Get Agent Details', 'GET', `/agents/${agentId}`);
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n\n📊 ===== TEST SUMMARY =====\n');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⏭️  Skipped: ${results.skipped.length}`);

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach((test, index) => {
      console.log(`   ${index + 1}. ${test.name} (${test.endpoint})`);
      console.log(`      Error: ${test.error || 'Unknown error'}`);
    });
  }

  if (results.passed.length > 0) {
    console.log('\n✅ Passed Tests:');
    results.passed.forEach((test, index) => {
      console.log(`   ${index + 1}. ${test.name} (${test.endpoint})`);
    });
  }

  console.log('\n');
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

