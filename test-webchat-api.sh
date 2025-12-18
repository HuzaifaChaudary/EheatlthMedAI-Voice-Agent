#!/bin/bash

# Test Web Chat API Endpoints
# Make sure your backend server is running on port 5000 (or adjust API_URL)

API_URL="http://localhost:5000/api"

echo "=========================================="
echo "Testing Web Chat API"
echo "=========================================="
echo ""

# Test 1: Get available agents
echo "1. Testing GET /webchat/agents"
echo "----------------------------------------"
curl -X GET "${API_URL}/webchat/agents" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat
echo ""
echo ""

# Test 2: Create conversation (replace AGENT_ID with actual agent ID from step 1)
echo "2. Testing POST /webchat/conversation"
echo "----------------------------------------"
echo "Replace AGENT_ID with an actual agent ID from step 1"
AGENT_ID=1  # Change this to a real agent ID
curl -X POST "${API_URL}/webchat/conversation" \
  -H "Content-Type: application/json" \
  -d "{
    \"agent_id\": ${AGENT_ID},
    \"metadata\": {
      \"channel\": \"web_chat\"
    }
  }" \
  -w "\nStatus: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat
echo ""
echo ""

# Test 3: Send message (replace CONVERSATION_ID with ID from step 2)
echo "3. Testing POST /webchat/message"
echo "----------------------------------------"
echo "Replace CONVERSATION_ID with an actual conversation ID from step 2"
CONVERSATION_ID=1  # Change this to a real conversation ID
curl -X POST "${API_URL}/webchat/message" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversation_id\": ${CONVERSATION_ID},
    \"message\": \"Hello, I need to schedule an appointment\",
    \"agent_id\": ${AGENT_ID}
  }" \
  -w "\nStatus: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat
echo ""
echo ""

# Test 4: Get conversation history
echo "4. Testing GET /webchat/conversation/:id"
echo "----------------------------------------"
curl -X GET "${API_URL}/webchat/conversation/${CONVERSATION_ID}" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat
echo ""
echo ""

# Test 5: Test OpenAI API directly (requires OPENAI_API_KEY in .env)
echo "5. Testing OpenAI API Key directly"
echo "----------------------------------------"
cd backend
node -e "
require('dotenv').config();
const fetch = require('node-fetch');

async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.log('❌ OPENAI_API_KEY not found in .env');
    return;
  }
  
  console.log('✅ OPENAI_API_KEY found');
  console.log('Key starts with:', apiKey.substring(0, 7) + '...');
  console.log('Key length:', apiKey.length);
  console.log('');
  console.log('Testing OpenAI API...');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${apiKey}\`
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
    
    if (!response.ok) {
      const error = await response.json();
      console.log('❌ OpenAI API Error:', response.status, response.statusText);
      console.log('Error details:', JSON.stringify(error, null, 2));
    } else {
      const data = await response.json();
      console.log('✅ OpenAI API Success!');
      console.log('Response:', data.choices[0].message.content);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testOpenAI();
"
echo ""

