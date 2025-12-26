# Comprehensive Integration Fix Plan

## Client Requirements Summary

1. **Calendar Integration Issues:**
   - Can't disconnect existing Google Calendar
   - Can't connect their own Google Calendar
   - Need per-agent calendar configuration (each agent has independent calendar)

2. **GoHighLevel CRM Integration:**
   - Not fully implemented/working
   - Need to test endpoints with payloads

3. **Core Functionality:**
   - Voice AI should forward calls if emergency
   - Voice AI should book appointments in:
     - CRM (GoHighLevel)
     - Google Calendar
     - EHR (Electronic Health Record)
   - All three systems should work simultaneously

4. **EHR Integration:**
   - Was set up before but not active
   - Need to activate and test

5. **Testing:**
   - Test all endpoints with payloads
   - Ensure each and every functionality works

## Implementation Plan

### Phase 1: Critical Fixes (Immediate)

#### 1.1 Add Delete/Disconnect Functionality ✅
- [x] Add DELETE endpoint in backend (`/api/integrations/:id`)
- [ ] Add delete button in frontend integrations page
- [ ] Add confirmation modal before deletion
- [ ] Test delete functionality

#### 1.2 Per-Agent Calendar Configuration
- [ ] Add `calendar_integration_id` column to `ai_agents` table
- [ ] Update agent creation/update endpoints to accept calendar_integration_id
- [ ] Update appointment booking service to use agent's calendar
- [ ] Update frontend agent configuration page to select calendar
- [ ] Test per-agent calendar assignment

#### 1.3 Multi-System Appointment Booking
- [ ] Update `appointmentBookingService` to sync to ALL systems:
  - Google Calendar (if agent has calendar_integration_id)
  - GoHighLevel CRM (if organization has GHL integration)
  - EHR (if organization has EHR system configured)
- [ ] Ensure all three can work simultaneously
- [ ] Add error handling for partial failures
- [ ] Test booking to all three systems

### Phase 2: GoHighLevel CRM Completion

#### 2.1 Complete GHL Integration
- [ ] Review existing GHL service implementation
- [ ] Test GHL authentication flow
- [ ] Test GHL appointment creation
- [ ] Test GHL contact creation
- [ ] Add GHL appointment sync to appointment booking service
- [ ] Create test scripts with payloads

#### 2.2 GHL Testing
- [ ] Test `/api/integrations/ghl/auth-url` endpoint
- [ ] Test `/api/integrations/ghl/callback` endpoint
- [ ] Test appointment creation with GHL payload
- [ ] Verify GHL calendar integration

### Phase 3: Emergency Forwarding

#### 3.1 Emergency Detection
- [ ] Add emergency detection to AI agent function calls
- [ ] Create `forward_call` function for AI agents
- [ ] Add emergency contact configuration to agents
- [ ] Test emergency forwarding flow

#### 3.2 Call Forwarding Implementation
- [ ] Add forwarding logic to telephony service
- [ ] Update Twilio webhook to handle forwarding
- [ ] Add forwarding to call logs
- [ ] Test forwarding functionality

### Phase 4: EHR Integration Activation

#### 4.1 EHR System Configuration
- [ ] Review existing EHR integration code
- [ ] Test EHR system endpoints
- [ ] Add EHR system selection to appointment booking
- [ ] Test FHIR appointment creation
- [ ] Test HL7 message sending

#### 4.2 EHR Testing
- [ ] Test `/api/integrations-ehr` endpoints
- [ ] Test appointment sync to EHR
- [ ] Verify EHR data format
- [ ] Test error handling

### Phase 5: Comprehensive Testing

#### 5.1 Endpoint Testing Scripts
- [ ] Create test script for calendar integrations
- [ ] Create test script for CRM integrations
- [ ] Create test script for EHR integrations
- [ ] Create test script for appointment booking (all systems)
- [ ] Create test script for emergency forwarding

#### 5.2 Integration Testing
- [ ] Test calendar disconnect/reconnect
- [ ] Test per-agent calendar assignment
- [ ] Test multi-system appointment booking
- [ ] Test emergency forwarding
- [ ] Test EHR appointment sync

## Files to Modify

### Backend
1. `backend/routes/integrations.js` - Add DELETE endpoint ✅
2. `backend/config/add-calendar-integration-to-agents.sql` - Migration script ✅
3. `backend/routes/agents.js` - Add calendar_integration_id support
4. `backend/services/appointmentBookingService.js` - Multi-system sync
5. `backend/services/ghlService.js` - Complete GHL implementation
6. `backend/services/telephonyService.js` - Emergency forwarding
7. `backend/routes/telephony.js` - Emergency forwarding webhooks

### Frontend
1. `frontend/app/dashboard/integrations/page.tsx` - Add delete button
2. `frontend/app/dashboard/agents/[agentId]/page.tsx` - Add calendar selection
3. `frontend/app/dashboard/agents/new/page.tsx` - Add calendar selection

### Test Scripts
1. `backend/scripts/test-integrations-comprehensive.js` - All integrations
2. `backend/scripts/test-appointment-booking-all-systems.js` - Multi-system booking
3. `backend/scripts/test-ghl-integration.js` - GHL specific tests
4. `backend/scripts/test-ehr-integration.js` - EHR specific tests

## Testing Payloads

### Calendar Integration
```json
{
  "name": "My Google Calendar",
  "type": "scheduling",
  "provider": "google_calendar",
  "credentials": {
    "access_token": "...",
    "refresh_token": "...",
    "client_id": "...",
    "client_secret": "...",
    "calendar_id": "primary"
  }
}
```

### GoHighLevel CRM
```json
{
  "name": "GoHighLevel CRM",
  "type": "crm",
  "provider": "gohighlevel",
  "credentials": {
    "api_key": "...",
    "location_id": "..."
  }
}
```

### Appointment Booking (All Systems)
```json
{
  "patient_name": "John Doe",
  "patient_phone": "+1234567890",
  "patient_email": "john@example.com",
  "appointment_date": "2025-01-20T10:00:00Z",
  "appointment_type": "General Checkup",
  "notes": "First visit"
}
```

## Success Criteria

1. ✅ Can disconnect existing calendar integration
2. ✅ Can connect new calendar integration
3. ✅ Each agent can have independent calendar
4. ✅ GoHighLevel CRM integration works end-to-end
5. ✅ Emergency calls can be forwarded
6. ✅ Appointments book to Calendar + CRM + EHR simultaneously
7. ✅ All endpoints tested with payloads
8. ✅ EHR integration active and working

