# Front Desk Agent UI Testing Guide

This guide explains how to test Front Desk Agent features through the user interface.

## Prerequisites

1. Backend server running on `http://localhost:5000`
2. Frontend server running on `http://localhost:3000`
3. Logged in as a user (use your credentials: `chhuzaifaiftikhar@gmail.com` / `Mypassword123_`)

## Testing Steps

### 1. Test Dynamic Greeting via Web Chat

**Location:** `http://localhost:3000/webchat`

**Steps:**
1. Navigate to the Web Chat page
2. Select a **Front Desk** agent from the dropdown
3. Start a conversation - you should see a greeting like:
   - "Good morning" (if before 12 PM)
   - "Good afternoon" (if 12 PM - 5 PM)
   - "Good evening" (if after 5 PM)
   - The greeting will include the patient name if provided

**What to verify:**
- ✅ Greeting changes based on time of day
- ✅ Greeting is personalized and friendly
- ✅ Agent responds appropriately to questions

### 2. Test FAQ/Knowledge Base via Web Chat

**Location:** `http://localhost:3000/webchat`

**Steps:**
1. Select **Front Desk** agent
2. Ask the following questions:
   - "What are your business hours?"
   - "Where are you located?"
   - "What services do you offer?"
   - "What are your hours on Monday?"

**What to verify:**
- ✅ AI provides accurate answers from FAQ knowledge base
- ✅ Answers are helpful and complete
- ✅ If FAQ not configured, AI still provides reasonable responses

**Note:** To add FAQ entries, you need to:
1. Run the SQL migration: `backend/config/milestone-faq-schema.sql`
2. Insert FAQ data via SQL or create an admin UI (future enhancement)

### 3. Test Appointment Booking via Chat

**Location:** `http://localhost:3000/webchat`

**Steps:**
1. Select **Front Desk** agent
2. Start a conversation like:
   - "I'd like to schedule an appointment"
   - "Can I book an appointment for next week?"
   - "I need to see a doctor"

**What to verify:**
- ✅ AI understands appointment booking requests
- ✅ AI asks for necessary information (date, time, patient name, etc.)
- ✅ AI provides helpful guidance

**Note:** Currently, appointments must be created via the Appointments UI or API. The chat can assist, but actual booking is done through the appointments page.

### 4. Test Appointment Management UI

**Location:** `http://localhost:3000/appointments`

**Steps:**

#### 4a. Create an Appointment
1. Click **"+ Create Appointment"** button
2. Fill in the form:
   - Patient Name: *Required*
   - Phone: Optional
   - Email: Optional
   - Date: *Required* (select a future date)
   - Time: *Required*
   - Appointment Type: Optional (e.g., "General Checkup")
   - Notes: Optional
3. Click **"Create"**

**What to verify:**
- ✅ Appointment is created successfully
- ✅ Appointment appears in the list
- ✅ All fields are saved correctly

#### 4b. View Appointments
1. All appointments are listed on the page
2. Each appointment shows:
   - Patient name
   - Status (scheduled, cancelled, completed)
   - Date and time
   - Appointment type
   - Contact information
   - Notes

**What to verify:**
- ✅ Appointments are displayed correctly
- ✅ Status badges have correct colors
- ✅ Date/time is formatted properly

#### 4c. Send Reminder
1. Find a scheduled appointment
2. Click **"Send Reminder"** button
3. Choose a method:
   - **Send SMS Reminder** (if phone number exists)
   - **Send Email Reminder** (if email exists)
   - **Send Both** (if both exist)

**What to verify:**
- ✅ Reminder modal opens
- ✅ Appropriate options are shown based on available contact info
- ✅ Reminder sends successfully (if Twilio/SMTP configured)
- ✅ Success message appears

**Note:** For reminders to actually send:
- SMS requires Twilio credentials in backend `.env`
- Email requires SMTP credentials in backend `.env`
- Without credentials, reminders will be logged but not sent

#### 4d. Cancel Appointment
1. Find a scheduled appointment
2. Click **"Cancel"** button
3. Confirm cancellation

**What to verify:**
- ✅ Confirmation dialog appears
- ✅ Appointment status changes to "cancelled"
- ✅ Appointment remains visible but marked as cancelled

### 5. Test from Dashboard

**Location:** `http://localhost:3000/dashboard`

**Steps:**
1. Navigate to Dashboard
2. Look for the **"Appointments"** quick link card
3. Click it to go to the appointments page

**What to verify:**
- ✅ Appointments link is visible
- ✅ Link navigates correctly to `/appointments`
- ✅ Web Chat link is also available

## Visual Testing Checklist

### Web Chat Interface (`/webchat`)
- [ ] Dark theme matches rest of application
- [ ] Agent selector dropdown works
- [ ] Chat interface loads correctly
- [ ] Messages display properly (user on right, AI on left)
- [ ] Input field is functional
- [ ] Send button works
- [ ] Greeting appears on conversation start
- [ ] Messages are timestamped

### Appointments Page (`/appointments`)
- [ ] Dark theme matches rest of application
- [ ] Header with "← Dashboard" link works
- [ ] "+ Create Appointment" button is visible
- [ ] Appointments list displays correctly
- [ ] Status badges use correct colors:
  - Green for "scheduled"
  - Red for "cancelled"
  - Blue for "completed"
- [ ] Create modal opens and closes correctly
- [ ] Form validation works (required fields)
- [ ] Reminder modal opens correctly
- [ ] Cancel button works with confirmation

## Common Issues and Solutions

### Issue: "No agents available"
**Solution:** Make sure you have created at least one agent, especially a "Front Desk" type agent, in the database or via the admin panel.

### Issue: Greeting doesn't change based on time
**Solution:** Check browser timezone. The greeting service uses server time. If testing, try different times or check server logs.

### Issue: FAQ answers are generic
**Solution:** The FAQ knowledge base table may not be created or populated. Run `milestone-faq-schema.sql` and add FAQ entries.

### Issue: Reminders not sending
**Solution:** 
1. Check backend `.env` for Twilio/SMTP credentials
2. Check backend console logs for errors
3. Without credentials, reminders will log but not send (this is expected)

### Issue: Appointments not showing
**Solution:**
1. Check if you're logged in
2. Check browser console for errors
3. Verify backend is running and `/api/appointments` endpoint is accessible
4. Appointments are filtered by organization, so ensure your user has an organization

## Expected Behavior Summary

1. **Web Chat:**
   - Front Desk agent provides time-appropriate greetings
   - AI answers FAQ questions using knowledge base
   - AI assists with appointment booking inquiries

2. **Appointments UI:**
   - Create appointments with patient details
   - View all appointments with status indicators
   - Send reminders via SMS, email, or both
   - Cancel appointments with confirmation

3. **Integration:**
   - Appointments created in UI are accessible via API
   - Chat interface uses same backend as appointments
   - All features respect organization boundaries (multi-tenant)

## Next Steps for Enhanced Testing

1. **Configure Business Hours:**
   - Update `ai_agents.business_hours` column in database
   - Test greeting during and outside business hours

2. **Add FAQ Data:**
   - Insert FAQ entries into `faq_knowledge_base` table
   - Test different categories (hours, directions, services)

3. **Configure Reminders:**
   - Add Twilio credentials for SMS
   - Add SMTP credentials for email
   - Test actual reminder delivery

4. **Test Appointment Sync:**
   - Configure scheduling system integrations
   - Verify appointments sync to external systems

## Quick Test Commands

If you want to test via browser console:

```javascript
// Test API directly from browser console (on localhost:3000)
fetch('http://localhost:5000/api/appointments', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
})
.then(r => r.json())
.then(console.log)
```

Replace `YOUR_TOKEN_HERE` with your actual JWT token from localStorage or session.

