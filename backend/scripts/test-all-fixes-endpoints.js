/**
 * Test All Integration Fixes Endpoints
 * Tests all endpoints we created/modified with actual payloads
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const API_URL = process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000';
const BASE_URL = `${API_URL}/api`;

// Get token from command line or environment
const token = process.argv[2] || process.env.TEST_TOKEN || '';

if (!token) {
  console.error('❌ Error: Authentication token required');
  console.log('Usage: node test-all-fixes-endpoints.js YOUR_TOKEN');
  console.log('   or set TEST_TOKEN environment variable');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

const results = {
  passed: [],
  failed: [],
  errors: []
};

async function testEndpoint(name, method, endpoint, payload = null, expectedStatus = 200) {
  try {
    const options = {
      method,
      headers
    };
    
    if (payload && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(payload);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json().catch(() => ({ message: response.statusText }));
    
    if (response.status === expectedStatus || (expectedStatus === 200 && response.ok)) {
      results.passed.push({ name, endpoint, status: response.status });
      return { success: true, data, status: response.status };
    } else {
      results.failed.push({ name, endpoint, status: response.status, error: data.message || data.error });
      return { success: false, error: data.message || data.error, status: response.status };
    }
  } catch (error) {
    results.errors.push({ name, endpoint, error: error.message });
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Testing All Integration Fixes Endpoints\n');
  console.log(`API URL: ${BASE_URL}\n`);

  // ============================================
  // 1. USER INVITATION & ORGANIZATION ASSIGNMENT
  // ============================================
  console.log('\n📋 ===== USER INVITATION & ORGANIZATION ASSIGNMENT =====\n');

  // 1.1 Get all users
  await testEndpoint('Get All Users', 'GET', '/admin/users');

  // 1.2 Create user with organization assignment
  const createUserPayload = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    organizationId: 1 // Assuming org ID 1 exists
  };
  const createUserResult = await testEndpoint(
    'Create User with Organization',
    'POST',
    '/admin/users',
    createUserPayload,
    201
  );

  let createdUserId = null;
  if (createUserResult.success && createUserResult.data?.user) {
    createdUserId = createUserResult.data.user.id;
  }

  // 1.3 Invite user to organization
  const invitePayload = {
    email: `invite-${Date.now()}@example.com`,
    firstName: 'Invited',
    lastName: 'User',
    role: 'user',
    organizationId: 1
  };
  await testEndpoint(
    'Invite User to Organization',
    'POST',
    '/admin/users/invite',
    invitePayload,
    201
  );

  // ============================================
  // 2. CALENDAR INTEGRATIONS
  // ============================================
  console.log('\n📅 ===== CALENDAR INTEGRATIONS =====\n');

  // 2.1 Get all integrations
  const integrationsResult = await testEndpoint('Get All Integrations', 'GET', '/integrations');
  let calendarIntegrationId = null;
  
  if (integrationsResult.success && integrationsResult.data?.integrations) {
    const calendarInt = integrationsResult.data.integrations.find(i => 
      i.type === 'scheduling' && i.provider === 'google_calendar'
    );
    if (calendarInt) {
      calendarIntegrationId = calendarInt.id;
    }
  }

  // 2.2 Create calendar integration
  const calendarPayload = {
    name: `Test Calendar ${Date.now()}`,
    type: 'scheduling',
    provider: 'google_calendar',
    credentials: {
      access_token: 'test_token',
      refresh_token: 'test_refresh',
      client_id: 'test_client_id',
      client_secret: 'test_secret',
      calendar_id: 'primary'
    }
  };
  const createCalendarResult = await testEndpoint(
    'Create Calendar Integration',
    'POST',
    '/integrations',
    calendarPayload,
    201
  );

  let newCalendarId = null;
  if (createCalendarResult.success && createCalendarResult.data?.integration) {
    newCalendarId = createCalendarResult.data.integration.id;
  }

  // 2.3 Delete calendar integration
  if (newCalendarId) {
    await testEndpoint(
      'Delete Calendar Integration',
      'DELETE',
      `/integrations/${newCalendarId}`,
      null,
      200
    );
  }

  // 2.4 Update integration
  if (calendarIntegrationId) {
    await testEndpoint(
      'Update Integration',
      'PUT',
      `/integrations/${calendarIntegrationId}`,
      { is_active: true },
      200
    );
  }

  // ============================================
  // 3. AGENT CALENDAR CONFIGURATION
  // ============================================
  console.log('\n🤖 ===== AGENT CALENDAR CONFIGURATION =====\n');

  // 3.1 Get all agents
  const agentsResult = await testEndpoint('Get All Agents', 'GET', '/agents');
  let agentId = null;
  
  if (agentsResult.success && agentsResult.data?.agents?.length > 0) {
    agentId = agentsResult.data.agents[0].id;
  }

  // 3.2 Get agent by ID (verify calendar_integration_id in response)
  if (agentId) {
    const agentResult = await testEndpoint('Get Agent Details', 'GET', `/agents/${agentId}`);
    if (agentResult.success) {
      const hasCalendarField = agentResult.data?.agent?.calendar_integration_id !== undefined;
      if (hasCalendarField) {
        results.passed.push({ 
          name: 'Agent has calendar_integration_id field', 
          endpoint: `/agents/${agentId}` 
        });
      } else {
        results.failed.push({ 
          name: 'Agent missing calendar_integration_id field', 
          endpoint: `/agents/${agentId}`,
          error: 'Field not in response - migration may not be run'
        });
      }
    }
  }

  // 3.3 Update agent with calendar_integration_id
  if (agentId && calendarIntegrationId) {
    await testEndpoint(
      'Update Agent with Calendar Integration',
      'PUT',
      `/agents/${agentId}`,
      { calendar_integration_id: calendarIntegrationId },
      200
    );
  }

  // ============================================
  // 4. TELEPHONY - PHONE NUMBERS WITH AGENTS
  // ============================================
  console.log('\n📞 ===== TELEPHONY - PHONE NUMBERS WITH AGENTS =====\n');

  // 4.1 Get phone numbers (should include agent info)
  const phoneNumbersResult = await testEndpoint('Get Phone Numbers with Agents', 'GET', '/telephony/phone-numbers');
  if (phoneNumbersResult.success && phoneNumbersResult.data?.phone_numbers) {
    const hasAgentInfo = phoneNumbersResult.data.phone_numbers.some(pn => 
      pn.agent_id !== undefined || pn.agent_name !== undefined
    );
    if (hasAgentInfo) {
      results.passed.push({ 
        name: 'Phone numbers include agent information', 
        endpoint: '/telephony/phone-numbers' 
      });
    } else {
      results.failed.push({ 
        name: 'Phone numbers missing agent information', 
        endpoint: '/telephony/phone-numbers',
        error: 'agent_id/agent_name not in response'
      });
    }
  }

  // ============================================
  // 5. APPOINTMENT BOOKING (MULTI-SYSTEM)
  // ============================================
  console.log('\n📋 ===== APPOINTMENT BOOKING (MULTI-SYSTEM) =====\n');

  // 5.1 Get conversations
  const conversationsResult = await testEndpoint('Get Conversations', 'GET', '/conversations?limit=1');
  let conversationId = null;
  
  if (conversationsResult.success && conversationsResult.data?.conversations?.length > 0) {
    conversationId = conversationsResult.data.conversations[0].id;
  } else if (agentId) {
    // Create test conversation
    const createConvResult = await testEndpoint(
      'Create Test Conversation',
      'POST',
      '/conversations',
      { agent_id: agentId, patient_name: 'Test Patient', patient_phone: '+1234567890' },
      201
    );
    if (createConvResult.success && createConvResult.data?.conversation) {
      conversationId = createConvResult.data.conversation.id;
    }
  }

  // 5.2 Create appointment (should sync to all systems)
  if (conversationId) {
    const appointmentPayload = {
      conversation_id: conversationId,
      patient_name: 'Test Patient',
      patient_phone: '+1234567890',
      patient_email: 'test@example.com',
      appointment_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      appointment_type: 'General Checkup',
      notes: 'Test appointment from endpoint testing'
    };
    
    await testEndpoint(
      'Create Appointment (Multi-System Sync)',
      'POST',
      '/appointments',
      appointmentPayload,
      201
    );
  }

  // ============================================
  // 6. GOHIGHLEVEL CRM
  // ============================================
  console.log('\n💼 ===== GOHIGHLEVEL CRM =====\n');

  // 6.1 Get GHL auth URL
  await testEndpoint('Get GoHighLevel Auth URL', 'GET', '/integrations/ghl/auth-url');

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n\n📊 ===== TEST SUMMARY =====\n');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Errors: ${results.errors.length}`);

  if (results.passed.length > 0) {
    console.log('\n✅ Passed Tests:');
    results.passed.forEach((test, index) => {
      console.log(`   ${index + 1}. ${test.name} (${test.endpoint}) - Status: ${test.status}`);
    });
  }

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach((test, index) => {
      console.log(`   ${index + 1}. ${test.name} (${test.endpoint})`);
      console.log(`      Status: ${test.status}, Error: ${test.error || 'Unknown'}`);
    });
  }

  if (results.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    results.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.name} (${error.endpoint})`);
      console.log(`      Error: ${error.error}`);
    });
  }

  console.log('\n');
  process.exit(results.failed.length > 0 || results.errors.length > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

