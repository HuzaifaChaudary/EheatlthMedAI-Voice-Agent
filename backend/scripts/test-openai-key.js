#!/usr/bin/env node

/**
 * Test OpenAI API Key
 * Usage: node scripts/test-openai-key.js [your-api-key]
 */

const https = require('https');

const apiKey = process.argv[2] || process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ Error: No API key provided');
  console.log('\nUsage:');
  console.log('  node scripts/test-openai-key.js YOUR_API_KEY');
  console.log('  or set OPENAI_API_KEY environment variable');
  console.log('\nExample:');
  console.log('  node scripts/test-openai-key.js sk-proj-...');
  process.exit(1);
}

// Validate key format
const keyPattern = /^sk-[a-zA-Z0-9-]{20,}$/;
if (!keyPattern.test(apiKey)) {
  console.warn('⚠️  Warning: API key format looks unusual');
  console.log('   Expected format: sk-... (usually 51+ characters)');
  console.log('   Your key length:', apiKey.length);
  console.log('   Your key starts with:', apiKey.substring(0, 10));
}

console.log('\n🔍 Testing OpenAI API Key...\n');
console.log('Key (first 10 chars):', apiKey.substring(0, 10) + '...');

const requestData = JSON.stringify({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'user', content: 'Say hello' }
  ],
  max_tokens: 10
});

const options = {
  hostname: 'api.openai.com',
  port: 443,
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'Content-Length': Buffer.byteLength(requestData)
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n📊 Response Status:', res.statusCode, res.statusMessage);
    
    try {
      const json = JSON.parse(data);
      
      if (res.statusCode === 200) {
        console.log('\n✅ SUCCESS! Your API key is valid!\n');
        console.log('Response:', json.choices[0].message.content);
        console.log('\nModel:', json.model);
        console.log('Usage:', json.usage);
      } else {
        console.log('\n❌ ERROR: API key validation failed\n');
        console.log('Error:', json.error);
        if (json.error?.code === 'invalid_api_key') {
          console.log('\n💡 Your API key is invalid. Please check:');
          console.log('   1. Get a new key from https://platform.openai.com/api-keys');
          console.log('   2. Make sure the key starts with "sk-"');
          console.log('   3. Ensure there are no extra spaces or quotes');
        }
      }
    } catch (e) {
      console.log('\n❌ Failed to parse response');
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Request failed:', error.message);
  console.log('\n💡 Check your internet connection');
});

req.write(requestData);
req.end();

