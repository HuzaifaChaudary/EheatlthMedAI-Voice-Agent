# How to Publish OAuth Consent Screen to Production

## Step-by-Step Guide

### Step 1: Go to OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Make sure you're in the **correct Google Cloud project**

### Step 2: Complete Required Fields

**Where to find these fields:**
- From the OAuth Overview page, click **"Branding"** or **"Audience"** in the left sidebar
- Or go directly to: https://console.cloud.google.com/apis/credentials/consent
- You'll see a form with multiple sections

**What to fill in:**

1. **App name**: 
   - Field location: Top of the page, first field
   - Enter: `EHealth Med AI` (or your app name)
   - This is what users see when they sign in

2. **User support email**: 
   - Field location: Usually below app name
   - Enter: Your email address (e.g., `yourname@gmail.com`)
   - This is where users can contact you for support

3. **App logo** (optional but recommended):
   - Field location: Usually in the "Branding" section
   - Upload: Your app logo image
   - This appears on the OAuth consent screen

4. **App domain**: 
   - Field location: In "Authorized domains" section
   - Enter: `huzaifaiftikhar.engineer`
   - This is your website domain

5. **Authorized domains**: 
   - Field location: Same section as App domain
   - Enter: `huzaifaiftikhar.engineer`
   - This tells Google which domains are allowed

6. **Application home page**:
   - Field location: In the "App domain" section
   - Enter: `https://huzaifaiftikhar.engineer`
   - This is your main website URL

7. **Application privacy policy link**:
   - Field location: Below "Application home page"
   - Enter: `https://huzaifaiftikhar.engineer/privacy`
   - This is a **required** field - we've created this page for you

8. **Application terms of service link**:
   - Field location: Below "Application privacy policy link"
   - Enter: `https://huzaifaiftikhar.engineer/terms`
   - This is a **required** field - we've created this page for you

9. **Developer contact information**: 
   - Field location: Usually at the bottom
   - Enter: Your email address
   - This is for Google to contact you if needed

**Note:** If you see red error messages or asterisks (*) next to fields, those are **required** and must be filled before you can publish.

**✅ Privacy Policy and Terms pages have been created for you at:**
- Privacy Policy: `https://huzaifaiftikhar.engineer/privacy`
- Terms of Service: `https://huzaifaiftikhar.engineer/terms`

### Step 3: Add Scopes (if not already added)

1. Scroll to **"Scopes"** section
2. Make sure these scopes are added:
   - `openid`
   - `email`
   - `profile`
3. If missing, click **"ADD OR REMOVE SCOPES"** and add them

### Step 4: Add Test Users (Temporary - for verification)

1. Scroll to **"Test users"**
2. Add at least **one test user** (your email)
3. This is required even when publishing to production

### Step 5: Publish to Production

1. Scroll to the top of the page
2. Look for **"Publishing status"** section
3. Click **"PUBLISH APP"** button
4. Confirm the dialog

### Step 6: Verification Process (if required)

**If Google asks for verification:**

- For **sensitive scopes** (like accessing user data), Google may require app verification
- For basic scopes like `openid`, `email`, `profile` - usually no verification needed
- If verification is required, you'll need to:
  1. Fill out the verification form
  2. Provide app information
  3. Wait for Google's review (can take days/weeks)

**For now, if verification is not required:**
- Your app will be published immediately
- All users can use Google OAuth

---

## Important Notes

### Before Publishing

✅ **Complete all required fields:**
- App name
- User support email
- App domain
- Developer contact

✅ **Add required scopes:**
- `openid`
- `email`
- `profile`

✅ **Add at least one test user** (even for production)

### After Publishing

- ⏰ **Wait 5-10 minutes** for changes to propagate
- 🌐 **All users** can now use Google OAuth (no need to add to test users)
- ✅ **No more "OAuth client wasn't found"** errors

---

## Quick Checklist

Before clicking "PUBLISH APP":

- [ ] App name is set
- [ ] User support email is set
- [ ] App domain: `huzaifaiftikhar.engineer`
- [ ] Authorized domains: `huzaifaiftikhar.engineer`
- [ ] Scopes: `openid`, `email`, `profile` are added
- [ ] At least one test user is added (your email)
- [ ] Developer contact information is set

---

## If Verification is Required

If Google asks you to verify your app:

1. **For internal use**: If this is only for your organization, you might be able to skip verification
2. **For public use**: You'll need to complete verification
3. **Verification process**:
   - Fill out app information
   - Provide privacy policy URL (if required)
   - Provide terms of service URL (if required)
   - Wait for Google's review

**For basic OAuth (openid, email, profile)**, verification is usually **not required** for most apps.

---

## After Publishing

1. **Wait 5-10 minutes**
2. **Clear browser cache** or use incognito mode
3. **Test the login**:
   - Go to: `https://huzaifaiftikhar.engineer/login`
   - Click "Sign in with Google"
   - Should work for all users now!

---

## Troubleshooting

### "App verification required"
- This means Google wants to review your app
- For basic scopes, this is usually not needed
- Try removing unnecessary scopes
- Or complete the verification process

### "Cannot publish - missing required fields"
- Go back and fill in all required fields
- Check the red error messages
- Complete all sections

### Still getting "OAuth client wasn't found"
- Wait 10-15 minutes after publishing
- Clear browser cache
- Try incognito mode
- Check that you're in the correct Google Cloud project

---

## Summary

**To publish to production:**
1. Complete all required fields
2. Add required scopes
3. Add at least one test user
4. Click "PUBLISH APP"
5. Wait 5-10 minutes
6. Test!

Once published, **all users** can use Google OAuth without being added to test users! 🎉

