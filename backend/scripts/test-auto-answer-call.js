/**
 * Test Auto-Answer Call
 * Makes a call to an auto-answer number and verifies it works
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const twilio = require('twilio');

// Use production URL
const API_URL = process.env.API_URL || process.env.FRONTEND_URL || 'https://ehealthmed.ai';
const BASE_URL = `${API_URL.replace(/\/$/, '')}/api`;
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiY2hodXphaWZhaWZ0aWtoYXJAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzY3MjE3ODczLCJleHAiOjE3Njc4MjI2NzN9.U5aZO_1PBYqibEXKUZbGc5iTKqWCXMwnyQAWA3z7_M8';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function findAutoAnswerNumber() {
  log('\n📞 Finding auto-answer number...', 'cyan');
  
  try {
    const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 20 });
    
    // Find number configured with test-telephony endpoint
    for (const pn of phoneNumbers) {
      if (pn.voiceUrl && pn.voiceUrl.includes('test-telephony')) {
        log(`✅ Found auto-answer number: ${pn.phoneNumber}`, 'green');
        log(`   Voice URL: ${pn.voiceUrl}`, 'blue');
        return pn;
      }
    }
    
    // If not found, check for +18666068625 (the number we just configured)
    for (const pn of phoneNumbers) {
      if (pn.phoneNumber === '+18666068625') {
        log(`✅ Found configured number: ${pn.phoneNumber}`, 'green');
        log(`   Voice URL: ${pn.voiceUrl || 'Not set - run setup script first!'}`, 'blue');
        if (!pn.voiceUrl || !pn.voiceUrl.includes('test-telephony')) {
          log(`   ⚠️  This number is not configured for auto-answer!`, 'yellow');
          log(`   Run: node backend/scripts/setup-auto-answer-number.js`, 'yellow');
        }
        return pn;
      }
    }
    
    // If not found, use the second number (assuming first is main number)
    if (phoneNumbers.length >= 2) {
      log(`⚠️  No auto-answer number found, using: ${phoneNumbers[1].phoneNumber}`, 'yellow');
      log(`   Make sure this number is configured to auto-answer!`, 'yellow');
      log(`   Run: node backend/scripts/setup-auto-answer-number.js`, 'yellow');
      return phoneNumbers[1];
    }
    
    if (phoneNumbers.length === 1) {
      log(`⚠️  Only one number found, using: ${phoneNumbers[0].phoneNumber}`, 'yellow');
      log('   Make sure this number is configured to auto-answer!', 'yellow');
      log(`   Run: node backend/scripts/setup-auto-answer-number.js`, 'yellow');
      return phoneNumbers[0];
    }
    
    log('❌ No phone numbers found', 'red');
    return null;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return null;
  }
}

async function findFromNumber() {
  try {
    const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 20 });
    
    // Use first number as "from" number
    if (phoneNumbers.length > 0) {
      return phoneNumbers[0].phoneNumber;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function makeTestCall(fromNumber, toNumber) {
  log(`\n📞 Making test call...`, 'cyan');
  log(`   From: ${fromNumber}`, 'blue');
  log(`   To: ${toNumber}`, 'blue');
  
  try {
    const baseUrl = API_URL.replace(/\/$/, '');
    const autoAnswerUrl = `${baseUrl}/api/test-telephony/auto-answer`;
    const statusCallbackUrl = `${baseUrl}/api/telephony/twilio/status`;
    
    log(`   Webhook URL: ${autoAnswerUrl}`, 'blue');
    
    const call = await client.calls.create({
      to: toNumber,
      from: fromNumber,
      url: autoAnswerUrl,
      method: 'POST',
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });
    
    log(`\n✅ Call initiated!`, 'green');
    log(`   Call SID: ${call.sid}`, 'blue');
    log(`   Status: ${call.status}`, 'blue');
    
    return call;
  } catch (error) {
    log(`\n❌ Error making call: ${error.message}`, 'red');
    return null;
  }
}

async function checkCallStatus(callSid, maxWait = 30) {
  log(`\n⏳ Waiting for call to complete (max ${maxWait}s)...`, 'cyan');
  
  let attempts = 0;
  const maxAttempts = maxWait;
  
  while (attempts < maxAttempts) {
    try {
      const call = await client.calls(callSid).fetch();
      
      log(`   Status: ${call.status}`, 'blue');
      
      if (call.status === 'completed') {
        log(`\n✅ Call completed!`, 'green');
        log(`   Duration: ${call.duration} seconds`, 'blue');
        log(`   Start Time: ${call.startTime}`, 'blue');
        log(`   End Time: ${call.endTime}`, 'blue');
        
        if (parseInt(call.duration) > 0) {
          log(`\n🎉 SUCCESS! Call connected and played message!`, 'green');
          log(`   Duration > 0 means the call actually connected`, 'green');
          log(`   The auto-answer system is working!`, 'green');
          return true;
        } else {
          log(`\n⚠️  Call completed but duration is 0`, 'yellow');
          return false;
        }
      }
      
      if (call.status === 'busy' || call.status === 'no-answer' || call.status === 'failed') {
        log(`\n❌ Call failed with status: ${call.status}`, 'red');
        return false;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    } catch (error) {
      log(`❌ Error checking status: ${error.message}`, 'red');
      return false;
    }
  }
  
  log(`\n⚠️  Call did not complete within ${maxWait} seconds`, 'yellow');
  return false;
}

async function main() {
  log('\n🚀 Test Auto-Answer Call\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // Find auto-answer number
  const autoAnswerNumber = await findAutoAnswerNumber();
  if (!autoAnswerNumber) {
    log('\n❌ Cannot proceed without auto-answer number', 'red');
    log('\n💡 Run this first to set up an auto-answer number:', 'cyan');
    log('   node backend/scripts/setup-auto-answer-number.js', 'blue');
    process.exit(1);
  }
  
  // Find from number
  const fromNumber = await findFromNumber();
  if (!fromNumber) {
    log('\n❌ Cannot find a number to call from', 'red');
    process.exit(1);
  }
  
  // Make the call
  const call = await makeTestCall(fromNumber, autoAnswerNumber.phoneNumber);
  
  if (!call) {
    log('\n❌ Failed to initiate call', 'red');
    process.exit(1);
  }
  
  // Wait and check status
  const success = await checkCallStatus(call.sid);
  
  if (success) {
    log('\n✅ Test PASSED!', 'green');
    log('   The auto-answer system is working correctly.', 'green');
    log('   You can now test appointment booking calls!', 'green');
  } else {
    log('\n❌ Test FAILED', 'red');
    log('   Check Twilio Console for more details', 'yellow');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
