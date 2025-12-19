# Front Desk Agent Testing Guide

This guide provides instructions for testing the Front Desk Agent features that have been implemented.

## Overview

The Front Desk Agent implementation includes:
- Appointment booking and rescheduling APIs
- SMS and email reminder functionality
- Dynamic greeting based on time and business hours
- FAQ/knowledge base service for hours, directions, services
- Insurance eligibility verification (placeholder)

## Prerequisites

1. Backend server running on port 5000
2. Frontend server running on port 3000 (optional, for UI testing)
3. Valid authentication token (login via `/api/auth/login`)
4. Database with FAQ table created (run `milestone-faq-schema.sql`)

## Testing Appointment Booking

### 1. Create Appointment (POST)

**Endpoint:** `POST /api/appointments`

**Headers:**
```
Authorization: Bearer <your_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "conversation_id": 1,
  "patient_name": "John Doe",
  "patient_phone": "+1234567890",
  "patient_email": "john.doe@example.com",
  "appointment_date": "2025-01-20T10:00:00Z",
  "appointment_type": "General Checkup",
  "notes": "Patient prefers morning appointments"
}
```

**Expected Response:** 201 Created
```json
{
  "appointment": {
    "id": 1,
    "conversation_id": 1,
    "patient_name": "John Doe",
    "patient_phone": "+1234567890",
    "patient_email": "john.doe@example.com",
    "appointment_date": "2025-01-20T10:00:00Z",
    "appointment_type": "General Checkup",
    "status": "scheduled",
    "notes": "Patient prefers morning appointments",
    "created_at": "2025-01-18T12:00:00Z",
    "updated_at": "2025-01-18T12:00:00Z"
  }
}
```

### 2. Get All Appointments (GET)

**Endpoint:** `GET /api/appointments`

**Query Parameters:**
- `start_date` (optional): Filter appointments from this date
- `end_date` (optional): Filter appointments to this date
- `status` (optional): Filter by status (scheduled, cancelled, completed)
- `patient_phone` (optional): Filter by patient phone
- `patient_email` (optional): Filter by patient email

**Example:**
```
GET /api/appointments?start_date=2025-01-01&status=scheduled
```

### 3. Get Single Appointment (GET)

**Endpoint:** `GET /api/appointments/:id`

### 4. Update/Reschedule Appointment (PUT)

**Endpoint:** `PUT /api/appointments/:id`

**Request Body:**
```json
{
  "appointment_date": "2025-01-21T14:00:00Z",
  "appointment_type": "Follow-up",
  "notes": "Rescheduled from original appointment"
}
```

### 5. Cancel Appointment (PATCH)

**Endpoint:** `PATCH /api/appointments/:id/cancel`

**Request Body:**
```json
{
  "cancellation_reason": "Patient requested cancellation"
}
```

## Testing Reminder Service

### Send Reminder (POST)

**Endpoint:** `POST /api/appointments/:id/send-reminder`

**Request Body:**
```json
{
  "method": "both"
}
```

**Valid methods:** `sms`, `email`, or `both`

**Note:** 
- SMS reminders require Twilio credentials in `.env`:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER` (optional, will use organization's phone number)
  
- Email reminders require SMTP credentials in `.env`:
  - `SMTP_HOST` (default: smtp.gmail.com)
  - `SMTP_PORT` (default: 587)
  - `SMTP_SECURE` (true/false, default: false)
  - `SMTP_USER`
  - `SMTP_PASS`

**Expected Response:**
```json
{
  "message": "Reminders sent successfully",
  "results": [
    {
      "success": true,
      "method": "sms",
      "message_sid": "SM1234567890abcdef",
      "status": "queued"
    },
    {
      "success": true,
      "method": "email",
      "message_id": "<message-id>",
      "response": "250 2.0.0 OK"
    }
  ]
}
```

## Testing Dynamic Greeting

The dynamic greeting service is automatically integrated into the AI service. To test:

1. **Via Web Chat:**
   - Navigate to `http://localhost:3000/webchat`
   - Select a Front Desk agent
   - Start a conversation
   - The greeting should be time-appropriate (Good morning, Good afternoon, Good evening)

2. **Via API (Conversations):**
   - Create a new conversation via `POST /api/conversations`
   - The greeting in the response should reflect the current time

3. **Business Hours:**
   - Configure business hours in the `ai_agents` table (`business_hours` JSONB column)
   - The greeting will indicate if the practice is currently within business hours

**Example Business Hours JSON:**
```json
{
  "monday": {
    "open_time": "09:00",
    "close_time": "17:00"
  },
  "tuesday": {
    "open_time": "09:00",
    "close_time": "17:00"
  },
  "wednesday": {
    "open_time": "09:00",
    "close_time": "17:00"
  },
  "thursday": {
    "open_time": "09:00",
    "close_time": "17:00"
  },
  "friday": {
    "open_time": "09:00",
    "close_time": "17:00"
  },
  "saturday": {
    "open": false
  },
  "sunday": {
    "open": false
  },
  "timezone": "America/New_York"
}
```

## Testing FAQ Service

### Setup FAQ Knowledge Base

First, create the FAQ table:
```sql
-- Run milestone-faq-schema.sql or manually create the table
```

### Add FAQ Entries (via SQL or API)

**SQL Example:**
```sql
INSERT INTO faq_knowledge_base (organization_id, question, answer, category, priority)
VALUES 
  (1, 'What are your business hours?', 'We are open Monday-Friday 9am-5pm, closed weekends.', 'hours', 10),
  (1, 'Where are you located?', 'We are located at 123 Main St, City, State 12345.', 'directions', 10),
  (1, 'What services do you offer?', 'We offer general checkups, consultations, and preventive care.', 'services', 10);
```

### Testing FAQ in Conversations

The FAQ service is automatically integrated into the Front Desk agent's system prompt. When a patient asks about:
- Business hours
- Directions/location
- Services offered

The AI will use the FAQ knowledge base to provide accurate answers.

## Testing Insurance Eligibility

**Endpoint:** (Not yet exposed as API route - placeholder service exists)

The insurance eligibility service is a placeholder. To integrate:
1. Connect to insurance provider APIs
2. Create API route: `POST /api/insurance/verify`
3. Update service with actual API calls

**Current Placeholder Response:**
```json
{
  "eligible": true,
  "status": "active",
  "effective_date": "2024-01-01",
  "termination_date": "2026-01-01",
  "coverage_type": "Primary",
  "copay_amount": "$25.00",
  "deductible_met": false,
  "message": "Eligibility verification is in placeholder mode.",
  "is_placeholder": true
}
```

## Testing with Postman

### Postman Collection Example

1. **Create Appointment:**
   ```
   POST http://localhost:5000/api/appointments
   Headers: Authorization: Bearer <token>
   Body: (JSON as shown above)
   ```

2. **Get Appointments:**
   ```
   GET http://localhost:5000/api/appointments?status=scheduled
   Headers: Authorization: Bearer <token>
   ```

3. **Update Appointment:**
   ```
   PUT http://localhost:5000/api/appointments/1
   Headers: Authorization: Bearer <token>
   Body: (JSON with updated fields)
   ```

4. **Send Reminder:**
   ```
   POST http://localhost:5000/api/appointments/1/send-reminder
   Headers: Authorization: Bearer <token>
   Body: { "method": "both" }
   ```

5. **Cancel Appointment:**
   ```
   PATCH http://localhost:5000/api/appointments/1/cancel
   Headers: Authorization: Bearer <token>
   Body: { "cancellation_reason": "Patient request" }
   ```

## Testing via UI

### Web Chat Interface

1. Navigate to `http://localhost:3000/webchat`
2. Select "Front Desk" agent
3. Start a conversation
4. Try asking:
   - "What are your business hours?"
   - "Where are you located?"
   - "I'd like to schedule an appointment"
   - "What services do you offer?"

The AI should respond using the FAQ knowledge base and dynamic greetings.

## Environment Variables

Add to your `.env` file for full functionality:

```env
# Twilio (for SMS reminders)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# SMTP (for email reminders)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

## Notes

- Appointment booking/rescheduling APIs are fully functional
- SMS/Email reminders work if credentials are configured, otherwise they log attempts
- Dynamic greetings are automatically integrated into conversations
- FAQ service requires the `faq_knowledge_base` table to be created
- Insurance eligibility is a placeholder and needs actual API integration
- All endpoints require authentication
- Appointments are filtered by organization (users can only see their organization's appointments)

