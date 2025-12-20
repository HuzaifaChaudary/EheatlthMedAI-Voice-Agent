# Integration Services Testing Guide

This guide explains how to test and use the fully implemented scheduling, billing, and CRM integrations.

## Quick Start

### Run Automated Tests

```bash
cd backend
node scripts/test-integrations.js
```

This will test all integration endpoints and show the available providers.

## Available Providers

### Scheduling Integrations
- **Google Calendar** - OAuth2 integration for calendar sync
- **Zocdoc** - Practice management scheduling
- **Calendly** - Appointment booking platform
- **EHR** - Native HL7/FHIR scheduling sync

### Billing Integrations
- **Kareo** - Medical billing platform
- **AdvancedMD** - Practice management & billing
- **DrChrono** - EHR with billing
- **AthenaHealth** - Healthcare network billing

### CRM Integrations
- **Salesforce** - Enterprise CRM
- **HubSpot** - Marketing & sales CRM
- **Zendesk** - Customer support ticketing
- **Freshdesk** - Help desk software

## API Endpoints

### Base URL
```
http://localhost:5000/api/integrations/test
```

### Authentication
All endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## Integration Management

### Get Integration Status
```bash
GET /api/integrations/test/status
```

Response:
```json
{
  "message": "Integration status",
  "active_integrations": 3,
  "integrations": [...],
  "available_providers": {
    "scheduling": ["google_calendar", "zocdoc", "calendly", "ehr"],
    "billing": ["kareo", "advancedmd", "drchrono", "athenahealth"],
    "crm": ["salesforce", "hubspot", "zendesk", "freshdesk"]
  }
}
```

### Get Credentials Format
```bash
GET /api/integrations/test/credentials-format
```

Returns the required credential fields for each provider.

### Create Integration
```bash
POST /api/integrations/test/create-integration
Content-Type: application/json

{
  "type": "crm",
  "provider": "hubspot",
  "name": "My HubSpot Integration",
  "credentials": {
    "access_token": "your_hubspot_token"
  }
}
```

### List All Integrations
```bash
GET /api/integrations/test/list
```

---

## Scheduling Integration Tests

### Test Google Calendar Connection
```bash
POST /api/integrations/test/scheduling/google-calendar
Content-Type: application/json

{
  "access_token": "your_google_oauth_token",
  "calendar_id": "primary"
}
```

### Sync Appointment to Scheduling System
```bash
POST /api/integrations/test/scheduling/sync-appointment
Content-Type: application/json

{
  "appointment_id": 1,
  "integration_id": 2
}
```

### Get Available Slots
```bash
POST /api/integrations/test/scheduling/available-slots
Content-Type: application/json

{
  "integration_id": 2,
  "start_date": "2025-01-01T00:00:00Z",
  "end_date": "2025-01-07T23:59:59Z"
}
```

---

## Billing Integration Tests

### Test Billing Connection
```bash
POST /api/integrations/test/billing/connection
Content-Type: application/json

{
  "provider": "drchrono",
  "credentials": {
    "access_token": "your_drchrono_token"
  }
}
```

### Create Charge
```bash
POST /api/integrations/test/billing/create-charge
Content-Type: application/json

{
  "integration_id": 3,
  "charge_data": {
    "patient_id": "P12345",
    "patient_name": "John Doe",
    "amount": 150.00,
    "description": "Office Visit",
    "procedure_code": "99213",
    "date_of_service": "2025-01-15"
  }
}
```

### Get Patient Balance
```bash
POST /api/integrations/test/billing/patient-balance
Content-Type: application/json

{
  "integration_id": 3,
  "patient_id": "P12345"
}
```

---

## CRM Integration Tests

### Test CRM Connection
```bash
POST /api/integrations/test/crm/connection
Content-Type: application/json

{
  "provider": "zendesk",
  "credentials": {
    "subdomain": "yourcompany",
    "email": "agent@company.com",
    "api_token": "your_zendesk_token"
  }
}
```

### Create Ticket
```bash
POST /api/integrations/test/crm/create-ticket
Content-Type: application/json

{
  "integration_id": 1,
  "ticket_data": {
    "subject": "Patient Support Request",
    "description": "Patient needs help with billing question",
    "priority": "medium",
    "requester_name": "John Doe",
    "requester_email": "john@example.com"
  }
}
```

### Get Ticket Status
```bash
POST /api/integrations/test/crm/ticket-status
Content-Type: application/json

{
  "integration_id": 1,
  "ticket_id": "12345"
}
```

---

## Credentials Reference

### Google Calendar
```json
{
  "access_token": "OAuth2 access token from Google",
  "refresh_token": "OAuth2 refresh token (optional)",
  "calendar_id": "primary or specific calendar ID"
}
```

### Zocdoc
```json
{
  "api_key": "Zocdoc API key",
  "practice_id": "Your practice ID"
}
```

### Calendly
```json
{
  "api_key": "Calendly personal access token",
  "user_uri": "https://api.calendly.com/users/USERID",
  "event_type_uri": "https://api.calendly.com/event_types/TYPEID"
}
```

### Kareo
```json
{
  "api_key": "Kareo API username",
  "api_secret": "Kareo API password",
  "practice_id": "Practice ID",
  "customer_key": "Customer key"
}
```

### AdvancedMD
```json
{
  "api_key": "AdvancedMD API key",
  "office_key": "Office key",
  "practice_id": "Practice ID"
}
```

### DrChrono
```json
{
  "access_token": "OAuth2 access token",
  "client_id": "App client ID",
  "client_secret": "App client secret"
}
```

### AthenaHealth
```json
{
  "api_key": "API key (client_id)",
  "api_secret": "API secret (client_secret)",
  "practice_id": "Practice ID",
  "version": "v1 or preview1"
}
```

### Salesforce
```json
{
  "access_token": "OAuth2 access token",
  "instance_url": "https://yourorg.salesforce.com",
  "refresh_token": "Refresh token (optional)",
  "client_id": "Connected app client ID",
  "client_secret": "Connected app secret"
}
```

### HubSpot
```json
{
  "access_token": "Private app access token"
}
```

### Zendesk
```json
{
  "subdomain": "yourcompany",
  "email": "agent@company.com",
  "api_token": "API token"
}
```

### Freshdesk
```json
{
  "domain": "yourcompany",
  "api_key": "API key"
}
```

---

## Implementation Details

### Scheduling Service Methods
- `syncAppointment(appointmentId, integrationId, organizationId)` - Sync single appointment
- `syncAppointments(integrationId, organizationId, dateRange)` - Bulk sync
- `getAvailableSlots(integrationId, organizationId, dateRange)` - Get free/busy slots
- `cancelAppointment(appointmentId, integrationId, organizationId, reason)` - Cancel appointment

### Billing Service Methods
- `syncBillingData(billingData, integrationId, organizationId)` - Sync billing data
- `createCharge(chargeData, integrationId, organizationId)` - Create charge/claim
- `updatePayment(paymentData, integrationId, organizationId)` - Post payment
- `getPatientBalance(patientId, integrationId, organizationId)` - Get balance
- `getPatientClaims(patientId, integrationId, organizationId, dateRange)` - Get claims

### CRM Service Methods
- `createTicket(ticketData, integrationId, organizationId)` - Create support ticket
- `updateTicket(ticketId, updates, integrationId, organizationId)` - Update ticket
- `createTicketFromConversation(conversationId, ticketData, integrationId, organizationId)` - Create from chat
- `getTicketStatus(ticketId, integrationId, organizationId)` - Get ticket status

---

## Troubleshooting

### Connection Test Returns 401
- The API credentials are invalid or expired
- For OAuth-based services, the access token may need to be refreshed
- Verify the credentials format matches the expected schema

### Integration Not Found
- Ensure the integration ID exists and is active
- Check that the integration type matches (scheduling, billing, crm)
- Verify the organization ID matches

### Sync Fails
- Check that the appointment/patient exists in the database
- Verify the external system API is accessible
- Review backend logs for detailed error messages

---

## Files Modified

### Services (Full API Implementation)
- `backend/services/appointmentSyncService.js` - Scheduling integrations
- `backend/services/billingSyncService.js` - Billing integrations  
- `backend/services/crmService.js` - CRM integrations

### Routes
- `backend/routes/integrations/test.js` - Test endpoints
- `backend/routes/integrations.js` - Main integration routes

### Test Script
- `backend/scripts/test-integrations.js` - Automated test suite

