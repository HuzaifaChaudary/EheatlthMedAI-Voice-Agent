/**
 * Test OpenAI API Key
 * Run: node test-openai.js
 */

require('dotenv').config({ path: './backend/.env' });

async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  
  if (!apiKey) {
    console.log('❌ OPENAI_API_KEY not found in backend/.env');
    console.log('Please set OPENAI_API_KEY in your backend/.env file');
    return;
  }
  
  console.log('✅ OPENAI_API_KEY found');
  console.log('Key starts with:', apiKey.substring(0, 7) + '...');
  console.log('Key length:', apiKey.length);
  console.log('');
  console.log('Testing OpenAI API...');
  
  try {
    const fetch = require('node-fetch');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say hello in one word.' }
        ],
        max_tokens: 10
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.log('❌ OpenAI API Error:', response.status, response.statusText);
      console.log('Error details:', JSON.stringify(data, null, 2));
      
      if (data.error) {
        if (data.error.message.includes('Invalid API key')) {
          console.log('\n⚠️  Your OpenAI API key appears to be invalid.');
          console.log('Please check your OPENAI_API_KEY in backend/.env');
        } else if (data.error.message.includes('insufficient_quota')) {
          console.log('\n⚠️  Your OpenAI account has insufficient quota.');
          console.log('Please check your OpenAI account billing.');
        }
      }
    } else {
      console.log('✅ OpenAI API Success!');
      console.log('Response:', data.choices[0].message.content);
      console.log('Model:', data.model);
      console.log('Usage:', JSON.stringify(data.usage, null, 2));
    }
  } catch (error) {
    console.log('❌ Network Error:', error.message);
    console.log('Make sure you have an internet connection.');
  }
}

testOpenAI();

