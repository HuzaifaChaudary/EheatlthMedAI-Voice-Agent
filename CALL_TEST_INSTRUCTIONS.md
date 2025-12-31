# Test Call Instructions - Appointment Booking with Google Calendar

## Setup

1. **Set Google Calendar credentials in .env**:
```bash
GOOGLE_CALENDAR_CLIENT_ID=407408718192.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_ACCESS_TOKEN=ya29.a0Aa7pCA8F8ZB-YeXdbW-5uI_9XYB1LSDAjaFEzY8pRXbhuVwbVve0CUlCPxFlnTho-_Gfaj6OuX1jCSCV_o1BYjWWfLgc-FNtFzrYUC0oNdENckwsSsdIgJSrUrhMmcMABnV3rctW35mF4xG_WpmqNmc-uhwe7HRBYvrN-uGrOkeBfTWmNTks7wqWm2U1xlJKVIwxTxcaCgYKAX0SARcSFQHGX2Miy_Ae7l3UO6xl78D33822fg0206
GOOGLE_CALENDAR_REFRESH_TOKEN=1//04N8Tb4bAblqwCgYIARAAGAQSNwF-L9IraZYykFTEuUDqAYoL2ISl5XPeczAgN43ufLlmnj3TWUwpA9iFpbhcnzkp4CEqt748fz8
GOOGLE_CALENDAR_ID=primary
```

2. **Get authentication token**:
   - Login to the application
   - Open browser console
   - Run: `localStorage.getItem('ehealth_token')`
   - Copy the token

3. **Set environment variables**:
```bash
export TEST_TOKEN="your_token_here"
export FROM_PHONE_ID=1  # ID of +17703434007 in database
export AGENT_ID=1       # ID of the agent
```

## Run Test Call

```bash
node backend/scripts/test-call-simple.js
```

## What Happens

1. **Call is initiated** from +17703434007 to 404-738-7870
2. **Bot answers** and starts conversation
3. **When you say "I want to book an appointment"**:
   - Bot collects: name, date/time, appointment type
   - Bot calls `book_appointment` function
   - Appointment is created in database
   - Appointment is synced to Google Calendar
   - Bot confirms: "Appointment successfully booked... The appointment has been added to your calendar."

## Verify Appointment Booking

### Check Database
```bash
# Check backend logs for:
📅 APPOINTMENT BOOKED: { appointment_id: X, patient_name: "...", ... }
📅 GOOGLE CALENDAR SYNC SUCCESS: { event_id: "...", html_link: "..." }
```

### Check Google Calendar
1. Go to https://calendar.google.com
2. Look for new event with title: "Appointment: [Appointment Type]"
3. Event should have:
   - Patient name in description
   - Phone number
   - Date and time
   - 30-minute duration

### Check via API
```bash
# Get appointments
curl -H "Authorization: Bearer $TEST_TOKEN" \
  https://ehealthmed.ai/api/appointments

# Check Google Calendar events
curl -H "Authorization: Bearer $GOOGLE_CALENDAR_ACCESS_TOKEN" \
  "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)"
```

## Expected Bot Behavior

When you say:
- "I want to book an appointment"
- "I need to schedule a visit"
- "Can I make an appointment?"

Bot should:
1. Ask for your name
2. Ask for preferred date and time
3. Ask for appointment type (optional)
4. **Actually book the appointment** (not just confirm)
5. Say: "Appointment successfully booked for [Name] on [Date]. The appointment has been added to your calendar."

## Troubleshooting

### Bot doesn't book appointment
- Check agent has `book_appointment` function in system prompt
- Check backend logs for function call
- Verify AI service is configured (OPENAI_API_KEY)

### Appointment not syncing to Google Calendar
- Check Google Calendar credentials in database
- Check backend logs for sync errors
- Verify integration is active: `SELECT * FROM integrations WHERE provider = 'google_calendar' AND is_active = true;`
- Check agent has `calendar_integration_id` set

### Call doesn't connect
- Verify phone numbers are in database
- Check agent is linked to phone number
- Verify Twilio is configured
- Check backend logs for webhook errors

## Monitoring

Watch backend logs in real-time:
```bash
# On EC2
pm2 logs ehealth-backend

# Look for:
📞 Incoming call received
✅ Agent found
🎤 Generating voice response...
📅 APPOINTMENT BOOKED
📅 GOOGLE CALENDAR SYNC SUCCESS
```
