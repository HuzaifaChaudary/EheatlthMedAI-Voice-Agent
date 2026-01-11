/**
 * Simulate Call Test
 * Simulates an incoming call from (706) 352-4870 to +14047387870
 * and shows what the AI voice agent would say
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

function extractSayText(twiml) {
  // Extract text from <Say> tags
  const sayMatches = twiml.match(/<Say[^>]*>([^<]*)<\/Say>/gi);
  if (sayMatches) {
    return sayMatches.map(match => {
      const text = match.replace(/<Say[^>]*>/, '').replace(/<\/Say>/i, '');
      return text;
    });
  }
  return [];
}

function parseTwiml(twiml) {
  log('\n📋 TwiML Response Analysis:', 'cyan');
  log('─'.repeat(60), 'cyan');
  
  // Check for Say elements
  const sayTexts = extractSayText(twiml);
  if (sayTexts.length > 0) {
    log('\n🔊 What the caller would HEAR:', 'green');
    sayTexts.forEach((text, idx) => {
      log(`   ${idx + 1}. "${text}"`, 'yellow');
    });
  }
  
  // Check for Gather (waiting for input)
  if (twiml.includes('<Gather')) {
    log('\n⏳ Call is waiting for speech input', 'blue');
  }
  
  // Check for Hangup
  if (twiml.includes('<Hangup')) {
    log('\n📞 Call would be ended', 'red');
  }
  
  // Check for Record
  if (twiml.includes('<Record')) {
    log('\n🎙️ Call would be recorded', 'blue');
  }
  
  // Check for error messages
  if (twiml.toLowerCase().includes('error') || twiml.toLowerCase().includes('apologize')) {
    log('\n⚠️ ERROR DETECTED in response!', 'red');
  }
  
  log('\n─'.repeat(60), 'cyan');
}

async function simulateIncomingCall() {
  log('\n🧪 Simulating Incoming Call', 'cyan');
  log('═'.repeat(60), 'cyan');
  log(`📞 From: (706) 352-4870`, 'blue');
  log(`📞 To: +14047387870`, 'blue');
  log(`🌐 API: ${API_URL}`, 'blue');
  log('═'.repeat(60), 'cyan');

  // Simulate Twilio webhook data (URL-encoded form data)
  const twilioData = {
    AccountSid: 'SIMULATED',
    ApiVersion: '2010-04-01',
    CallSid: 'CA_SIMULATED_' + Date.now(),
    CallStatus: 'ringing',
    Called: '+14047387870',
    CalledCity: 'ATLANTA',
    CalledCountry: 'US',
    CalledState: 'GA',
    CalledZip: '30301',
    Caller: '+17063524870',
    CallerCity: 'AUGUSTA',
    CallerCountry: 'US',
    CallerState: 'GA',
    CallerZip: '30901',
    Direction: 'inbound',
    From: '+17063524870',
    FromCity: 'AUGUSTA',
    FromCountry: 'US',
    FromState: 'GA',
    FromZip: '30901',
    To: '+14047387870',
    ToCity: 'ATLANTA',
    ToCountry: 'US',
    ToState: 'GA',
    ToZip: '30301'
  };

  log('\n📤 Sending simulated Twilio webhook to /api/telephony/twilio/inbound...', 'cyan');
  
  try {
    const response = await axios.post(
      `${API_URL}/api/telephony/twilio/inbound`,
      querystring.stringify(twilioData),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000,
        validateStatus: () => true // Don't throw on any status
      }
    );

    log(`\n📥 HTTP Status: ${response.status}`, response.status < 300 ? 'green' : 'red');
    
    if (response.headers['content-type']?.includes('xml') || 
        (typeof response.data === 'string' && response.data.includes('<?xml'))) {
      log('\n📄 TwiML Response (raw):', 'magenta');
      log(response.data, 'reset');
      
      // Parse and explain the TwiML
      parseTwiml(response.data);
    } else {
      log('\n📄 Response:', 'magenta');
      log(JSON.stringify(response.data, null, 2), 'reset');
    }

  } catch (error) {
    log(`\n❌ Error simulating call:`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data: ${JSON.stringify(error.response.data)}`, 'red');
    } else if (error.code === 'ECONNREFUSED') {
      log(`   Connection refused - is the server running?`, 'red');
    } else {
      log(`   ${error.message}`, 'red');
    }
  }
}

async function testWebchatSimulation() {
  log('\n\n🧪 Alternative: Testing via Webchat Endpoint', 'cyan');
  log('═'.repeat(60), 'cyan');
  
  // First, get agents to find one linked to +14047387870
  try {
    log('\n📋 Step 1: Checking available agents...', 'cyan');
    
    const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiY2hodXphaWZhaWZ0aWtoYXJAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzY3MjE3ODczLCJleHAiOjE3Njc4MjI2NzN9.U5aZO_1PBYqibEXKUZbGc5iTKqWCXMwnyQAWA3z7_M8';
    
    const agentsResponse = await axios.get(`${API_URL}/api/agents`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
      timeout: 10000,
      validateStatus: () => true
    });
    
    if (agentsResponse.status === 200 && agentsResponse.data.agents) {
      const agents = agentsResponse.data.agents;
      log(`✅ Found ${agents.length} agent(s):`, 'green');
      agents.forEach((agent, idx) => {
        log(`   ${idx + 1}. ${agent.name} (ID: ${agent.id}, Type: ${agent.type})`, 'blue');
      });
      
      // Find Front Desk or Receptionist agent
      const frontDeskAgent = agents.find(a => 
        a.type === 'front_desk' || 
        a.name.toLowerCase().includes('front desk') ||
        a.name.toLowerCase().includes('receptionist')
      ) || agents[0];
      
      if (frontDeskAgent) {
        log(`\n🤖 Using Agent: ${frontDeskAgent.name} (ID: ${frontDeskAgent.id})`, 'green');
        
        // Create conversation
        log('\n📋 Step 2: Creating webchat conversation...', 'cyan');
        const convResponse = await axios.post(
          `${API_URL}/api/webchat/conversation`,
          {
            agent_id: frontDeskAgent.id,
            metadata: { 
              channel: 'voice_simulation',
              caller_phone: '+17063524870',
              called_phone: '+14047387870'
            }
          },
          {
            timeout: 10000,
            validateStatus: () => true
          }
        );
        
        if (convResponse.status === 201 && convResponse.data.conversation_id) {
          const conversationId = convResponse.data.conversation_id;
          log(`✅ Conversation created: ID ${conversationId}`, 'green');
          
          if (convResponse.data.greeting_message) {
            log(`\n🔊 GREETING (what caller would hear first):`, 'green');
            log(`   "${convResponse.data.greeting_message}"`, 'yellow');
          }
          
          // Send test message
          log('\n📋 Step 3: Sending test message: "Hello, I need to make an appointment"', 'cyan');
          const msgResponse = await axios.post(
            `${API_URL}/api/webchat/message`,
            {
              conversation_id: conversationId,
              message: 'Hello, I need to make an appointment',
              agent_id: frontDeskAgent.id
            },
            {
              timeout: 30000,
              validateStatus: () => true
            }
          );
          
          if (msgResponse.status === 200 && msgResponse.data.assistant_message) {
            log(`\n🔊 AI RESPONSE (what caller would hear):`, 'green');
            log(`   "${msgResponse.data.assistant_message}"`, 'yellow');
            log(`\n✅ Voice AI is WORKING!`, 'green');
          } else {
            log(`\n❌ Failed to get AI response`, 'red');
            log(`   Status: ${msgResponse.status}`, 'red');
            log(`   Response: ${JSON.stringify(msgResponse.data)}`, 'red');
          }
        } else {
          log(`\n❌ Failed to create conversation`, 'red');
          log(`   Status: ${convResponse.status}`, 'red');
          log(`   Response: ${JSON.stringify(convResponse.data)}`, 'red');
        }
      }
    } else {
      log(`\n❌ Failed to get agents`, 'red');
      log(`   Status: ${agentsResponse.status}`, 'red');
    }
  } catch (error) {
    log(`\n❌ Error:`, 'red');
    log(`   ${error.message}`, 'red');
  }
}

async function simulateConsentAndVoice() {
  log('\n\n🧪 Simulating Consent + Voice Response (Full Flow)', 'cyan');
  log('═'.repeat(60), 'cyan');

  // First simulate inbound call to get conversationId, callLogId, agentId
  const twilioData = {
    AccountSid: 'SIMULATED',
    ApiVersion: '2010-04-01',
    CallSid: 'CA_VOICE_TEST_' + Date.now(),
    CallStatus: 'ringing',
    Called: '+14047387870',
    CalledCity: 'ATLANTA',
    CalledCountry: 'US',
    CalledState: 'GA',
    Caller: '+17063524870',
    CallerCity: 'AUGUSTA',
    CallerCountry: 'US',
    CallerState: 'GA',
    Direction: 'inbound',
    From: '+17063524870',
    To: '+14047387870'
  };

  try {
    // Step 1: Initial inbound call
    log('\n📤 Step 1: Simulating incoming call...', 'cyan');
    const inboundResponse = await axios.post(
      `${API_URL}/api/telephony/twilio/inbound`,
      querystring.stringify(twilioData),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    if (inboundResponse.status !== 200) {
      log(`❌ Inbound call failed: ${inboundResponse.status}`, 'red');
      return;
    }

    // Extract conversation info from response URL
    const actionMatch = inboundResponse.data.match(/action="[^"]*conversationId=(\d+)[^"]*callLogId=(\d+)[^"]*agentId=(\d+)/);
    
    if (!actionMatch) {
      log('\n❌ Could not extract conversation details from response', 'red');
      log('Response:', 'yellow');
      log(inboundResponse.data, 'reset');
      return;
    }

    const conversationId = actionMatch[1];
    const callLogId = actionMatch[2];
    const agentId = actionMatch[3];

    log(`\n✅ Call setup complete:`, 'green');
    log(`   Conversation ID: ${conversationId}`, 'blue');
    log(`   Call Log ID: ${callLogId}`, 'blue');
    log(`   Agent ID: ${agentId}`, 'blue');

    // Step 2: Simulate consent given
    log('\n📤 Step 2: Simulating consent given (user says "yes")...', 'cyan');
    const consentData = {
      ...twilioData,
      SpeechResult: 'yes I consent'
    };

    const consentResponse = await axios.post(
      `${API_URL}/api/telephony/twilio/consent?conversationId=${conversationId}&callLogId=${callLogId}&agentId=${agentId}&from=+17063524870`,
      querystring.stringify(consentData),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    log(`\n📥 Consent Response Status: ${consentResponse.status}`, consentResponse.status < 300 ? 'green' : 'red');
    
    if (typeof consentResponse.data === 'string' && consentResponse.data.includes('<?xml')) {
      log('\n📄 TwiML Response After Consent:', 'magenta');
      parseTwiml(consentResponse.data);
      
      // Check if this is the AI greeting
      const sayTexts = extractSayText(consentResponse.data);
      if (sayTexts.length > 0) {
        log('\n═'.repeat(60), 'green');
        log('🎉 AI VOICE AGENT GREETING:', 'green');
        log('═'.repeat(60), 'green');
        sayTexts.forEach(text => {
          log(`\n"${text}"`, 'yellow');
        });
        log('\n═'.repeat(60), 'green');
      }
    } else {
      log('\n📄 Response:', 'magenta');
      log(JSON.stringify(consentResponse.data, null, 2), 'reset');
    }

    // Step 3: Simulate user asking a question
    log('\n📤 Step 3: Simulating user speech: "Hello, I want to make an appointment"...', 'cyan');
    const voiceData = {
      ...twilioData,
      SpeechResult: 'Hello, I want to make an appointment'
    };

    const voiceResponse = await axios.post(
      `${API_URL}/api/telephony/twilio/voice?conversationId=${conversationId}&callLogId=${callLogId}&agentId=${agentId}`,
      querystring.stringify(voiceData),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    log(`\n📥 Voice Response Status: ${voiceResponse.status}`, voiceResponse.status < 300 ? 'green' : 'red');
    
    if (typeof voiceResponse.data === 'string' && voiceResponse.data.includes('<?xml')) {
      log('\n📄 TwiML Response to User Question:', 'magenta');
      parseTwiml(voiceResponse.data);
      
      const sayTexts = extractSayText(voiceResponse.data);
      if (sayTexts.length > 0) {
        log('\n═'.repeat(60), 'green');
        log('🤖 AI RESPONSE TO "I want to make an appointment":', 'green');
        log('═'.repeat(60), 'green');
        sayTexts.forEach(text => {
          log(`\n"${text}"`, 'yellow');
        });
        log('\n═'.repeat(60), 'green');
      }
    } else {
      log('\n📄 Response:', 'magenta');
      log(JSON.stringify(voiceResponse.data, null, 2), 'reset');
    }

  } catch (error) {
    log(`\n❌ Error in full flow simulation:`, 'red');
    log(`   ${error.message}`, 'red');
  }
}

async function main() {
  log('\n🎯 Call Simulation Test', 'cyan');
  log('This script simulates an incoming call to test what the AI would say', 'cyan');
  log('═'.repeat(60) + '\n', 'cyan');

  // Test 1: Direct Twilio webhook simulation
  await simulateIncomingCall();
  
  // Test 2: Full flow - consent + voice
  await simulateConsentAndVoice();
  
  // Test 3: Webchat simulation (alternative approach)
  await testWebchatSimulation();
  
  log('\n\n📊 SUMMARY', 'cyan');
  log('═'.repeat(60), 'cyan');
  log('If you see "application error has occurred" in the TwiML response,', 'yellow');
  log('check the backend logs for the specific error:', 'yellow');
  log('   pm2 logs ehealth-backend --lines 100', 'blue');
  log('\nCommon issues:', 'yellow');
  log('   1. Phone number +14047387870 not in database', 'yellow');
  log('   2. No agent linked to this phone number', 'yellow');
  log('   3. OpenAI API key missing or invalid', 'yellow');
  log('   4. Database connection issues', 'yellow');
  log('═'.repeat(60), 'cyan');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

