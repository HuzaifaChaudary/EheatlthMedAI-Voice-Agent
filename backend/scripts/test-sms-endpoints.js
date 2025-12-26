/**
 * Test SMS Endpoints
 * 
 * Tests the SMS service endpoints:
 * 1. Send SMS
 * 2. Get SMS messages
 * 3. Incoming SMS webhook (simulated)
 * 
 * Usage: node backend/scripts/test-sms-endpoints.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const TEST_TOKEN = process.env.TEST_TOKEN || ''; // You'll need to get a valid token

async function testSMSEndpoints() {
  console.log('🧪 Testing SMS Endpoints');
  console.log('=====================================\n');
  console.log(`📍 API URL: ${API_URL}\n`);

  if (!TEST_TOKEN) {
    console.log('⚠️  TEST_TOKEN not set. Skipping authenticated endpoints.');
    console.log('   Set TEST_TOKEN in .env or as environment variable to test authenticated endpoints.\n');
  }

  // Test 1: Send SMS (requires authentication)
  if (TEST_TOKEN) {
    console.log('📋 Test 1: Send SMS');
    console.log(`   POST ${API_URL}/telephony/sms/send`);
    try {
      const response = await axios.post(
        `${API_URL}/telephony/sms/send`,
        {
          to: '+1234567890', // Test number
          message: 'Test SMS from EHealth Med AI',
          conversation_id: null
        },
        {
          headers: {
            'Authorization': `Bearer ${TEST_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          validateStatus: () => true
        }
      );

      console.log(`   Status: ${response.status}`);
      if (response.status === 200 || response.status === 201) {
        console.log('   ✅ SMS sent successfully');
        console.log(`   Response:`, JSON.stringify(response.data, null, 2));
      } else {
        console.log('   ❌ Failed to send SMS');
        console.log(`   Error:`, response.data);
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', error.response.data);
      }
    }
    console.log('');
  }

  // Test 2: Get SMS messages (requires authentication)
  if (TEST_TOKEN) {
    console.log('📋 Test 2: Get SMS Messages');
    console.log(`   GET ${API_URL}/telephony/sms`);
    try {
      const response = await axios.get(
        `${API_URL}/telephony/sms`,
        {
          headers: {
            'Authorization': `Bearer ${TEST_TOKEN}`,
            'Content-Type': 'application/json'
          },
          params: {
            page: 1,
            limit: 10
          },
          timeout: 10000,
          validateStatus: () => true
        }
      );

      console.log(`   Status: ${response.status}`);
      if (response.status === 200) {
        console.log('   ✅ SMS messages retrieved successfully');
        console.log(`   Messages count: ${response.data.messages?.length || 0}`);
        if (response.data.messages && response.data.messages.length > 0) {
          console.log('   Sample message:', JSON.stringify(response.data.messages[0], null, 2));
        }
      } else {
        console.log('   ❌ Failed to get SMS messages');
        console.log(`   Error:`, response.data);
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', error.response.data);
      }
    }
    console.log('');
  }

  // Test 3: Incoming SMS webhook (no authentication required)
  console.log('📋 Test 3: Incoming SMS Webhook (Simulated)');
  console.log(`   POST ${API_URL}/telephony/twilio/sms`);
  try {
    const response = await axios.post(
      `${API_URL}/telephony/twilio/sms`,
      {
        From: '+1234567890',
        To: process.env.TWILIO_PHONE_NUMBER || '+14047387870',
        Body: 'Test incoming SMS message',
        MessageSid: 'SM' + Math.random().toString(36).substring(7)
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000,
        validateStatus: () => true
      }
    );

    console.log(`   Status: ${response.status}`);
    if (response.status === 200) {
      console.log('   ✅ Incoming SMS webhook handled successfully');
      console.log(`   Response: ${response.data}`);
    } else {
      console.log('   ⚠️  Webhook responded with non-200 status');
      console.log(`   Response:`, response.data);
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
  console.log('');

  console.log('✅ SMS endpoint tests completed!');
  console.log('\nNote:');
  console.log('- Send SMS and Get SMS require authentication (set TEST_TOKEN)');
  console.log('- Incoming SMS webhook is public (no auth required)');
  console.log('- Make sure Twilio is configured in .env for actual SMS sending');
}

testSMSEndpoints().catch(console.error);

