# Testing DELETE Integration Endpoint

## Issue
When clicking "Delete" on an integration, you get "Endpoint not found" error.

## Root Cause
The DELETE route exists but may not be matching correctly. The 404 handler in `server.js` is catching the request.

## Solution
I've added logging to the DELETE endpoint to help debug. Now test it:

## How to Test

### Option 1: Test via Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Get your auth token:
   ```javascript
   localStorage.getItem('token')
   ```
4. Get an integration ID from the page
5. Test the endpoint:
   ```javascript
   fetch('http://localhost:5000/api/integrations/1', {
     method: 'DELETE',
     headers: {
       'Authorization': 'Bearer YOUR_TOKEN_HERE',
       'Content-Type': 'application/json'
     }
   }).then(r => r.json()).then(console.log)
   ```

### Option 2: Test via Terminal
```bash
# First, get your token (login and copy from browser localStorage)
# Then run:
curl -X DELETE http://localhost:5000/api/integrations/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Option 3: Use the Test Script
```bash
node backend/scripts/test-delete-integration-endpoint.js YOUR_TOKEN [INTEGRATION_ID]
```

## Check Backend Logs
When you try to delete, check the backend console. You should see:
- `🗑️ DELETE /api/integrations/:id called` if the route is hit
- `❌ 404 - Endpoint not found: DELETE /api/integrations/...` if it's not matching

## Possible Issues
1. **Route not matching**: Check if the route path is correct
2. **Authentication failing**: Token might be expired
3. **Admin role required**: User must have admin role
4. **Organization mismatch**: Integration belongs to different organization

## Next Steps
1. Check backend logs when clicking delete
2. Verify the route is being hit (look for the log messages I added)
3. If route is not hit, check route registration order
4. If route is hit but returns 404, check organization_id matching

