# Integration Layer Testing Guide

This guide explains how to test the Integration Layer features in the UI.

## Prerequisites

1. **Login Credentials:**
   - Name: huzaifa iftikhar
   - Email: chhuzaifaiftikhar@gmail.com
   - Password: mypassword123

2. **Server Status:**
   - Backend: http://localhost:5000
   - Frontend: http://localhost:3000

## Step 1: Login to the Application

1. Navigate to http://localhost:3000/login
2. Enter your credentials:
   - Email: `chhuzaifaiftikhar@gmail.com`
   - Password: `mypassword123`
3. Click "Sign In"

## Step 2: Navigate to Integration Layer

After logging in, you have several options:

### Option A: Via Architecture Page
1. Go to http://localhost:3000/architecture
2. Scroll to the "Integration Layer" section
3. Click on any of these links:
   - **Webhooks** → `/integrations` (Fully implemented)
   - **EHR Systems** → `/architecture/ehr` (Fully implemented)
   - **HL7 Connectors** → `/architecture/hl7` (API only - can be managed via API/Postman)
   - **FHIR Connectors** → `/architecture/fhir` (API only - can be managed via API/Postman)

### Option B: Direct URL Access
- Webhooks: http://localhost:3000/integrations
- EHR Systems: http://localhost:3000/architecture/ehr

## Step 3: Testing Webhooks (Already Available in UI)

The webhook functionality is fully implemented in the UI at `/integrations`.

### 3.1 View Webhooks
1. Navigate to http://localhost:3000/integrations
2. You should see a list of existing webhooks (if any)

### 3.2 Create a Test Webhook
1. Click the "Create Webhook" button
2. Fill in the form:
   - **Name**: `Test Webhook`
   - **URL**: `https://webhook.site/your-unique-url` (or use any test webhook service)
   - **Events**: Select one or more events:
     - `conversation.started`
     - `conversation.ended`
     - `call.answered`
     - `call.ended`
     - `agent.response`
     - `error.occurred`
     - `compliance.violation`
     - `recording.completed`
3. Click "Create"
4. **Important**: Save the `secret_key` displayed - you'll need it to verify webhook signatures

### 3.3 View Webhook Events
1. On the webhooks page, click on a webhook to view its events
2. You'll see a list of all webhook delivery attempts with:
   - Event type
   - Status (pending, completed, failed)
   - Response code
   - Timestamp

### 3.4 Test Webhook Triggering
To test if webhooks are triggered:
1. Create a conversation via the web chat at http://localhost:3000/webchat
2. Send a message in the conversation
3. Go back to `/integrations` and check if webhook events appear
4. Check your webhook URL (e.g., webhook.site) to see if the event was delivered

## Step 4: Testing EHR Systems (UI Available)

The EHR Systems UI is fully implemented at `/architecture/ehr`. You can manage EHR integrations visually.

### 4.1 View EHR Systems
1. Navigate to http://localhost:3000/architecture/ehr
2. You should see a list of existing EHR systems (if any)

### 4.2 Create an EHR System
1. Click the "Add EHR System" button
2. Fill in the form:
   - **System Name**: e.g., "Main Hospital EHR"
   - **Vendor**: Select from dropdown (Epic, Cerner, Allscripts, etc.)
   - **Connection Type**: Choose FHIR, HL7, or Custom API
   - **Connector**: Link to an existing HL7 or FHIR connector (optional)
   - **Enable Sync**: Toggle automatic synchronization
   - **Sync Frequency**: If sync enabled, choose real-time, hourly, daily, or weekly
3. Click "Create EHR System"

### 4.3 Test EHR Connection
1. On an EHR system card, click "Test Connection"
2. This will verify the connection to the EHR system
3. Check the status badge (Connected, Pending, or Inactive)

### 4.4 Manual Sync
1. Click "Sync Now" on an EHR system card
2. This triggers an immediate data synchronization

## Step 5: Testing HL7/FHIR Connectors (Via API)

Since HL7 and FHIR connectors are typically configured once by technical staff, they can be managed via API calls or Postman. UI pages are optional and can be added later if needed.

### 5.1 Test HL7 Connectors

**Create HL7 Connector:**
```bash
curl -X POST http://localhost:5000/api/integrations-ehr/hl7 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Test HL7 Connector",
    "hl7_version": "2.8",
    "message_types": ["ADT", "ORU"],
    "endpoint_url": "https://test-hl7-endpoint.com/receive",
    "authentication_type": "basic",
    "credentials": {
      "username": "test_user",
      "password": "test_password"
    }
  }'
```

**List HL7 Connectors:**
```bash
curl http://localhost:5000/api/integrations-ehr/hl7 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Generate and Send HL7 ADT Message:**
```bash
curl -X POST http://localhost:5000/api/integrations-ehr/hl7/1/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "message_data": {
      "messageType": "ADT^A04",
      "sendingApplication": "EHEALTH_MED_AI",
      "sendingFacility": "TEST_FACILITY",
      "receivingApplication": "EHR_SYSTEM",
      "receivingFacility": "EHR_SYSTEM",
      "segments": []
    }
  }'
```

### 5.2 Test FHIR Connectors

**Create FHIR Connector:**
```bash
curl -X POST http://localhost:5000/api/integrations-ehr/fhir \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Test FHIR Connector",
    "fhir_version": "R4",
    "base_url": "https://fhir-test-server.com/fhir",
    "resource_types": ["Patient", "Appointment", "Encounter"],
    "authentication_type": "oauth2",
    "credentials": {
      "access_token": "your_oauth_token"
    }
  }'
```

**Create FHIR Patient Resource:**
```bash
curl -X POST http://localhost:5000/api/integrations-ehr/fhir/1/resources/Patient \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "resourceType": "Patient",
    "name": [{
      "use": "official",
      "family": "Doe",
      "given": ["John"]
    }],
    "gender": "male",
    "birthDate": "1990-01-01"
  }'
```

### 5.3 Test EHR Synchronization (Via API)

**Sync Patient to EHR:**
```bash
curl -X POST http://localhost:5000/api/integrations-ehr/ehr/1/sync/patient \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "patientId": "P12345",
    "name": {
      "first": "John",
      "last": "Doe"
    },
    "dob": "1990-01-01",
    "gender": "male",
    "phone": "+1234567890",
    "email": "john.doe@example.com"
  }'
```

### 5.4 Test Appointment Synchronization

**Sync Appointment:**
```bash
curl -X POST http://localhost:5000/api/integrations/appointments/1/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "integration_id": 1
  }'
```

### 5.5 Test Billing Synchronization

**Create Charge:**
```bash
curl -X POST http://localhost:5000/api/integrations/billing/charge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "integration_id": 1,
    "charge_data": {
      "patient_id": "P12345",
      "patient_name": "John Doe",
      "amount": 150.00,
      "description": "Office Visit",
      "date_of_service": "2024-01-15",
      "procedure_code": "99213"
    }
  }'
```

### 5.6 Test CRM Ticket Creation

**Create Ticket from Conversation:**
```bash
curl -X POST http://localhost:5000/api/integrations/crm/tickets/from-conversation/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "integration_id": 1,
    "ticket_data": {
      "subject": "Billing Inquiry",
      "description": "Patient needs help with billing question",
      "priority": "high"
    }
  }'
```

## Step 6: Getting Your JWT Token

To get your JWT token for API testing:

1. **Via Browser DevTools:**
   - Login to the application
   - Open DevTools (F12)
   - Go to Application/Storage → Local Storage
   - Look for the token key (usually `token` or `authToken`)

2. **Via Login API:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "chhuzaifaiftikhar@gmail.com",
    "password": "mypassword123"
  }'
```

The response will include a `token` field. Use this token in the `Authorization: Bearer` header for API requests.

## Step 7: Recommended Testing Flow

1. **Start with Webhooks (Full UI Available):**
   - Test webhook creation
   - Test webhook event triggering via conversations
   - Verify webhook delivery and retry logic

2. **Test Integration APIs (Via Postman/curl):**
   - Create HL7 connector
   - Create FHIR connector
   - Create EHR system
   - Test data synchronization

3. **Verify Webhook Integration:**
   - Create a webhook that listens to `conversation.created`
   - Create a conversation via web chat
   - Verify the webhook receives the event

4. **Test End-to-End Flow:**
   - Create a conversation
   - Create an appointment
   - Sync appointment to EHR (via API)
   - Verify webhook events are triggered

## Step 8: Troubleshooting

### Webhooks Not Triggering?
- Check if webhook is active (`is_active: true`)
- Verify the webhook URL is accessible
- Check webhook events table for error messages
- Verify the event type is subscribed

### API Returns 403 Forbidden?
- Ensure you're using the JWT token in the Authorization header
- Verify your user has admin role
- Check if the token has expired (login again)

### API Returns 404?
- Verify the resource ID exists
- Check if you're using the correct endpoint path
- Ensure the backend server is running on port 5000

### Integration Not Working?
- Check backend logs for errors
- Verify database connections
- Ensure all required environment variables are set
- Check if the integration is active in the database

## Summary

### Fully Implemented in UI:
- ✅ **Webhooks** (`/integrations`) - Complete webhook management with event tracking
- ✅ **EHR Systems** (`/architecture/ehr`) - Complete EHR system management with connection testing

### Available via API (UI Optional):
- **HL7 Connectors** - Can be managed via API/Postman (typically configured once by technical staff)
- **FHIR Connectors** - Can be managed via API/Postman (typically configured once by technical staff)

### Note:
HL7 and FHIR connector UI pages are optional since these are typically one-time configurations managed by technical staff. The API endpoints are fully functional for all integration needs.

