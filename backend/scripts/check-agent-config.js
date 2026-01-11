/**
 * Check Agent Configuration for Phone Number +14047387870
 * Diagnose why voice calls are failing
 */

const axios = require('axios');
const querystring = require('querystring');

const API_URL = 'https://ehealthmed.ai';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiY2hodXphaWZhaWZ0aWtoYXJAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzY3MjE3ODczLCJleHAiOjE3Njc4MjI2NzN9.U5aZO_1PBYqibEXKUZbGc5iTKqWCXMwnyQAWA3z7_M8';

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

async function checkConfiguration() {
  log('\n🔍 Checking Voice Agent Configuration', 'cyan');
  log('═'.repeat(60), 'cyan');

  try {
    // Check phone numbers
    log('\n📞 Step 1: Checking phone numbers...', 'cyan');
    const phoneResponse = await axios.get(`${API_URL}/api/telephony/phone-numbers`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
      timeout: 10000,
      validateStatus: () => true
    });

    if (phoneResponse.status === 200 && phoneResponse.data.phone_numbers) {
      const phones = phoneResponse.data.phone_numbers;
      log(`✅ Found ${phones.length} phone number(s):`, 'green');
      
      const targetPhone = phones.find(p => 
        p.phone_number.includes('4047387870') || 
        p.phone_number === '+14047387870'
      );
      
      if (targetPhone) {
        log(`\n📞 Target Phone +14047387870:`, 'green');
        log(`   ID: ${targetPhone.id}`, 'blue');
        log(`   Phone: ${targetPhone.phone_number}`, 'blue');
        log(`   Active: ${targetPhone.is_active}`, targetPhone.is_active ? 'green' : 'red');
        log(`   Agent ID: ${targetPhone.agent_id || 'NOT LINKED'}`, targetPhone.agent_id ? 'green' : 'red');
        log(`   Agent Name: ${targetPhone.agent_name || 'N/A'}`, 'blue');
        log(`   Agent Type: ${targetPhone.agent_type || 'N/A'}`, 'blue');
      } else {
        log(`\n❌ Phone number +14047387870 NOT FOUND in database!`, 'red');
        log(`   Available numbers:`, 'yellow');
        phones.forEach(p => {
          log(`   - ${p.phone_number} (ID: ${p.id})`, 'yellow');
        });
      }
    } else {
      log(`❌ Could not fetch phone numbers: ${phoneResponse.status}`, 'red');
    }

    // Check agents
    log('\n\n🤖 Step 2: Checking agents...', 'cyan');
    const agentsResponse = await axios.get(`${API_URL}/api/agents`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
      timeout: 10000,
      validateStatus: () => true
    });

    if (agentsResponse.status === 200 && agentsResponse.data.agents) {
      const agents = agentsResponse.data.agents;
      log(`✅ Found ${agents.length} agent(s):`, 'green');
      
      // Find agent ID 7 (the one linked to our phone)
      const agent7 = agents.find(a => a.id === 7);
      
      agents.forEach(agent => {
        const isTarget = agent.id === 7;
        log(`\n${isTarget ? '➡️ ' : '  '}Agent ID ${agent.id}: ${agent.name}`, isTarget ? 'green' : 'blue');
        log(`      Type: ${agent.type}`, 'blue');
        log(`      Active: ${agent.is_active}`, agent.is_active ? 'green' : 'red');
        log(`      Phone Number ID: ${agent.phone_number_id || 'NOT LINKED'}`, agent.phone_number_id ? 'green' : 'yellow');
        log(`      Has System Prompt: ${agent.system_prompt ? 'Yes (' + agent.system_prompt.length + ' chars)' : 'NO!'}`, agent.system_prompt ? 'green' : 'red');
        log(`      Voice Model: ${agent.voice_model || 'default'}`, 'blue');
      });
    } else {
      log(`❌ Could not fetch agents: ${agentsResponse.status}`, 'red');
    }

    // Check AI status
    log('\n\n🧠 Step 3: Checking AI Service Status...', 'cyan');
    const aiStatusResponse = await axios.get(`${API_URL}/api/ai-status`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
      timeout: 10000,
      validateStatus: () => true
    });

    if (aiStatusResponse.status === 200) {
      const status = aiStatusResponse.data;
      log(`\n📊 AI Service Status:`, 'green');
      log(`   OpenAI Configured: ${status.openai?.configured || status.openai_configured || 'unknown'}`, 
          (status.openai?.configured || status.openai_configured) ? 'green' : 'red');
      log(`   Anthropic Configured: ${status.anthropic?.configured || status.anthropic_configured || 'unknown'}`, 'blue');
      
      if (status.openai?.error || status.error) {
        log(`\n⚠️ AI Error: ${status.openai?.error || status.error}`, 'red');
      }
    } else {
      log(`❌ Could not check AI status: ${aiStatusResponse.status}`, 'red');
      log(`   Response: ${JSON.stringify(aiStatusResponse.data)}`, 'yellow');
    }

    // Test webchat directly to see if AI works
    log('\n\n🧪 Step 4: Testing AI via Webchat...', 'cyan');
    
    // Create conversation
    const convResponse = await axios.post(
      `${API_URL}/api/webchat/conversation`,
      { agent_id: 7, metadata: { test: true } },
      { timeout: 10000, validateStatus: () => true }
    );

    if (convResponse.status === 201) {
      const convId = convResponse.data.conversation_id;
      log(`✅ Conversation created: ${convId}`, 'green');
      
      if (convResponse.data.greeting_message) {
        log(`\n🎉 AI GREETING WORKS!`, 'green');
        log(`   "${convResponse.data.greeting_message}"`, 'yellow');
      }

      // Send test message
      const msgResponse = await axios.post(
        `${API_URL}/api/webchat/message`,
        { conversation_id: convId, message: 'Hello', agent_id: 7 },
        { timeout: 30000, validateStatus: () => true }
      );

      if (msgResponse.status === 200 && msgResponse.data.assistant_message) {
        log(`\n✅ AI RESPONSE WORKS!`, 'green');
        log(`   "${msgResponse.data.assistant_message}"`, 'yellow');
      } else {
        log(`\n❌ AI Response failed: ${msgResponse.status}`, 'red');
        log(`   ${JSON.stringify(msgResponse.data)}`, 'red');
      }
    } else {
      log(`❌ Could not create conversation: ${convResponse.status}`, 'red');
      log(`   ${JSON.stringify(convResponse.data)}`, 'red');
    }

    // Summary
    log('\n\n═'.repeat(60), 'cyan');
    log('📊 DIAGNOSIS SUMMARY', 'cyan');
    log('═'.repeat(60), 'cyan');
    log('\nIf AI works via webchat but fails on voice calls, the issue is likely:', 'yellow');
    log('   1. URL double /api/api/ bug in telephonyService.js (baseUrl includes /api)', 'yellow');
    log('   2. Missing organization_id in database lookups', 'yellow');
    log('   3. Error in generateVoiceResponse that doesn\'t affect webchat', 'yellow');
    log('\nTo fix, check the server logs for the exact error message.', 'cyan');

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
  }
}

checkConfiguration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

