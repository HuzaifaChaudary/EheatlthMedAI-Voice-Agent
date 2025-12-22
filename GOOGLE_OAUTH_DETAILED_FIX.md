# Google OAuth "OAuth client wasn't found" - Detailed Fix

## Current Configuration (Verified ✅)

**Backend Configuration:**
- Client ID: `66538738276-m3k3h0ob54c9tuo4dfvruqs8c4999u87.apps.googleusercontent.com`
- Client Secret: `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` (35 chars)
- Redirect URI: `https://huzaifaiftikhar.engineer/api/auth/google/callback`

**OAuth URL Generated:**
```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=66538738276-m3k3h0ob54c9tuo4dfvruqs8c4999u87.apps.googleusercontent.com
  &redirect_uri=https://huzaifaiftikhar.engineer/api/auth/google/callback
  &response_type=code
  &scope=openid email profile
  &access_type=offline
  &prompt=consent
```

---

## Step-by-Step Fix in Google Cloud Console

### Step 1: Verify OAuth Client Exists

1. Go to: https://console.cloud.google.com/apis/credentials
2. **Select the correct project** (make sure you're in the right Google Cloud project)
3. Look for **OAuth 2.0 Client IDs**
4. Find the client with ID: `66538738276-m3k3h0ob54c9tuo4dfvruqs8c4999u87`
5. **Click on it** to open details

**If you don't see this Client ID:**
- The Client ID in your `.env` is wrong
- You're looking at the wrong Google Cloud project
- The OAuth client was deleted

**Solution:** Create a new OAuth client or find the correct one.

---

### Step 2: Verify Authorized Redirect URIs

In the OAuth client details, check **Authorized redirect URIs**:

**Must have EXACTLY:**
```
https://huzaifaiftikhar.engineer/api/auth/google/callback
```

**Optional (for local dev):**
```
http://localhost:5000/api/auth/google/callback
```

**Remove ALL of these (if present):**
- ❌ `http://ehealthmed.ai/api/auth/google/callback`
- ❌ `https://ehealthmed.ai/api/auth/google/callback`
- ❌ `https://api.huzaifaiftikhar.engineer/api/auth/google/callback`
- ❌ `http://api.huzaifaiftikhar.engineer/api/auth/google/callback`

**Important:**
- Must match EXACTLY (including `https://` vs `http://`)
- No trailing slashes
- Case-sensitive

---

### Step 3: Verify Authorized JavaScript Origins

In the OAuth client details, check **Authorized JavaScript origins**:

**Must have:**
```
https://huzaifaiftikhar.engineer
```

**Optional (for local dev):**
```
http://localhost:3000
```

**Remove ALL of these (if present):**
- ❌ `http://ehealthmed.ai`
- ❌ `https://ehealthmed.ai`

---

### Step 4: Check OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Verify:
   - **User Type**: External (or Internal if using Google Workspace)
   - **App name**: Set to something (e.g., "EHealth Med AI")
   - **User support email**: Your email
   - **Authorized domains**: `huzaifaiftikhar.engineer` (if required)
   - **App domain**: `huzaifaiftikhar.engineer` (if required)

3. **Publishing Status:**
   - If **Testing**: Add your email to "Test users" list
   - If **In production**: Should work for all users

**Common Issue:** App is in "Testing" mode and your email isn't in test users.

**Fix:** 
- Go to "Test users" section
- Click "ADD USERS"
- Add your email address
- Save

---

### Step 5: Verify APIs Are Enabled

1. Go to: https://console.cloud.google.com/apis/library
2. Make sure these APIs are **ENABLED**:
   - ✅ **Google+ API** (if still available)
   - ✅ **People API** (recommended)
   - ✅ **OAuth2 API** (should be auto-enabled)

---

### Step 6: Check for Multiple OAuth Clients

Sometimes there are multiple OAuth clients. Make sure you're using the right one:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Look at ALL OAuth 2.0 Client IDs
3. Check each one's Client ID
4. Make sure the one you're using has the correct redirect URIs

---

## Common Error Messages & Fixes

### Error: "OAuth client wasn't found"
**Cause:** Client ID doesn't exist or wrong project  
**Fix:** 
- Verify Client ID in Google Cloud Console
- Make sure you're in the correct project
- Check if Client ID was deleted

### Error: "redirect_uri_mismatch"
**Cause:** Redirect URI doesn't match exactly  
**Fix:**
- Copy redirect URI EXACTLY from backend: `https://huzaifaiftikhar.engineer/api/auth/google/callback`
- Paste it in Google Cloud Console
- No trailing slashes, exact match

### Error: "access_denied"
**Cause:** User denied permission or app not published  
**Fix:**
- If app is in "Testing" mode, add user email to test users
- Publish the app if ready

### Error: "invalid_client"
**Cause:** Client ID or Client Secret is wrong  
**Fix:**
- Verify Client ID matches exactly
- Verify Client Secret matches exactly
- Check for extra spaces or characters

---

## Verification Checklist

Before testing, verify:

- [ ] Client ID in `.env` matches Google Cloud Console exactly
- [ ] Client Secret in `.env` matches Google Cloud Console exactly
- [ ] Redirect URI `https://huzaifaiftikhar.engineer/api/auth/google/callback` is in Authorized redirect URIs
- [ ] JavaScript origin `https://huzaifaiftikhar.engineer` is in Authorized JavaScript origins
- [ ] OAuth consent screen is configured
- [ ] If app is in "Testing", your email is in test users
- [ ] All `ehealthmed.ai` entries are removed
- [ ] You're looking at the correct Google Cloud project

---

## Test the OAuth Flow

1. **Wait 5-10 minutes** after making changes (Google needs time to update)
2. **Clear browser cache** or use incognito mode
3. **Go to**: `https://huzaifaiftikhar.engineer/login`
4. **Click**: "Sign in with Google"
5. **Should redirect** to Google login page
6. **After login**, should redirect back to your app

---

## Still Not Working?

### Debug Steps:

1. **Check the exact error message** from Google:
   - When you click "Sign in with Google", what error shows?
   - Copy the exact error message

2. **Check backend logs**:
   ```bash
   pm2 logs ehealth-backend --lines 50
   ```
   Look for OAuth-related errors

3. **Test the OAuth URL directly**:
   - Get the URL from: `https://huzaifaiftikhar.engineer/api/auth/google`
   - Copy the `url` field
   - Paste in browser
   - See what error Google shows

4. **Verify DNS is correct**:
   ```bash
   nslookup huzaifaiftikhar.engineer
   ```
   Should return: `34.225.194.2`

5. **Check if SSL is working**:
   ```bash
   curl -I https://huzaifaiftikhar.engineer
   ```
   Should return HTTP 200

---

## Quick Fix Commands

If you need to update the redirect URI in Google Cloud Console:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", click "ADD URI"
4. Add: `https://huzaifaiftikhar.engineer/api/auth/google/callback`
5. Click "SAVE"
6. Wait 5-10 minutes
7. Test again

---

## Contact Information

If still not working after all these steps:
- Check Google Cloud Console error logs
- Verify you have the correct Google account with access to the project
- Make sure billing is enabled (sometimes required for OAuth)

