/**
 * Setup Auto-Answer Number for Testing
 * Configures a Twilio number to auto-answer with a test message
 * This allows testing calls without needing a human to answer
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Get API URL - prioritize production URL
const API_URL = process.env.API_URL || 
                process.env.FRONTEND_URL || 
                (process.env.NODE_ENV === 'production' ? 'https://ehealthmed.ai' : 'http://localhost:5000');

// Remove trailing slash and ensure correct path
const baseUrl = API_URL.replace(/\/$/, '');
const AUTO_ANSWER_URL = `${baseUrl}/api/test-telephony/auto-answer`;

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

async function listPhoneNumbers() {
  log('\n📞 Listing your Twilio phone numbers...', 'cyan');
  
  try {
    const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 20 });
    
    if (phoneNumbers.length === 0) {
      log('❌ No phone numbers found in your Twilio account', 'red');
      return [];
    }
    
    log(`✅ Found ${phoneNumbers.length} phone number(s):\n`, 'green');
    
    phoneNumbers.forEach((pn, idx) => {
      log(`${idx + 1}. ${pn.phoneNumber}`, 'blue');
      log(`   SID: ${pn.sid}`, 'blue');
      log(`   Friendly Name: ${pn.friendlyName || 'N/A'}`, 'blue');
      log(`   Voice URL: ${pn.voiceUrl || 'Not set'}`, 'blue');
      log(`   Status Callback: ${pn.statusCallback || 'Not set'}`, 'blue');
      log('');
    });
    
    return phoneNumbers;
  } catch (error) {
    log(`❌ Error listing phone numbers: ${error.message}`, 'red');
    return [];
  }
}

async function configureAutoAnswer(phoneNumberSid, phoneNumber) {
  log(`\n🔧 Configuring ${phoneNumber} to auto-answer...`, 'cyan');
  
  try {
    const statusCallbackUrl = `${baseUrl}/api/telephony/twilio/status`;
    
    log(`   Setting Voice URL: ${AUTO_ANSWER_URL}`, 'blue');
    log(`   Setting Status Callback: ${statusCallbackUrl}`, 'blue');
    
    await client.incomingPhoneNumbers(phoneNumberSid).update({
      voiceUrl: AUTO_ANSWER_URL,
      voiceMethod: 'POST',
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: 'POST'
    });
    
    log(`✅ Successfully configured ${phoneNumber}!`, 'green');
    log(`   Voice URL: ${AUTO_ANSWER_URL}`, 'blue');
    log(`   Status Callback: ${API_URL}/api/telephony/twilio/status`, 'blue');
    log(`\n📝 Now any call to ${phoneNumber} will:`, 'cyan');
    log('   1. Auto-answer immediately', 'yellow');
    log('   2. Play a test message', 'yellow');
    log('   3. Hang up automatically', 'yellow');
    log('   4. Show as "Completed" in Twilio with duration > 0', 'yellow');
    
    return true;
  } catch (error) {
    log(`❌ Error configuring phone number: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('\n🚀 Setup Auto-Answer Number for Testing\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  if (!accountSid || !authToken) {
    log('❌ Twilio credentials not found!', 'red');
    log('   Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env', 'yellow');
    process.exit(1);
  }
  
  // List phone numbers
  const phoneNumbers = await listPhoneNumbers();
  
  if (phoneNumbers.length === 0) {
    log('\n❌ No phone numbers to configure', 'red');
    process.exit(1);
  }
  
  // Ask which number to configure (for now, use the second one or first available)
  // In a real scenario, you'd want to use a number specifically for testing
  log('\n💡 Recommendation:', 'cyan');
  log('   Use a SECOND Twilio number (not your main number) for testing', 'yellow');
  log('   This way your main number stays configured for production', 'yellow');
  
  // For now, configure the first number that's not already configured
  let targetNumber = null;
  
  for (const pn of phoneNumbers) {
    if (!pn.voiceUrl || pn.voiceUrl.includes('test-telephony')) {
      targetNumber = pn;
      break;
    }
  }
  
  // If all numbers are configured, use the first one
  if (!targetNumber) {
    targetNumber = phoneNumbers[0];
  }
  
  log(`\n📞 Configuring: ${targetNumber.phoneNumber}`, 'cyan');
  
  const success = await configureAutoAnswer(targetNumber.sid, targetNumber.phoneNumber);
  
  if (success) {
    log('\n✅ Setup complete!', 'green');
    log('\n📝 Next Steps:', 'cyan');
    log(`   1. Call ${targetNumber.phoneNumber} from another number`, 'yellow');
    log('   2. It will auto-answer and play a message', 'yellow');
    log('   3. Check Twilio Console → Calls → Status should be "Completed"', 'yellow');
    log('   4. Duration should be > 0 seconds', 'yellow');
    log('\n   Or use the test script:', 'cyan');
    log('   node backend/scripts/test-auto-answer-call.js', 'blue');
  } else {
    log('\n❌ Setup failed', 'red');
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
