#!/bin/bash

# Test OpenAI API Key with curl
# Usage: ./test-openai.sh YOUR_API_KEY

API_KEY="${1:-$OPENAI_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: No API key provided"
  echo ""
  echo "Usage:"
  echo "  ./test-openai.sh YOUR_API_KEY"
  echo "  or set OPENAI_API_KEY environment variable"
  echo ""
  echo "Example:"
  echo "  ./test-openai.sh sk-proj-..."
  exit 1
fi

echo "🔍 Testing OpenAI API Key..."
echo "Key (first 10 chars): ${API_KEY:0:10}..."
echo ""

curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Say hello"}],
    "max_tokens": 10
  }' \
  -w "\n\nHTTP Status: %{http_code}\n"

