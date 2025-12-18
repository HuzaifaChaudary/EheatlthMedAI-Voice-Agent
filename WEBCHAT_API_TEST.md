# Web Chat API Testing Guide

## Test OpenAI API Key

First, verify your OpenAI API key is valid:

```bash
# From project root
node test-openai.js
```

Or test directly with curl:

```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Say hello"}],
    "max_tokens": 10
  }'
```

## Test Web Chat API Endpoints

### 1. Get Available Agents

```bash
curl -X GET "http://localhost:5000/api/webchat/agents" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "agents": [
    {
      "id": 1,
      "name": "Front Desk Assistant",
      "type": "front_desk",
      "description": "Handles appointment scheduling..."
    }
  ]
}
```

### 2. Create Conversation

Replace `AGENT_ID` with an actual agent ID from step 1:

```bash
curl -X POST "http://localhost:5000/api/webchat/conversation" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": 1,
    "metadata": {
      "channel": "web_chat"
    }
  }'
```

Expected response:
```json
{
  "conversation_id": 123,
  "status": "active",
  "created_at": "2024-01-01T00:00:00.000Z",
  "greeting_message": "Hello! How can I help you today?"
}
```

### 3. Send Message

Replace `CONVERSATION_ID` and `AGENT_ID` with actual IDs:

```bash
curl -X POST "http://localhost:5000/api/webchat/message" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": 123,
    "message": "Hello, I need to schedule an appointment",
    "agent_id": 1
  }'
```

Expected response:
```json
{
  "conversation_id": 123,
  "user_message": "Hello, I need to schedule an appointment",
  "assistant_message": "I'd be happy to help you schedule an appointment...",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4. Get Conversation History

```bash
curl -X GET "http://localhost:5000/api/webchat/conversation/123" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "conversation_id": 123,
  "agent_name": "Front Desk Assistant",
  "agent_type": "front_desk",
  "messages": [
    {
      "role": "assistant",
      "content": "Hello! How can I help you today?",
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    {
      "role": "user",
      "content": "Hello, I need to schedule an appointment",
      "timestamp": "2024-01-01T00:00:01.000Z"
    }
  ],
  "status": "active",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:01.000Z"
}
```

## Complete Test Script

You can also use the provided test script:

```bash
./test-webchat-api.sh
```

Make sure to:
1. Update `AGENT_ID` and `CONVERSATION_ID` variables in the script
2. Ensure your backend server is running on port 5000
3. Have `jq` installed for pretty JSON output (optional)

## Troubleshooting

### Error: "Agent not found"
- Make sure agents exist in your database
- Check that the agent_id is correct
- Verify the agent is active (`is_active = true`)

### Error: "OpenAI API key not configured"
- Check `backend/.env` has `OPENAI_API_KEY` set
- Verify the key is valid using `node test-openai.js`
- Make sure the backend server has access to the .env file

### Error: "Error processing message"
- Check backend server logs for detailed error messages
- Verify OpenAI API key is valid and has quota
- Check database connection is working

### Conversation not initializing
- Check browser console for error messages
- Verify CORS is properly configured
- Check that the API endpoint is accessible

