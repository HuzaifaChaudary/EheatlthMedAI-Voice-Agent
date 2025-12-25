/**
 * Test Simulate Call on Production
 * 
 * Tests the same flow as client:
 * 1. Find Front Desk/Receptionist agent
 * 2. Create webchat conversation
 * 3. Send test message
 * 4. Check for errors
 * 
 * Usage: node scripts/test-prod-simulate-call.js
 */

const axios = require('axios');

// Get API URL from environment or use production URL
const API_URL = process.env.API_URL || 'https://huzaifaiftikhar.engineer/api';

async function testProductionSimulateCall() {
  console.log('🧪 Testing Simulate Call on PRODUCTION');
  console.log('=====================================\n');
  console.log(`📍 API URL: ${API_URL}\n`);

  try {
    // Step 1: Get agents (public endpoint or we need to find agent ID)
    console.log('📋 Step 1: Testing webchat conversation creation...');
    console.log(`   POST ${API_URL}/webchat/conversation`);
    
    // We'll use agent_id = 1 (Front Desk Assistant) as default
    // In production, we need to know the agent ID
    const agentId = 1; // Default Front Desk Assistant
    
    let conversationId;
    try {
      const convResponse = await axios.post(`${API_URL}/webchat/conversation`, {
        agent_id: agentId,
        metadata: { channel: 'web_chat', test: true }
      }, {
        timeout: 10000,
        validateStatus: () => true // Don't throw on any status
      });

      console.log(`   Status: ${convResponse.status}`);
      console.log(`   Response:`, JSON.stringify(convResponse.data, null, 2));

      if (convResponse.status === 201 && convResponse.data.conversation_id) {
        conversationId = convResponse.data.conversation_id;
        console.log(`✅ Conversation created: ID ${conversationId}`);
        if (convResponse.data.greeting_message) {
          console.log(`   Greeting: "${convResponse.data.greeting_message}"`);
        }
      } else {
        console.log('❌ Failed to create conversation');
        console.log('   Error:', convResponse.data);
        return;
      }
    } catch (error) {
      console.error('❌ Error creating conversation!');
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', error.response.data);
      } else if (error.request) {
        console.error('   No response received');
        console.error('   Request:', error.message);
      } else {
        console.error('   Error:', error.message);
      }
      return;
    }

    // Step 2: Send test message
    console.log('\n📋 Step 2: Sending test message...');
    console.log(`   POST ${API_URL}/webchat/message`);
    console.log(`   Body: { conversation_id: ${conversationId}, message: "Hi, I want to make an appointment" }`);
    
    try {
      const messageResponse = await axios.post(`${API_URL}/webchat/message`, {
        conversation_id: conversationId,
        message: 'Hi, I want to make an appointment',
        agent_id: agentId
      }, {
        timeout: 30000, // 30 seconds for AI response
        validateStatus: () => true
      });

      console.log(`   Status: ${messageResponse.status}`);
      console.log(`   Response:`, JSON.stringify(messageResponse.data, null, 2));

      if (messageResponse.status === 200 && messageResponse.data.assistant_message) {
        console.log(`✅ Received response: "${messageResponse.data.assistant_message.substring(0, 100)}..."`);
        console.log('\n✅ Simulate call is WORKING on production!');
      } else {
        console.log('❌ Failed to get response');
        console.log('   Error:', messageResponse.data);
        if (messageResponse.data.error) {
          console.log(`\n❌ ERROR: ${messageResponse.data.error}`);
          console.log(`   Message: ${messageResponse.data.message || 'Unknown error'}`);
        }
        console.log('\n❌ Simulate call is NOT working on production');
      }
    } catch (error) {
      console.error('❌ Error sending message!');
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        if (error.response.data.error) {
          console.error(`\n❌ ERROR: ${error.response.data.error}`);
        }
      } else if (error.request) {
        console.error('   No response received');
        console.error('   Request:', error.message);
      } else {
        console.error('   Error:', error.message);
      }
      console.log('\n❌ Simulate call is NOT working on production');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

// Run test
testProductionSimulateCall();

