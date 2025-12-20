# Google Calendar Integration Setup

## ✅ Integration Configured

Your Google Calendar integration has been successfully configured with the provided OAuth tokens.

### Integration Details
- **Integration ID**: 7
- **Provider**: Google Calendar
- **Type**: Scheduling
- **Status**: Active

### Features Implemented

1. **Automatic Appointment Sync**
   - When appointments are created via AI calls (using `appointmentBookingService`), they automatically sync to Google Calendar
   - When appointments are created via the `/api/appointments` endpoint, they also automatically sync
   - The system prioritizes Google Calendar if multiple scheduling integrations exist

2. **Token Refresh**
   - The system automatically refreshes expired access tokens using the refresh token
   - Updated tokens are saved back to the database
   - If token refresh fails, the system logs an error but doesn't fail the appointment creation

3. **Event Details**
   - Appointments are synced with:
     - Patient name, phone, and email
     - Appointment type and notes
     - Start and end times (30-minute default duration)
     - Email reminders (24 hours before)
     - Popup reminders (30 minutes before)

### Testing

✅ **Manual Sync Test**: Successfully synced appointment ID 11 to Google Calendar
- Event ID: `3m4ge9k6t5au2ul3i5735h9f6c`
- Calendar Link: https://www.google.com/calendar/event?eid=M200Z2U5azZ0NWF1MnVsM2k1NzM1aDlmNmMgYWl3b3JsZEBlaG1lZC5haQ

### How It Works

1. **AI Call Creates Appointment**
   - When an AI agent books an appointment during a call, `appointmentBookingService.bookAppointment()` is called
   - The service automatically finds the first active Google Calendar integration
   - It syncs the appointment to Google Calendar immediately

2. **Manual Appointment Creation**
   - When creating appointments via the UI or API, the `/api/appointments` POST endpoint is used
   - The endpoint automatically syncs to Google Calendar if an integration exists

3. **Token Management**
   - Access tokens expire after ~1 hour
   - When a 401 error occurs, the system automatically refreshes the token
   - The refresh token is used to get a new access token
   - New access token is saved to the database

### API Endpoints

**Manual Sync** (if needed):
```bash
POST /api/integrations/appointments/:appointmentId/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "integration_id": 7
}
```

### Notes

- **Client ID/Secret**: Currently using OAuth Playground credentials. For production, you should:
  1. Create your own Google Cloud Project
  2. Enable Google Calendar API
  3. Create OAuth 2.0 credentials
  4. Update the integration with your own client_id and client_secret

- **Token Expiration**: Access tokens expire after 1 hour. The system will automatically refresh them, but if refresh fails, you'll need to re-authenticate.

- **Calendar ID**: Currently using "primary" calendar. You can change this in the integration credentials by setting `calendar_id` to a specific calendar ID.

### Next Steps

1. **Test with Real AI Call**: Make a call and have the AI agent book an appointment to verify automatic sync
2. **Check Google Calendar**: Verify that appointments appear in your Google Calendar
3. **Monitor Logs**: Check backend logs for sync activity and any errors

### Troubleshooting

If appointments aren't syncing:
1. Check that the integration is active: `GET /api/integrations`
2. Verify credentials are correct in the database
3. Check backend logs for sync errors
4. Test manual sync: `POST /api/integrations/appointments/:id/sync`

If token refresh fails:
1. Verify refresh_token is still valid
2. Check that client_id and client_secret are correct
3. Re-authenticate via OAuth if needed

