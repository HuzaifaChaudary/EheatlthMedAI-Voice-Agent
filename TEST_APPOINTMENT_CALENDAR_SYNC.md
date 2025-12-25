# Test End-to-End Appointment → Google Calendar Sync

## Overview

This guide helps you test the complete flow of creating an appointment and verifying it syncs to Google Calendar automatically.

## Prerequisites

✅ **Google Calendar Integration Active**
- Integration exists in database
- `is_active = true`
- Valid OAuth credentials (access_token, refresh_token)

✅ **Backend Running**
- PM2 service `ehealth-backend` is online
- Database connection working

## Testing Methods

### Method 1: Automated Test Script (Recommended)

**Run the test script:**

```bash
cd /home/ubuntu/EHealthMedAI/backend
node scripts/test-appointment-calendar-sync.js
```

**What it does:**
1. ✅ Checks for active Google Calendar integration
2. ✅ Creates a test appointment
3. ✅ Syncs to Google Calendar automatically
4. ✅ Verifies sync was successful
5. ✅ Shows calendar event link

**Expected Output:**
```
🧪 Testing Appointment → Google Calendar Sync
============================================

📋 Step 1: Checking for active Google Calendar integration...
✅ Found integration: Google Calendar (ID: 1, Org: 1)
✅ Credentials found

📋 Step 2: Creating test appointment...
✅ Created appointment ID: 123
   Patient: Test Patient (Calendar Sync Test)
   Date: 2025-12-25T14:00:00.000Z
   Type: Follow-up

📋 Step 3: Syncing appointment to Google Calendar...
✅ Sync successful!
   Event ID: 3m4ge9k6t5au2ul3i5735h9f6c
   Calendar Link: https://www.google.com/calendar/event?eid=...

🎉 Test Complete!
```

### Method 2: Manual Test via Frontend

**Steps:**

1. **Navigate to Appointments Page**
   - Go to: `https://huzaifaiftikhar.engineer/appointments`
   - Or: `http://localhost:3000/appointments` (local)

2. **Create New Appointment**
   - Click "Create Appointment" or "New Appointment"
   - Fill in:
     - Patient Name
     - Phone Number
     - Email (optional)
     - Appointment Date & Time
     - Appointment Type
     - Notes (optional)
   - Click "Save" or "Create"

3. **Check Backend Logs**
   ```bash
   pm2 logs ehealth-backend --lines 50
   ```
   Look for:
   - `Appointment X synced to scheduling system`
   - `Appointment X synced to Google Calendar`

4. **Check Google Calendar**
   - Open your Google Calendar
   - Look for the new event
   - Verify details match the appointment

### Method 3: Manual Test via API

**Create appointment via API:**

```bash
# Get your auth token first (from login)
TOKEN="your_jwt_token_here"

# Create appointment
curl -X POST https://huzaifaiftikhar.engineer/api/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_name": "Test Patient",
    "patient_phone": "+1234567890",
    "patient_email": "test@example.com",
    "appointment_date": "2025-12-25T14:00:00Z",
    "appointment_type": "Follow-up",
    "notes": "Test appointment for calendar sync"
  }'
```

**Check response:**
- Should return `201 Created` with appointment data
- Check backend logs for sync confirmation

## Verification Checklist

After creating an appointment, verify:

- [ ] **Appointment Created in Database**
  ```sql
  SELECT * FROM appointments ORDER BY id DESC LIMIT 1;
  ```

- [ ] **Sync Logged in Backend**
  - Check PM2 logs: `pm2 logs ehealth-backend`
  - Look for: "Appointment X synced to scheduling system"

- [ ] **Integration Updated**
  ```sql
  SELECT last_sync_at FROM integrations WHERE provider = 'google_calendar';
  ```
  - Should show recent timestamp

- [ ] **Event in Google Calendar**
  - Open Google Calendar
  - Find the event matching appointment time
  - Verify patient name, time, and details

- [ ] **Event Details Match**
  - Patient name matches
  - Date/time matches
  - Appointment type in description
  - Notes included (if any)

## Troubleshooting

### ❌ "No active Google Calendar integration found"

**Fix:**
```bash
cd backend
node scripts/setup-google-calendar.js
```

### ❌ "Integration missing access_token or refresh_token"

**Fix:**
1. Go to `/dashboard/integrations`
2. Edit Google Calendar integration
3. Update credentials with valid OAuth tokens

### ❌ "Sync failed: Invalid credentials"

**Possible causes:**
- Access token expired (should auto-refresh)
- Refresh token invalid
- OAuth permissions revoked

**Fix:**
1. Re-authenticate with Google OAuth
2. Update integration credentials
3. Test again

### ❌ "Appointment created but not in calendar"

**Check:**
1. Backend logs for errors
2. Integration `is_active = true`
3. Organization ID matches
4. Google Calendar API permissions

**Debug:**
```bash
# Check integration status
cd backend
node scripts/test-integration-status.js

# Check specific appointment
# Look in PM2 logs for sync errors
pm2 logs ehealth-backend | grep -i "sync\|calendar\|appointment"
```

### ❌ "Event created but wrong calendar"

**Fix:**
- Check `calendar_id` in integration credentials
- Default is `"primary"` (main calendar)
- Can specify specific calendar ID

## Expected Behavior

### ✅ Successful Sync

1. **Appointment Created**
   - Stored in `appointments` table
   - Has `organization_id` matching integration

2. **Automatic Sync Triggered**
   - `appointmentSyncService.syncAppointment()` called
   - Finds active Google Calendar integration
   - Syncs appointment data

3. **Google Calendar Event Created**
   - Event appears in calendar
   - Includes patient name, time, type
   - Has reminders (24h email, 30m popup)

4. **Database Updated**
   - `integrations.last_sync_at` updated
   - `appointments.updated_at` updated

5. **Webhook Triggered** (if configured)
   - `appointment.synced` event fired
   - Webhook subscribers notified

### 🔄 Update Sync

When an appointment is **updated**, it also syncs:
- Changes reflected in Google Calendar
- Event updated (not duplicated)
- `last_sync_at` updated again

## Production Testing

**On Production Server:**

```bash
# SSH to production
ssh -i ~/ehealth-key-1766435634.pem ubuntu@34.225.194.2

# Run test script
cd /home/ubuntu/EHealthMedAI/backend
node scripts/test-appointment-calendar-sync.js

# Or check logs while creating appointment via UI
pm2 logs ehealth-backend --lines 100
```

## Next Steps After Successful Test

1. ✅ **Verify Update Sync**
   - Update an existing appointment
   - Check Google Calendar updates

2. ✅ **Test Multiple Appointments**
   - Create several appointments
   - Verify all sync correctly

3. ✅ **Test Different Appointment Types**
   - Follow-up, Consultation, Procedure, etc.
   - Verify all types sync

4. ✅ **Test Error Handling**
   - Disable integration temporarily
   - Create appointment (should not fail)
   - Re-enable and verify sync resumes

## Summary

✅ **Integration is ready** - Google Calendar integration is active  
✅ **Code is implemented** - Automatic sync on appointment creation  
✅ **Test script available** - `test-appointment-calendar-sync.js`  
✅ **Ready to test** - Follow steps above to verify end-to-end flow  

---

**Status**: ⚠️ **READY TO TEST** - Run test script or create appointment via UI/API

