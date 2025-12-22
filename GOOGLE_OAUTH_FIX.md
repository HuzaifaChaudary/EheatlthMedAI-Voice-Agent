# Google OAuth Fix Guide

## Current Configuration

**Client ID**: `66538738276-m3k3h0ob54c9tuo4dfvruqs8c4999u87.apps.googleusercontent.com`  
**Redirect URI**: `https://huzaifaiftikhar.engineer/api/auth/google/callback`

## Issue: "OAuth client wasn't found"

This error means Google can't find the OAuth client with that Client ID. Here's how to fix it:

---

## Step 1: Verify Client ID in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Find your **OAuth 2.0 Client ID**
5. **Click on it** to view details
6. **Verify the Client ID matches exactly**: `66538738276-m3k3h0ob54c9tuo4dfvruqs8c4999u87.apps.googleusercontent.com`


### If Client ID doesn't match:
- Copy the **correct Client ID** from Google Cloud Console
- Update it in your backend `.env` file

---

## Step 2: Clean Up Authorized Redirect URIs

**YES, remove the `ehealthmed.ai` entries** - they're not needed if you're not using that domain.

### Keep Only These Redirect URIs:

```
https://huzaifaiftikhar.engineer/api/auth/google/callback
http://huzaifaiftikhar.engineer/api/auth/google/callback
http://localhost:5000/api/auth/google/callback
```

### Remove These (if not using):
- `http://ehealthmed.ai/api/auth/google/callback`
- `https://ehealthmed.ai/api/auth/google/callback`
- `https://api.huzaifaiftikhar.engineer/api/auth/google/callback` (unless you set up api subdomain)
- `http://api.huzaifaiftikhar.engineer/api/auth/google/callback` (unless you set up api subdomain)

---

## Step 3: Clean Up Authorized JavaScript Origins

### Keep Only These:

```
https://huzaifaiftikhar.engineer
http://localhost:3000
```

### Remove These (if not using):
- `http://ehealthmed.ai`
- `https://ehealthmed.ai`

---

## Step 4: Verify OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Make sure:
   - **User Type**: External (or Internal if using Google Workspace)
   - **App name**: Your app name
   - **Authorized domains**: `huzaifaiftikhar.engineer` (if required)
   - **Scopes**: `openid`, `email`, `profile` (should be there)

---

## Step 5: Common Issues & Fixes

### Issue 1: Client ID Not Found
**Cause**: Client ID in `.env` doesn't match Google Cloud Console  
**Fix**: Copy exact Client ID from Google Cloud Console

### Issue 2: Redirect URI Mismatch
**Cause**: Redirect URI in request doesn't exactly match what's configured  
**Fix**: Ensure exact match (including `https://` vs `http://`)

### Issue 3: OAuth Consent Screen Not Published
**Cause**: App is in "Testing" mode and user email not added  
**Fix**: 
- Add your email to "Test users" in OAuth consent screen, OR
- Publish the app (if ready for production)

### Issue 4: Wrong Project Selected
**Cause**: Looking at wrong Google Cloud project  
**Fix**: Make sure you're in the correct project that has the OAuth client

---

## Step 6: Test the Configuration

After making changes:

1. **Wait 5-10 minutes** for Google to update (can take time)
2. **Clear browser cache** or use incognito mode
3. **Test the OAuth flow**:
   - Go to: `https://huzaifaiftikhar.engineer/login`
   - Click "Sign in with Google"
   - Should redirect to Google login
   - After login, should redirect back to your app

---

## Quick Verification Commands

On your EC2 instance, you can verify the configuration:

```bash
# Check what redirect URI is being used
curl https://huzaifaiftikhar.engineer/api/auth/google

# Check backend logs
pm2 logs ehealth-backend --lines 50
```

---

## Recommended Google Cloud Console Settings

### Authorized JavaScript origins:
```
https://huzaifaiftikhar.engineer
http://localhost:3000
```

### Authorized redirect URIs:
```
https://huzaifaiftikhar.engineer/api/auth/google/callback
http://huzaifaiftikhar.engineer/api/auth/google/callback
http://localhost:5000/api/auth/google/callback
```

**That's it!** Keep it simple. Remove all the `ehealthmed.ai` and `api.huzaifaiftikhar.engineer` entries unless you're actually using them.

---

## Still Not Working?

1. **Double-check Client ID** - Copy/paste directly from Google Cloud Console
2. **Check Client Secret** - Make sure it matches too
3. **Verify OAuth consent screen** - Make sure it's configured
4. **Check backend logs** - `pm2 logs ehealth-backend` to see exact error
5. **Wait 10 minutes** - Google changes can take time to propagate

