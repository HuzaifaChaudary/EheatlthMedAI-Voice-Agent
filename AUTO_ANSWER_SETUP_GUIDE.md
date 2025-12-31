# Auto-Answer Setup Guide for Testing

## Problem
You can't manually answer calls to test the system. Calls show "Busy" with 0 duration because the destination number isn't answering.

## Solution
Configure a **second Twilio number** to **auto-answer** with a test message. This way:
- ✅ Calls will always connect (auto-answer)
- ✅ Status will be "Completed" with duration > 0
- ✅ No human needed to answer
- ✅ Perfect for testing appointment booking

---

## Step 1: Setup Auto-Answer Number

Run this script to configure one of your Twilio numbers to auto-answer:

```bash
node backend/scripts/setup-auto-answer-number.js
```

**What it does:**
1. Lists all your Twilio phone numbers
2. Configures one to auto-answer with a test message
3. Sets the webhook URL to: `https://ehealthmed.ai/api/test-telephony/auto-answer`

**Result:**
- Any call to that number will auto-answer
- Play a test message
- Hang up automatically
- Show as "Completed" in Twilio with duration > 0

---

## Step 2: Test the Auto-Answer

Run this script to make a test call:

```bash
node backend/scripts/test-auto-answer-call.js
```

**What it does:**
1. Finds your auto-answer number
2. Makes a call from another number to it
3. Waits for the call to complete
4. Verifies status = "Completed" and duration > 0

**Expected Result:**
```
✅ Call completed!
   Duration: 5 seconds
   Status: completed

🎉 SUCCESS! Call connected and played message!
   Duration > 0 means the call actually connected
   The auto-answer system is working!
```

---

## Step 3: Test Appointment Booking

Once auto-answer is working, you can test appointment booking:

### Option A: Use Auto-Answer Number as Destination

When making test calls for appointment booking, use the auto-answer number as the destination:

```bash
# In your test script, change the "to" number to your auto-answer number
to: "+1XXXXXXXXXX"  # Your auto-answer number
```

### Option B: Configure Auto-Answer with Appointment Message

Use the appointment-specific endpoint:

```bash
# Configure number to use:
https://ehealthmed.ai/api/test-telephony/auto-answer-appointment
```

This will play an appointment confirmation message when called.

---

## Available Auto-Answer Endpoints

### 1. Basic Auto-Answer
**URL**: `/api/test-telephony/auto-answer`
**What it does**: Plays a simple test message and hangs up

### 2. Appointment Auto-Answer
**URL**: `/api/test-telephony/auto-answer-appointment`
**What it does**: Plays an appointment confirmation message
**Query params**:
- `patient_name` - Patient name
- `appointment_date` - Appointment date
- `appointment_type` - Appointment type

### 3. Speech Collection (for STT testing)
**URL**: `/api/test-telephony/auto-answer-collect`
**What it does**: Asks for speech input and repeats it back

---

## Manual Configuration (Alternative)

If you prefer to configure manually in Twilio Console:

1. Go to Twilio Console → Phone Numbers → Manage → Active Numbers
2. Click on the number you want to use for testing
3. Set **Voice Configuration**:
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://ehealthmed.ai/api/test-telephony/auto-answer`
   - **HTTP**: POST
4. Set **Status Callback URL**:
   - **URL**: `https://ehealthmed.ai/api/telephony/twilio/status`
   - **HTTP**: POST
5. Click **Save**

---

## Verification

After setup, verify it works:

1. **Check Twilio Console**:
   - Go to Monitor → Logs → Calls
   - Make a test call
   - Status should be: **Completed**
   - Duration should be: **> 0 seconds**

2. **Check Backend Logs**:
   - Look for: `📞 Incoming call received`
   - Look for: `📞 Status callback received`

3. **Test Call**:
   ```bash
   node backend/scripts/test-auto-answer-call.js
   ```

---

## Troubleshooting

### Issue: Call still shows "Busy" or "No Answer"
- **Check**: Is the number configured with the auto-answer webhook?
- **Fix**: Run `setup-auto-answer-number.js` again

### Issue: Duration still 0
- **Check**: Is the webhook URL accessible?
- **Fix**: Verify `https://ehealthmed.ai/api/test-telephony/auto-answer` is reachable

### Issue: "Call failed"
- **Check**: Twilio credentials are correct
- **Check**: Number is active in Twilio
- **Fix**: Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env

---

## Summary

✅ **Setup**: Configure a second number to auto-answer  
✅ **Test**: Make calls that always connect  
✅ **Verify**: Status = "Completed", Duration > 0  
✅ **Result**: Can test appointment booking without manual answering

This solves the "Busy/0 duration" problem by ensuring calls always connect!
