#!/bin/bash

# Test OpenAI API Key with curl
# Replace YOUR_OPENAI_API_KEY with your actual key from backend/.env

echo "=========================================="
echo "Testing OpenAI API Key"
echo "=========================================="
echo ""

# Read API key from .env file
if [ -f "backend/.env" ]; then
  API_KEY=$(grep "^OPENAI_API_KEY=" backend/.env | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
  
  if [ -z "$API_KEY" ]; then
    echo "❌ OPENAI_API_KEY not found in backend/.env"
    echo "Please set OPENAI_API_KEY in backend/.env"
    exit 1
  fi
  
  echo "✅ Found OPENAI_API_KEY in backend/.env"
  echo "Key starts with: ${API_KEY:0:7}..."
  echo "Key length: ${#API_KEY}"
  echo ""
  echo "Testing OpenAI API..."
  echo ""
  
  # Test OpenAI API
  curl -X POST https://api.openai.com/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d '{
      "model": "gpt-3.5-turbo",
      "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Say hello in one word."}
      ],
      "max_tokens": 10
    }' \
    -w "\n\nHTTP Status: %{http_code}\n" \
    | jq '.' 2>/dev/null || cat
else
  echo "❌ backend/.env file not found"
  echo "Please set OPENAI_API_KEY in backend/.env"
  exit 1
fi

