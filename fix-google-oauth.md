# Fix Google OAuth Redirect URI Mismatch

## Error
```
Error 400: redirect_uri_mismatch
```

## Solution

### Step 1: Update Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID (the one with Client ID: `66538738276-m3k3h0ob54c9tuo4dfvruqs8c4999u87`)
3. Under "Authorized redirect URIs", add:
   ```
   http://localhost:5000/api/auth/google/callback
   ```
4. Click "Save"

### Step 2: Verify backend/.env

Make sure `backend/.env` has:
```env
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```

### Step 3: Restart Backend

After updating:
```bash
cd backend
npm start
```

## For AWS Deployment

When you deploy to AWS, you'll need to:
1. Add your AWS domain to Google Cloud Console:
   ```
   https://your-aws-domain.com/api/auth/google/callback
   ```
2. Update `backend/.env` on AWS:
   ```env
   GOOGLE_REDIRECT_URI=https://your-aws-domain.com/api/auth/google/callback
   ```

