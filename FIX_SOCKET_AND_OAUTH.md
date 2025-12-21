# Fix Socket.io and Google OAuth Issues

## Issue 1: WebSocket Connection Failed

Socket.io is not installed in the backend.

### Fix:

**Install socket.io:**
```bash
cd backend
npm install socket.io
```

**Restart backend:**
```bash
npm start
```

The server.js has been updated to support socket.io. Once you install it, WebSocket connections will work.

---

## Issue 2: Google OAuth redirect_uri_mismatch

The redirect URI in Google Cloud Console doesn't match your backend `.env`.

### Fix:

**Step 1: Add redirect URI to Google Cloud Console**

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth 2.0 Client ID: `66538738276-m3k3h0ob54c9tuo4dfvruqs8c4999u87`
3. Under "Authorized redirect URIs", add:
   ```
   http://localhost:5000/api/auth/google/callback
   ```
4. Click "Save"

**Step 2: Verify backend/.env**

Make sure `backend/.env` has:
```env
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```

**Step 3: Restart Backend**

```bash
cd backend
npm start
```

---

## Summary

1. ✅ Updated `backend/package.json` - added socket.io
2. ✅ Updated `backend/server.js` - added socket.io configuration
3. ✅ Fixed SocketProvider to extract base URL correctly
4. ⚠️  **You need to:**
   - Run: `cd backend && npm install socket.io`
   - Add redirect URI to Google Cloud Console
   - Restart backend

After these steps, both WebSocket and Google OAuth should work!

