/**
 * Diagnose Voice Call Error
 * Tests the exact flow that fails on voice calls
 */

const axios = require('axios');
const querystring = require('querystring');

const API_URL = 'https://ehealthmed.ai';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function diagnoseVoiceError() {
  log('\n🔬 DIAGNOSING VOICE CALL ERROR', 'cyan');
  log('═'.repeat(70), 'cyan');
  log(`\n📞 Testing call from (706) 352-4870 to +14047387870\n`, 'blue');

  try {
    // Step 1: Make the initial call
    log('Step 1: Simulating incoming call...', 'cyan');
    const callData = {
      AccountSid: 'AC_TEST',
      CallSid: 'CA_DIAG_' + Date.now(),
      CallStatus: 'ringing',
      From: '+17063524870',
      To: '+14047387870',
      Direction: 'inbound'
    };

    const inboundResponse = await axios.post(
      `${API_URL}/api/telephony/twilio/inbound`,
      querystring.stringify(callData),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    log(`   Status: ${inboundResponse.status}`, inboundResponse.status === 200 ? 'green' : 'red');

    // Extract IDs from response
    const actionMatch = inboundResponse.data.match(/conversationId=(\d+)[^"]*callLogId=(\d+)[^"]*agentId=(\d+)/);
    if (!actionMatch) {
      log('   ❌ Could not extract IDs from response', 'red');
      log(`   Response: ${inboundResponse.data.substring(0, 500)}`, 'yellow');
      return;
    }

    const [, conversationId, callLogId, agentId] = actionMatch;
    log(`   ✅ Conversation: ${conversationId}, CallLog: ${callLogId}, Agent: ${agentId}`, 'green');

    // Check for double /api/api/ bug
    if (inboundResponse.data.includes('/api/api/')) {
      log('\n   ⚠️ BUG DETECTED: Double /api/api/ in URL!', 'red');
      log('   This causes the consent/voice endpoints to fail!', 'red');
      log('   Fix: Update telephonyService.js baseUrl to remove /api suffix', 'yellow');
    }

    // Step 2: Try consent endpoint (with correct URL, not the buggy one)
    log('\nStep 2: Testing consent endpoint...', 'cyan');
    const consentData = {
      ...callData,
      SpeechResult: 'yes'
    };

    // Try the CORRECT URL (without double /api/)
    const correctConsentUrl = `${API_URL}/api/telephony/twilio/consent?conversationId=${conversationId}&callLogId=${callLogId}&agentId=${agentId}&from=+17063524870`;
    log(`   URL: ${correctConsentUrl}`, 'blue');

    const consentResponse = await axios.post(
      correctConsentUrl,
      querystring.stringify(consentData),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    log(`   Status: ${consentResponse.status}`, consentResponse.status === 200 ? 'green' : 'red');

    // Analyze response
    if (consentResponse.data.includes('error') || consentResponse.data.includes('apologize')) {
      log('\n   ❌ ERROR IN VOICE RESPONSE!', 'red');
      
      // Extract the Say text
      const sayMatch = consentResponse.data.match(/<Say[^>]*>([^<]*)<\/Say>/i);
      if (sayMatch) {
        log(`   Error message: "${sayMatch[1]}"`, 'red');
      }
      
      log('\n   🔍 DIAGNOSIS:', 'yellow');
      log('   The error happens in telephonyService.generateVoiceResponse()', 'yellow');
      log('   Possible causes:', 'yellow');
      log('   1. OpenAI API call failing (quota, rate limit, invalid key)', 'yellow');
      log('   2. Agent system prompt missing or invalid', 'yellow');
      log('   3. Database query failing', 'yellow');
      log('   4. NLU configuration issue', 'yellow');
      log('\n   📋 To see the actual error, check server logs:', 'cyan');
      log('   pm2 logs ehealth-backend --lines 200 | grep -i "error"', 'blue');
    } else {
      // Extract and show the AI greeting
      const sayMatch = consentResponse.data.match(/<Say[^>]*>([^<]*)<\/Say>/i);
      if (sayMatch) {
        log('\n   ✅ VOICE AI WORKING!', 'green');
        log(`   AI says: "${sayMatch[1]}"`, 'yellow');
      }
    }

    // Step 3: Test voice endpoint directly
    log('\nStep 3: Testing voice endpoint...', 'cyan');
    const voiceData = {
      ...callData,
      SpeechResult: 'Hello I need an appointment'
    };

    const voiceUrl = `${API_URL}/api/telephony/twilio/voice?conversationId=${conversationId}&callLogId=${callLogId}&agentId=${agentId}`;
    log(`   URL: ${voiceUrl}`, 'blue');

    const voiceResponse = await axios.post(
      voiceUrl,
      querystring.stringify(voiceData),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    log(`   Status: ${voiceResponse.status}`, voiceResponse.status === 200 ? 'green' : 'red');

    // Analyze voice response
    const voiceSayMatch = voiceResponse.data.match(/<Say[^>]*>([^<]*)<\/Say>/i);
    if (voiceSayMatch) {
      if (voiceResponse.data.includes('error') || voiceResponse.data.includes('apologize')) {
        log(`\n   ❌ AI Error: "${voiceSayMatch[1]}"`, 'red');
      } else {
        log(`\n   ✅ AI Response: "${voiceSayMatch[1]}"`, 'green');
      }
    }

    // Summary
    log('\n' + '═'.repeat(70), 'cyan');
    log('📊 DIAGNOSIS COMPLETE', 'cyan');
    log('═'.repeat(70), 'cyan');
    
    log('\n🔧 FIXES NEEDED:', 'yellow');
    log('1. Fix double /api/api/ bug in telephonyService.js:', 'yellow');
    log('   Change: this.baseUrl = process.env.API_URL || ...', 'blue');
    log('   To: this.baseUrl = (process.env.API_URL || ...).replace(/\\/api\\/?$/, "")', 'blue');
    log('\n2. Deploy the fix to production', 'yellow');
    log('\n3. Check server logs for specific AI errors:', 'yellow');
    log('   pm2 logs ehealth-backend --lines 200', 'blue');

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data: ${JSON.stringify(error.response.data).substring(0, 200)}`, 'red');
    }
  }
}

diagnoseVoiceError()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

