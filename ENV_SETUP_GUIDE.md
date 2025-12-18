# Environment Variables Setup Guide

## ✅ **REQUIRED - Currently Working**

These are **already configured** and **working** in your code:

### Core (Must Have)
- ✅ `DATABASE_URL` - PostgreSQL connection (✅ Set: `postgresql://postgres:str0ng@localhost:5432/EHealthMedAI`)
- ✅ `PORT` - Server port (✅ Set: `5000`)
- ✅ `NODE_ENV` - Environment (✅ Set: `development`)
- ✅ `FRONTEND_URL` - Frontend URL for OAuth redirects (✅ Set: `http://localhost:3000`)
- ✅ `JWT_SECRET` - JWT signing key (✅ Set)
- ✅ `JWT_EXPIRES_IN` - Token expiry (✅ Set: `7d`)
- ✅ `CORS_ORIGIN` - CORS allowed origin (✅ Set: `http://localhost:3000`)

### Google OAuth (Working)
- ✅ `GOOGLE_CLIENT_ID` - Google OAuth client ID (✅ Set)
- ✅ `GOOGLE_CLIENT_SECRET` - Google OAuth secret (✅ Set)
- ✅ `GOOGLE_REDIRECT_URI` - OAuth callback URL (✅ Set: `http://localhost:5000/api/auth/google/callback`)

### AI Services (Working)
- ✅ `OPENAI_API_KEY` - OpenAI API key (✅ Set)
- ✅ `OPENAI_ORGANIZATION_ID` - OpenAI org ID (✅ Set)
- ✅ `ELEVENLABS_API_KEY` - ElevenLabs TTS API key (✅ Set)
- ✅ `ELEVENLABS_VOICE_ID` - ElevenLabs voice ID (✅ Set)
- ⚠️ `ANTHROPIC_API_KEY` - Optional, for Claude AI (Empty - OK)

---

## ⚠️ **OPTIONAL - Not Implemented Yet**

These are in your `.env` but **NOT used in code**. You can remove them or keep them for future use:

### STT Services (❌ Missing Implementation)
- ❌ `GOOGLE_STT_API_KEY` - **NOT USED** - No `sttService.js` file exists
- ❌ `GOOGLE_STT_PROJECT_ID` - **NOT USED** - No `sttService.js` file exists
- ❌ `DEEPGRAM_API_KEY` - **NOT USED** - No `sttService.js` file exists (You have: `91b513294d4c5d5331b27b6a4e1878ae7131bbe7`)
- ❌ `ASSEMBLYAI_API_KEY` - **NOT USED** - No `sttService.js` file exists

**Action Needed:** Create `backend/services/sttService.js` to use these

### Telephony (❌ Not Implemented)
- ❌ `TWILIO_ACCOUNT_SID` - **NOT USED** - Telephony routes exist but don't call Twilio API
- ❌ `TWILIO_AUTH_TOKEN` - **NOT USED**
- ❌ `TWILIO_PHONE_NUMBER` - **NOT USED**
- ❌ `VONAGE_API_KEY` - **NOT USED**
- ❌ `VONAGE_API_SECRET` - **NOT USED**

**Action Needed:** Implement Twilio/Vonage integration in `backend/routes/telephony.js`

### Email (❌ Not Implemented)
- ❌ `SENDGRID_API_KEY` - **NOT USED** - Password reset has comment "In production, send email here"
- ❌ `SENDGRID_FROM_EMAIL` - **NOT USED**
- ❌ `SMTP_HOST` - **NOT USED**
- ❌ `SMTP_PORT` - **NOT USED**
- ❌ `SMTP_USER` - **NOT USED**
- ❌ `SMTP_PASSWORD` - **NOT USED**
- ❌ `SMTP_FROM` - **NOT USED**

**Action Needed:** Create `backend/services/emailService.js` for password reset emails

### Storage (❌ Not Implemented)
- ❌ `AWS_ACCESS_KEY_ID` - **NOT USED** - No S3 upload service
- ❌ `AWS_SECRET_ACCESS_KEY` - **NOT USED**
- ❌ `AWS_REGION` - **NOT USED**
- ❌ `AWS_S3_BUCKET` - **NOT USED**
- ❌ `CLOUDINARY_CLOUD_NAME` - **NOT USED**
- ❌ `CLOUDINARY_API_KEY` - **NOT USED**
- ❌ `CLOUDINARY_API_SECRET` - **NOT USED**

**Action Needed:** Implement file storage for call recordings

### Monitoring (❌ Not Implemented)
- ❌ `SENTRY_DSN` - **NOT USED** - No Sentry error tracking
- ❌ `LOG_LEVEL` - **NOT USED**
- ❌ `LOG_FORMAT` - **NOT USED**

### Security (❌ Not Implemented)
- ❌ `ENCRYPTION_KEY` - **NOT USED** - No encryption service
- ❌ `ENCRYPTION_ALGORITHM` - **NOT USED**

### Audit (❌ Not Implemented)
- ❌ `AUDIT_LOG_SERVICE_URL` - **NOT USED** - Audit logs go to database only
- ❌ `AUDIT_LOG_API_KEY` - **NOT USED**

### Other (Not Used)
- ❌ `API_URL` - **NOT USED** in backend (only used in frontend)
- ❌ `SESSION_SECRET` - **NOT USED** - Using JWT, not sessions
- ❌ `COOKIE_SECURE` - **NOT USED**
- ❌ `COOKIE_SAME_SITE` - **NOT USED**

---

## 📋 **Summary: What You Need**

### ✅ **For Basic Website to Work:**
**You already have everything!** Your website should work with:
- Database ✅
- Authentication ✅
- Google OAuth ✅
- AI Services (OpenAI) ✅
- Text-to-Speech (ElevenLabs) ✅

### ⚠️ **For Full Features (Future):**

1. **STT Service** (Speech-to-Text) - You have Deepgram API key but need implementation
   - Create `backend/services/sttService.js`
   - Integrate with voice AI routes

2. **Email Service** (Password Reset) - Currently just logs to console
   - Create `backend/services/emailService.js`
   - Use SendGrid or SMTP

3. **Telephony** (Phone Calls) - Routes exist but don't make calls
   - Implement Twilio/Vonage integration
   - Add webhook handlers

4. **File Storage** (Call Recordings) - No storage service
   - Implement AWS S3 or Cloudinary
   - Add upload/download routes

---

## 🎯 **Recommendations**

### Immediate Actions:
1. ✅ **Keep current setup** - Everything needed for basic functionality is working
2. ⚠️ **Remove unused vars** (optional) - Clean up `.env` by removing unused variables
3. 🔨 **Implement STT** - You have Deepgram key, create the service to use it

### Priority Order:
1. **STT Service** (High) - You already have Deepgram API key
2. **Email Service** (Medium) - Needed for password reset
3. **Telephony** (Low) - Only if you need phone calls
4. **Storage** (Low) - Only if you need file uploads

---

## 🚀 **Next Steps**

Would you like me to:
1. Create `backend/services/sttService.js` to use your Deepgram API key?
2. Create `backend/services/emailService.js` for password reset emails?
3. Clean up your `.env` file to remove unused variables?

Let me know what you'd like to implement first!

