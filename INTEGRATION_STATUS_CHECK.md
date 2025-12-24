# Calendar & EHR/CRM Integration Status Check

## Summary

**Client Issue**: "The potential configurations with the calendar for the EHR or CRM are not active"

## Current Status

### ✅ **Backend Code is Implemented**
- Calendar integration services exist (`appointmentSyncService.js`)
- EHR integration services exist (`ehrSyncService.js`, `hl7Service.js`, `fhirService.js`)
- CRM integration services exist (`crmService.js`)
- All routes are registered in `server.js`:
  - `/api/integrations` - General integrations (calendar, CRM)
  - `/api/integrations-ehr` - EHR-specific (HL7, FHIR)

### ❌ **Frontend Pages Exist But May Not Be Accessible**
- Calendar integration: No dedicated frontend page (configured via backend `.env` or integrations API)
- EHR integration: Frontend pages exist:
  - `/architecture/ehr` - EHR Systems page
  - `/architecture/hl7` - HL7 Connectors page
  - `/architecture/fhir` - FHIR Connectors page
- CRM integration: No dedicated frontend page (configured via integrations API)

### ⚠️ **Likely Issues**

1. **No Active Integrations in Database**
   - Users haven't created calendar integrations via `/api/integrations`
   - Users haven't created EHR systems via `/api/integrations-ehr/ehr`
   - Users haven't created HL7/FHIR connectors

2. **Integrations Not Linked**
   - EHR systems may exist but aren't linked to HL7/FHIR connectors
   - Calendar integrations may exist but aren't marked as `is_active = true`

3. **Organization Isolation**
   - Integrations may be created with `organization_id = NULL`
   - Users can't see integrations from other organizations

## How to Check Status

### Option 1: Run Test Script (Requires Database Access)
```bash
cd backend
node scripts/test-integrations.js
```

### Option 2: Check via API Endpoints

**Check Calendar Integrations:**
```bash
GET /api/integrations
# Look for integrations with type='scheduling' or provider='google_calendar'
```

**Check EHR Systems:**
```bash
GET /api/integrations-ehr/ehr
# Check if any EHR systems exist and if they're linked to connectors
```

**Check HL7 Connectors:**
```bash
GET /api/integrations-ehr/hl7
# Check if HL7 connectors are configured
```

**Check FHIR Connectors:**
```bash
GET /api/integrations-ehr/fhir
# Check if FHIR connectors are configured
```

## What Needs to Be Configured

### 1. Calendar Integration (Google Calendar)

**Backend Configuration (via `.env`):**
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_ACCESS_TOKEN`
- `GOOGLE_CALENDAR_REFRESH_TOKEN`
- `GOOGLE_CALENDAR_ID`

**OR via API:**
```bash
POST /api/integrations
{
  "name": "Google Calendar",
  "type": "scheduling",
  "provider": "google_calendar",
  "credentials": {
    "client_id": "...",
    "access_token": "...",
    "refresh_token": "...",
    "calendar_id": "primary"
  },
  "is_active": true
}
```

### 2. EHR Integration (HL7 or FHIR)

**Step 1: Create HL7 or FHIR Connector**
```bash
# For HL7:
POST /api/integrations-ehr/hl7
{
  "name": "My HL7 Connector",
  "hl7_version": "2.8",
  "endpoint_url": "http://ehr-system.com/hl7",
  "authentication_type": "basic",
  "credentials": { "username": "...", "password": "..." }
}

# For FHIR:
POST /api/integrations-ehr/fhir
{
  "name": "My FHIR Connector",
  "fhir_version": "R4",
  "base_url": "https://fhir-server.com/fhir",
  "authentication_type": "oauth2",
  "credentials": { "client_id": "...", "client_secret": "..." }
}
```

**Step 2: Create EHR System**
```bash
POST /api/integrations-ehr/ehr
{
  "name": "My EHR System",
  "vendor": "Epic",
  "ehr_type": "fhir",
  "connection_type": "fhir",
  "connector_id": 1,  # ID from step 1
  "connector_type": "fhir",
  "sync_enabled": true,
  "sync_frequency": "real-time"
}
```

**Step 3: Link Connector to EHR System (if not done in step 2)**
```bash
PUT /api/integrations-ehr/ehr/:id
{
  "connector_id": 1,
  "connector_type": "fhir",
  "sync_enabled": true,
  "is_active": true
}
```

### 3. CRM Integration

```bash
POST /api/integrations
{
  "name": "Salesforce CRM",
  "type": "crm",
  "provider": "salesforce",
  "credentials": {
    "api_key": "...",
    "api_secret": "...",
    "instance_url": "..."
  },
  "is_active": true
}
```

## Frontend Access Points

1. **EHR Configuration:**
   - Navigate to: `/architecture/ehr`
   - Create EHR systems and link to connectors
   - Test connections

2. **HL7 Configuration:**
   - Navigate to: `/architecture/hl7`
   - Create HL7 connectors

3. **FHIR Configuration:**
   - Navigate to: `/architecture/fhir`
   - Create FHIR connectors

4. **General Integrations:**
   - Navigate to: `/integrations` (webhooks page exists)
   - **NOTE**: There's no dedicated UI for creating calendar/CRM integrations yet
   - Must use API directly or add to frontend

## Testing Integration Activity

### Test Calendar Sync
```bash
# Create an appointment and check if it syncs
POST /api/appointments
{
  "patient_name": "Test Patient",
  "appointment_date": "2025-01-15T10:00:00Z",
  "appointment_type": "Consultation"
}
# Check logs for "Appointment X synced to scheduling system"
```

### Test EHR Connection
```bash
GET /api/integrations-ehr/ehr/:id/test-connection
# Should return success: true if connector is properly configured
```

### Test EHR Sync
```bash
POST /api/integrations-ehr/ehr/:id/sync/patient
{
  "name": "Test Patient",
  "dob": "1990-01-01",
  "phone": "+1234567890"
}
```

## Common Issues & Fixes

### Issue 1: "No active calendar integrations" ✅ **UI FIX AVAILABLE**
**Symptoms**: No calendar integrations appear, or all are inactive
**Fix Options**:
1. **Via UI** (Recommended): 
   - Navigate to `/dashboard/integrations`
   - Click "Add Integration" button
   - Select calendar provider (Google Calendar, GoHighLevel, etc.)
   - Enter credentials and create
2. **Via API**: 
   ```bash
   POST /api/integrations
   {
     "name": "Google Calendar",
     "type": "scheduling",
     "provider": "google_calendar",
     "credentials": { ... },
     "is_active": true
   }
   ```
3. **Via Script**: Run `node scripts/setup-google-calendar.js` on server

**UI Help**: The integrations page now shows a helpful message when no integrations are found, with a direct "Create Integration Now" button.

### Issue 2: "EHR system not connected to a connector" ✅ **UI FIX AVAILABLE**
**Symptoms**: EHR system exists but shows "No connector linked" or sync fails
**Fix Options**:
1. **Via UI** (Recommended):
   - Navigate to `/architecture/ehr`
   - Find the EHR system that needs a connector
   - Click "Link Connector" button
   - Select HL7 or FHIR connector
   - Save the link
2. **Via API**:
   ```bash
   PUT /api/integrations-ehr/ehr/:id
   {
     "connector_id": 1,
     "connector_type": "fhir",
     "sync_enabled": true,
     "is_active": true
   }
   ```
3. **Create Connector First** (if none exist):
   - Navigate to `/architecture/hl7` or `/architecture/fhir`
   - Create a new connector
   - Then link it to the EHR system

**UI Help**: The EHR page shows connector status and provides "Link Connector" buttons for systems without connectors.

### Issue 3: "Integration exists but is_active = false" ✅ **UI FIX AVAILABLE**
**Symptoms**: Integration appears in list but shows "Inactive" status, sync doesn't work
**Fix Options**:
1. **Via UI** (Recommended):
   - Navigate to `/dashboard/integrations`
   - Find the inactive integration
   - Click "Enable" button
   - Integration will become active immediately
2. **Via API**:
   ```bash
   PUT /api/integrations/:id
   {
     "is_active": true
   }
   ```

**UI Help**: 
- Inactive integrations show a yellow warning banner with quick "Enable" buttons
- Each integration card has an "Enable/Disable" toggle button
- Status is clearly visible with color-coded badges

### Issue 4: "Integration not visible to user" ✅ **DIAGNOSTIC AVAILABLE**
**Symptoms**: Integration exists in database but doesn't appear in user's list
**Possible Causes**:
1. **Organization Mismatch**: User's `organization_id` doesn't match integration's `organization_id`
2. **User has no organization**: User's `organization_id` is NULL
3. **Integration belongs to different organization**: Integration was created for another org

**Fix Options**:
1. **Check User's Organization**:
   ```sql
   SELECT id, email, organization_id FROM users WHERE email = 'user@example.com';
   ```
2. **Check Integration's Organization**:
   ```sql
   SELECT id, name, organization_id FROM integrations WHERE id = X;
   ```
3. **Assign User to Correct Organization**:
   - Admin can assign user via Admin Dashboard → User Management
   - Or update directly in database:
     ```sql
     UPDATE users SET organization_id = X WHERE id = Y;
     ```
4. **Move Integration to User's Organization**:
   ```sql
   UPDATE integrations SET organization_id = X WHERE id = Y;
   ```

**UI Help**: 
- Error messages now indicate if integration belongs to different organization
- Admin users can see all integrations across organizations
- Regular users only see integrations from their organization

**Prevention**: Always create integrations while logged in as the user who needs them, or assign integrations to the correct organization during creation.

## Recommendations

1. ✅ **Add Frontend UI for Calendar Integration** - **COMPLETED**
   - Created `/dashboard/integrations` page with Calendar tab
   - Users can configure Google Calendar, GoHighLevel, Calendly, Zocdoc
   - Full create/edit/disable functionality

2. ✅ **Add Frontend UI for CRM Integration** - **COMPLETED**
   - Created `/dashboard/integrations` page with CRM tab
   - Users can configure Salesforce, HubSpot, Zendesk, Freshdesk
   - Full create/edit/disable functionality

3. ✅ **Add Integration Status Dashboard** - **COMPLETED**
   - Status dashboard shows all integrations in one place
   - Displays active/inactive status with visual indicators
   - Shows last sync time with relative formatting (e.g., "2h ago", "Just now")
   - Quick enable/disable toggle buttons
   - Summary cards showing: Total, Active count, Last sync

4. ✅ **Add Integration Test Buttons** - **COMPLETED**
   - "Test" button for each integration
   - Tests calendar connection (Google Calendar API)
   - Tests CRM connection (provider-specific APIs)
   - Shows test results with success/error messages
   - Displays connection details (e.g., number of calendars found)

5. ✅ **Improve Error Messages** - **COMPLETED**
   - Detailed error messages when sync fails
   - Provider-specific troubleshooting hints:
     - Google Calendar: "Check if access token is valid or needs refresh"
     - CRM: "Verify API credentials and permissions"
   - Visual error indicators with AlertCircle icons
   - Error messages auto-dismiss after 5 seconds
   - Test results show specific failure reasons

## Next Steps

1. ✅ Check database for existing integrations - **COMPLETED**
2. ✅ Verify routes are accessible - **COMPLETED**
3. ✅ Test integration endpoints - **COMPLETED**
4. ✅ Create frontend UI for calendar/CRM configuration - **COMPLETED**
   - Frontend page created at `/dashboard/integrations`
   - Supports Calendar and CRM integrations
   - Enable/disable functionality added
5. ✅ Ensure integrations are properly linked and active - **COMPLETED**
   - Google Calendar integration created and active (ID: 1, Org: 1)
   - Credentials configured with Access Token and Refresh Token
6. ⚠️ Test end-to-end: appointment → calendar sync - **READY TO TEST**
   - Integration is active and ready
   - Create an appointment to verify automatic sync to Google Calendar

## ✅ Current Production Status

**Google Calendar Integration:**
- ✅ Created and active (ID: 1)
- ✅ Organization: Sheharyar (ID: 1)
- ✅ Credentials: Access Token ✅, Refresh Token ✅
- ✅ Frontend UI: Available at `/dashboard/integrations`

**Frontend:**
- ✅ New integrations page deployed
- ✅ Calendar and CRM tabs available
- ✅ Create/edit/disable integrations via UI

**Backend:**
- ✅ PUT endpoint for integration updates
- ✅ Automatic appointment sync enabled
- ✅ All routes accessible

**To Test End-to-End:**
1. Navigate to appointments page or use API
2. Create a new appointment
3. Check Google Calendar - appointment should appear automatically
4. Verify sync in backend logs: "Appointment X synced to scheduling system"

