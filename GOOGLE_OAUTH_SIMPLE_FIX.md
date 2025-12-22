# Google OAuth Simple Fix Guide

## Your Current Google Cloud Console Settings ✅

**Authorized JavaScript origins:**
- ✅ `http://localhost:3000` (for local dev)
- ✅ `https://huzaifaiftikhar.engineer` (for production)

**Authorized redirect URIs:**
- ✅ `http://localhost:5000/api/auth/google/callback` (for local dev)
- ✅ `https://huzaifaiftikhar.engineer/api/auth/google/callback` (for production - **THIS IS THE ONE BEING USED**)
- ⚠️ `http://huzaifaiftikhar.engineer/api/auth/google/callback` (HTTP version - **NOT NEEDED** but won't hurt)

---

## Do You Need Both HTTP and HTTPS?

**Short answer: NO, you only need HTTPS.**

Since you have SSL certificate set up:
- Your site redirects HTTP → HTTPS automatically
- Google OAuth will use HTTPS
- The HTTP redirect URI is **not needed** but **won't cause problems** if it's there

**You can remove the HTTP one** (`http://huzaifaiftikhar.engineer/api/auth/google/callback`) if you want, but it's fine to keep it.

---

## What "Must Match EXACTLY" Means

When I said "must match exactly", I meant:

✅ **CORRECT:**
```
https://huzaifaiftikhar.engineer/api/auth/google/callback
```

❌ **WRONG (these won't work):**
```
https://huzaifaiftikhar.engineer/api/auth/google/callback/  (trailing slash)
HTTPS://huzaifaiftikhar.engineer/api/auth/google/callback  (wrong case)
https://www.huzaifaiftikhar.engineer/api/auth/google/callback  (www prefix)
https://huzaifaiftikhar.engineer/API/auth/google/callback  (wrong case)
```

**Your current setup is CORRECT!** ✅

---

## The Real Issue: "OAuth client wasn't found"

This error means Google can't find your OAuth client. Here's what to check:

### Step 1: Verify You're in the Right Project

1. Go to: https://console.cloud.google.com/
2. **Check the project name** at the top (next to "Google Cloud")
3. Make sure it's the project where you created the OAuth client
4. If wrong, click it and select the correct project

### Step 2: Check OAuth Consent Screen (MOST COMMON ISSUE)

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Look at **"Publishing status"**:
   
   **If it says "Testing":**
   - Scroll down to **"Test users"**
   - Click **"ADD USERS"**
   - Add **your email address** (the one you're using to login)
   - Click **"ADD"**
   - **This is likely the problem!** If your app is in testing mode and your email isn't added, Google will reject the OAuth request.

   **If it says "In production":**
   - Should work for all users
   - If not working, there might be another issue

### Step 3: Verify OAuth Client Exists

1. Go to: https://console.cloud.google.com/apis/credentials
2. Look for **OAuth 2.0 Client IDs**
3. Find one with Client ID starting with: `66538738276-m3k3h0ob...`
4. **Click on it**
5. Verify:
   - **Client ID** matches: `66538738276-m3k3h0ob54c9tuo4dfvruqs8c4999u87.apps.googleusercontent.com`
   - **Authorized redirect URIs** has: `https://huzaifaiftikhar.engineer/api/auth/google/callback`
   - **Authorized JavaScript origins** has: `https://huzaifaiftikhar.engineer`

---

## Quick Test

After making changes:

1. **Wait 5-10 minutes** (Google needs time to update)
2. **Clear your browser cache** or use **incognito mode**
3. Go to: `https://huzaifaiftikhar.engineer/login`
4. Click **"Sign in with Google"**
5. Should redirect to Google login page

---

## Most Likely Fix

**90% of the time, the issue is:**

Your OAuth consent screen is in **"Testing"** mode and your email is **not in the test users list**.

**Fix:**
1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Scroll to **"Test users"**
3. Click **"ADD USERS"**
4. Add your email
5. Save
6. Wait 5 minutes
7. Try again

---

## Summary

✅ Your redirect URIs are correct  
✅ Your JavaScript origins are correct  
✅ Backend configuration is correct  

❓ **Check OAuth Consent Screen** - Is your email in test users?  
❓ **Check Project** - Are you in the right Google Cloud project?  

The HTTP redirect URI is optional - you can keep it or remove it, it won't affect anything.

