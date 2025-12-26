# Telephony Call Error Fix

## Problem
When calling a phone number linked to an agent, the caller receives "application error has occurred" instead of connecting to the agent.

## Root Causes Identified

1. **Missing Error Handling**: Errors in the voice response generation were not being caught properly
2. **AI Service Not Configured**: If OpenAI/Anthropic API keys are missing, the call fails
3. **Invalid TwiML Response**: If the response format is wrong, Twilio shows an error
4. **Missing Content-Type Header**: Twilio requires `text/xml` content type
5. **Silent Failures**: Errors were being caught but not logged with enough detail

## Fixes Applied

### 1. Enhanced Error Handling in `/twilio/inbound` endpoint
- Added try-catch around `generateVoiceResponse` call
- Added validation for TwiML response format
- Added proper Content-Type header (`text/xml`)
- Added detailed error logging with agent ID and conversation ID
- Update call log status to 'failed' on error

### 2. Enhanced Error Handling in `/twilio/voice` endpoint
- Added try-catch around voice response generation
- Added validation for TwiML response format
- Added proper Content-Type header (`text/xml`)
- Added detailed error logging
- Better error messages for different failure scenarios

### 3. Improved `generateVoiceResponse` Function
- Added validation to check if AI service is configured before use
- Added error handling around AI service calls
- Added validation for AI response format
- Better error messages indicating what's missing (API keys, etc.)

### 4. Better Error Messages
- Changed generic "error occurred" to "application error has occurred" (matches what client hears)
- Added proper Twilio Say verb configuration with voice and language
- Consistent error handling across all webhook endpoints

## Common Issues to Check

### 1. OpenAI API Key Not Configured
**Symptom**: "application error has occurred"  
**Fix**: Set `OPENAI_API_KEY` in `.env` file

### 2. Webhook URL Not Accessible
**Symptom**: Twilio can't reach the webhook endpoint  
**Fix**: 
- Ensure `API_URL` is set to the public URL (not localhost)
- Ensure the server is accessible from the internet
- Check firewall/security group settings

### 3. Database Connection Issues
**Symptom**: Errors in logs about database queries  
**Fix**: Check database connection and ensure all required tables exist

### 4. Agent Not Properly Configured
**Symptom**: Agent not found errors  
**Fix**: 
- Ensure agent is active (`is_active = true`)
- Ensure agent has `phone_number_id` set
- Ensure agent has `organization_id` matching phone number

## Testing

To test the fix:

1. **Check Environment Variables**:
   ```bash
   echo $OPENAI_API_KEY
   echo $API_URL
   echo $TWILIO_ACCOUNT_SID
   ```

2. **Check Server Logs**:
   When a call comes in, check the backend logs for:
   - "Error generating voice response" messages
   - Agent ID and Conversation ID in error logs
   - Stack traces showing where the error occurred

3. **Test Call Flow**:
   - Call the linked phone number
   - Should hear agent greeting (not error message)
   - If error occurs, check logs for specific error message

## Next Steps

1. **Monitor Logs**: Watch backend logs during test calls to identify specific errors
2. **Check Twilio Dashboard**: Look at Twilio call logs for webhook errors
3. **Verify Configuration**: Ensure all required environment variables are set
4. **Test with Different Agents**: Test with different agent types to ensure all work

## Debugging Commands

```bash
# Check if OpenAI is configured
curl -X GET http://localhost:5000/api/ai-status

# Check phone numbers
curl -X GET http://localhost:5000/api/telephony/phone-numbers \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check agents
curl -X GET http://localhost:5000/api/agents \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Expected Behavior After Fix

1. **Successful Call**:
   - Caller hears agent greeting
   - Agent responds to caller's speech
   - Conversation continues normally

2. **If Error Occurs**:
   - Detailed error logged in backend
   - Caller hears: "I apologize, but an application error has occurred. Please try again later."
   - Call log marked as 'failed'
   - Error includes specific cause (missing API key, etc.)

