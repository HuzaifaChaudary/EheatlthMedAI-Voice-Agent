# Simulate Call Error Fix

## Issue
Client reported: "Error processing message" when trying to simulate a call and make an appointment.

## Root Cause
The error handling in `/api/webchat/message` was too generic - it only returned "Error processing message" without details, making it impossible to diagnose the actual issue.

## Fix Applied

### 1. Improved Error Handling
**File**: `backend/routes/webchat.js`

**Changes**:
- Added detailed error logging with stack traces
- Added specific error messages for common issues:
  - OpenAI API key not configured
  - Rate limit exceeded
  - Quota exceeded
  - Invalid API key
  - Model not found
- Return more detailed error information to client (in development mode)

### 2. Common Error Scenarios

#### Scenario 1: OpenAI API Key Not Configured
**Error**: "OpenAI API key not configured"
**Fix**: Set `OPENAI_API_KEY` in `.env` file

#### Scenario 2: Invalid OpenAI API Key
**Error**: "Invalid OpenAI API key"
**Fix**: Check `OPENAI_API_KEY` value in `.env` file

#### Scenario 3: Rate Limit Exceeded
**Error**: "OpenAI API rate limit exceeded"
**Fix**: Wait a few moments and try again, or upgrade OpenAI plan

#### Scenario 4: Quota Exceeded
**Error**: "OpenAI API quota exceeded"
**Fix**: Check OpenAI account billing and add credits

#### Scenario 5: Model Not Found
**Error**: "AI model not found"
**Fix**: Check agent configuration - ensure model name is correct (e.g., "gpt-4", "gpt-3.5-turbo")

## Testing

### Test 1: Simulate Call with Valid Configuration
```bash
# Should work if:
# - OPENAI_API_KEY is set
# - Agent has valid system_prompt
# - Agent is active
```

### Test 2: Simulate Call with Missing API Key
```bash
# Should return: "OpenAI API key not configured"
```

### Test 3: Simulate Call with Invalid API Key
```bash
# Should return: "Invalid OpenAI API key"
```

## Client-Side Debugging

### Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for error messages when clicking "Simulate Call"
4. Check Network tab for failed API requests

### Check Backend Logs
```bash
# On production server:
pm2 logs ehealth-backend --lines 50

# Look for:
# - "Error processing web chat message"
# - "OpenAI API error"
# - Stack traces
```

## Most Likely Causes on Client's End

1. **Missing OpenAI API Key** (Most Common)
   - Check `.env` file on production
   - Verify `OPENAI_API_KEY` is set
   - Restart backend after adding key

2. **Invalid OpenAI API Key**
   - Key might be expired or revoked
   - Check OpenAI dashboard for key status

3. **Agent Configuration Issue**
   - Agent might not have `system_prompt`
   - Agent might be inactive (`is_active = false`)
   - Agent might have invalid model name

4. **Database Issue**
   - Conversation not found
   - Agent not found
   - Organization ID mismatch

## Next Steps

1. ✅ **Fixed**: Improved error handling to return detailed errors
2. ⚠️ **Need**: Check client's production `.env` file for `OPENAI_API_KEY`
3. ⚠️ **Need**: Check client's agent configuration
4. ⚠️ **Need**: Check backend logs on production for actual error

## Deployment

After deploying this fix, the client will see more specific error messages that will help diagnose the issue:

- Instead of: "Error processing message"
- They'll see: "OpenAI API key not configured" or "Invalid OpenAI API key" etc.

This will make it much easier to identify and fix the root cause.

