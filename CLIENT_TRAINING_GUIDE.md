# EHealth Med AI Platform - Client Training Guide

## ⚠️ Important Note About Email
**Email functionality is currently NOT working** because the `SENDGRID_API_KEY` is not configured. All email features (sending emails after calls, appointment reminders, receipts, etc.) will fail until SendGrid API key is added to the backend `.env` file.

---

## Getting Started - First Steps

### Step 1: Login
1. Go to: `https://huzaifaiftikhar.engineer/login`
2. Sign in with Google OAuth (or email/password if you have an account)
3. You'll be redirected to the Dashboard

### Step 2: Create Your Organization (Sub-Account)
1. Go to **Dashboard** → Click **Settings** (or go to `/dashboard/settings`)
2. Click on **"Organization"** tab
3. Fill in:
   - **Name**: Your organization name (e.g., "ABC Medical Clinic")
   - **Subdomain**: Optional (for white-label URLs)
   - **Domain**: Optional
   - **Contact Email**: Your email
   - **Contact Phone**: Your phone number
4. Click **"Create Organization"** or **"Save"**
5. ✅ Your organization (sub-account) is now created!

### Step 3: Add Phone Numbers
1. Go to **Telephony** page (from Dashboard menu)
2. Click **"Add Phone Number"**
3. Enter:
   - **Phone Number**: Your Twilio phone number (e.g., +17703434007)
   - **Provider**: Twilio
   - **Provider SID**: From Twilio dashboard
   - **Capabilities**: Voice, SMS
4. Click **"Save"**
5. ✅ Phone number is now linked to your organization

### Step 4: Create an AI Agent
1. Go to **Dashboard** → Click **"Create New Agent"** (or `/dashboard/agents/new`)
2. Fill in:
   - **Name**: Agent name (e.g., "Appointment Scheduler")
   - **Type**: Select type (e.g., "appointment_scheduling")
   - **Description**: What this agent does
   - **Phone Number**: Select the phone number you added in Step 3
   - **System Prompt**: Instructions for the AI (e.g., "You are a helpful medical appointment scheduler...")
   - **Greeting Message**: What the agent says when answering
3. Click **"Create Agent"**
4. ✅ Agent is now linked to your phone number and will handle calls automatically

---

## Dashboard Overview - One-Line Explanations

### Main Dashboard (`/dashboard`)
- **Active Calls**: Number of calls currently in progress
- **Active Agents**: Number of AI agents currently online and handling calls
- **Total Agents**: Total number of AI agents you've created
- **Incidents**: Security alerts from the last 24 hours
- **Call Volume Chart**: Graph showing call activity over the last 24 hours
- **Quick Actions**: Buttons to create new agents, view reports, or go to settings
- **Agents Grid**: Cards showing all your AI agents with their status (Active/Inactive)

### Quick Links on Dashboard:
- **System Architecture**: Technical documentation about system layers
- **Terminology & Glossary**: Definitions of medical and technical terms
- **Reference Standards**: HIPAA, HL7, FHIR, TCPA compliance references
- **Reading Guidance**: Role-specific documentation
- **Requirements**: RFC 2119 requirements documentation
- **Assumptions & Constraints**: Operational assumptions and constraints
- **SRS Documents**: Software Requirements Specification
- **Deliverables**: Track project deliverables
- **Change Control**: Version change log
- **Web Chat**: Interact with AI agents via web chat interface
- **Appointments**: Manage patient appointments
- **Billing**: Manage statements, payments, and receipts
- **Collections**: Manage payment plans, reminders, and compliance
- **Telephony**: Manage calls, SMS, and voicemail

---

## Feature Flow - How Everything Works

### 1. Organization (Sub-Account) Management
**Location**: Dashboard → Settings → Organization tab

**What it does**: Each organization is a separate sub-account (client). Each organization can have:
- Multiple phone numbers
- Multiple AI agents
- Multiple users
- Its own subscription tier and limits

**How to add**: Go to Settings → Organization → Fill form → Save

**Important**: Each client (organization) is completely isolated. Client A cannot see Client B's phone numbers, agents, or data. This is a multi-tenant system where each organization operates independently.

---

### 2. Phone Number Management (Multiple Phone Numbers Per Client)
**Location**: Telephony page (`/telephony`)

**What it does**: Add and manage phone numbers for your organization. **Each client (organization) can have MULTIPLE phone numbers**. Each phone number can be linked to one or more AI agents.

**How to add**: 
1. Go to Telephony page
2. Click "Add Phone Number"
3. Enter Twilio phone number and details:
   - Phone Number: Your Twilio number (e.g., +17703434007)
   - Provider: Twilio
   - Provider SID: From Twilio dashboard
   - Capabilities: Voice, SMS
4. Save

**Important Points**:
- ✅ **Each client can have MULTIPLE phone numbers** - not just one
- ✅ Phone numbers are linked to your organization (sub-account)
- ✅ Each client can choose their own phone numbers
- ✅ Client A's phone numbers are separate from Client B's phone numbers
- ✅ You can add as many phone numbers as your subscription allows

**Example Scenario**:
- **Client A (ABC Medical Clinic)**:
  - Phone Number 1: +17701234567 (for appointments)
  - Phone Number 2: +17701234568 (for billing inquiries)
  - Phone Number 3: +17701234569 (for emergency line)
  
- **Client B (XYZ Hospital)**:
  - Phone Number 1: +17709876543 (for main line)
  - Phone Number 2: +17709876544 (for specialist line)

Each client manages their own phone numbers independently.

---

### 3. AI Agent Management (Phone Number → Agent Linking)
**Location**: Dashboard → Agents (`/dashboard/agents`)

**What it does**: Create and configure AI voice agents that handle phone calls automatically. **Each phone number is linked to an agent for the sub-account (client)**.

**How to create**:
1. Click "Create New Agent" from Dashboard
2. Fill in agent details:
   - Name: Agent name (e.g., "Appointment Scheduler")
   - Type: Agent type (e.g., "appointment_scheduling")
   - Description: What this agent does
3. **Link to Phone Number**: Select which phone number this agent should handle
   - This is CRITICAL: Each phone number must be linked to an agent
   - When a call comes to that phone number, the linked agent automatically answers
4. Configure AI settings:
   - System Prompt: Instructions for the AI
   - Greeting Message: What agent says when answering
   - Voice Settings: Speed, pitch, language
5. Save

**Important Points**:
- ✅ **Each phone number is linked to an agent for the sub-account**
- ✅ When a call comes to a phone number, the system finds the agent linked to that number
- ✅ Each client can have multiple agents, each linked to different phone numbers
- ✅ One phone number can have one primary agent (or multiple agents with routing rules)
- ✅ Calls are automatically recorded (via Twilio) - no additional setup needed

**Example Scenario**:
- **Client A (ABC Medical Clinic)**:
  - Phone Number: +17701234567 → Linked to Agent: "Appointment Scheduler"
  - Phone Number: +17701234568 → Linked to Agent: "Billing Assistant"
  - Phone Number: +17701234569 → Linked to Agent: "Emergency Triage"
  
- **Client B (XYZ Hospital)**:
  - Phone Number: +17709876543 → Linked to Agent: "Main Receptionist"
  - Phone Number: +17709876544 → Linked to Agent: "Specialist Coordinator"

**Flow**: Phone Number → Agent → Call Handling

---

### 4. Complete Call Handling Flow (With Recording & Email)

**Complete Flow Diagram**:
```
1. Patient Calls Phone Number
   ↓
2. System Identifies Organization (Sub-Account)
   ↓
3. System Finds Agent Linked to That Phone Number
   ↓
4. Agent Answers Call (Auto-Answer)
   ↓
5. AI Conversation Begins (Agent talks to patient)
   ↓
6. Call Recording Starts (Automatic via Twilio)
   ↓
7. During Call:
   - Agent collects information
   - Agent can schedule appointments
   - Agent can answer questions
   ↓
8. Call Ends
   ↓
9. Call Recording Saved (Automatic)
   ↓
10. Call Log Created (with transcript, duration, etc.)
   ↓
11. Email Sent After Call (⚠️ NOT WORKING - SendGrid missing)
   ↓
12. Appointment Synced to Google Calendar (if created)
   ↓
13. Data Sent to EHR System (HL7/FHIR if configured)
```

**Detailed Step-by-Step**:

1. **Incoming Call**: 
   - Patient calls your Twilio phone number (e.g., +17701234567)
   - Twilio receives the call

2. **Organization Identification**:
   - System checks: Which organization owns this phone number?
   - Finds: "ABC Medical Clinic" (Client A's sub-account)

3. **Agent Lookup**:
   - System finds: Agent "Appointment Scheduler" is linked to +17701234567
   - Agent is activated for this call

4. **Auto-Answer**:
   - Agent automatically answers the call
   - No human intervention needed

5. **AI Conversation**:
   - Agent uses AI (OpenAI/Anthropic) to have natural conversation
   - Agent follows system prompt instructions
   - Agent can understand patient requests, schedule appointments, answer questions

6. **Auto-Recording** (✅ WORKING):
   - **Call recording starts automatically** when call begins
   - Recording is handled by Twilio (no additional setup needed)
   - Recording is saved to Twilio's servers
   - Recording URL is stored in call log

7. **During Call**:
   - Agent can:
     - Schedule appointments
     - Answer medical questions
     - Collect patient information
     - Transfer to human (if escalation rules configured)

8. **Call Ends**:
   - Patient hangs up or agent ends call
   - Call duration is calculated

9. **Recording Saved**:
   - Recording file is available in Twilio
   - Recording URL is saved in database
   - You can access recording from:
     - Dashboard → Reports → Call Logs
     - Telephony page → Call Logs section

10. **Call Log Created**:
    - Call details saved:
      - Caller phone number
      - Duration
      - Recording URL
      - Transcript (if available)
      - Agent used
      - Organization
      - Timestamp

11. **Email After Call** (⚠️ **NOT WORKING**):
    - System should send email summary after call ends
    - Email should include:
      - Call summary
      - Recording link
      - Transcript
      - Appointment details (if scheduled)
    - **Current Status**: Email sending fails because `SENDGRID_API_KEY` is not configured
    - **To Fix**: Add SendGrid API key to backend `.env` file

12. **Google Calendar Sync** (✅ WORKING):
    - If appointment was scheduled during call
    - Appointment is automatically synced to Google Calendar
    - Uses credentials from backend `.env`:
      - `GOOGLE_CALENDAR_CLIENT_ID`
      - `GOOGLE_CALENDAR_ACCESS_TOKEN`
      - `GOOGLE_CALENDAR_REFRESH_TOKEN`

13. **EHR Integration** (✅ WORKING):
    - If HL7/FHIR integration is configured
    - Patient data and appointment info sent to medical record system
    - Uses HL7 or FHIR format
    - Configured in backend integration settings

**Where to see calls**: 
- Dashboard → Reports (`/dashboard/reports`)
- Telephony page → Call Logs section
- Each call shows: Recording link, transcript, duration, agent used

---

### 5. Google Calendar Integration (✅ WORKING)
**Location**: Backend configuration (automatic sync)

**What it does**: Automatically sync appointments with Google Calendar. When an agent schedules an appointment during a call, it automatically appears in Google Calendar.

**How it works**:
1. **During Call**: Agent schedules appointment with patient
2. **Auto-Sync**: System automatically creates event in Google Calendar
3. **Calendar Updated**: Appointment appears in your Google Calendar
4. **View in App**: See all appointments in **Appointments** page (`/appointments`)

**Configuration** (Already set up in backend):
- `GOOGLE_CALENDAR_CLIENT_ID`: Google Calendar API client ID
- `GOOGLE_CALENDAR_ACCESS_TOKEN`: OAuth access token
- `GOOGLE_CALENDAR_REFRESH_TOKEN`: OAuth refresh token
- `GOOGLE_CALENDAR_ID`: Calendar ID (usually "primary")

**Flow**:
```
Call → Agent Schedules Appointment → Google Calendar Event Created → View in Calendar
```

**Alternative**: System also supports GoHighLevel calendar integration (if configured)

**Where to view**:
- **Appointments Page** (`/appointments`): See all appointments from calls
- **Google Calendar**: Appointments automatically appear in your calendar

---

### 6. HL7/FHIR Integration (Medical Record Systems) (✅ WORKING)
**Location**: Backend integration (automatic)

**What it does**: Integrate with medical record systems (EHR/EMR) using HL7 or FHIR standards. Patient data and appointment information from calls are automatically sent to your medical record system.

**How it works**:
1. **During/After Call**: Patient data is collected by agent
2. **Data Formatting**: System formats data in HL7 or FHIR format
3. **Auto-Send**: Data is automatically sent to configured EHR/EMR system
4. **Medical Record Updated**: Patient record is updated in your medical system

**HL7 Integration**:
- Uses HL7 (Health Level 7) messaging standard
- Sends patient demographics, appointments, clinical data
- Compatible with most EHR systems (Epic, Cerner, etc.)
- View HL7 configuration: Architecture → HL7 (`/architecture/hl7`)

**FHIR Integration**:
- Uses FHIR (Fast Healthcare Interoperability Resources) standard
- Modern RESTful API approach
- Sends patient resources, appointment resources, etc.
- Compatible with modern EHR systems
- View FHIR configuration: Architecture → FHIR (`/architecture/fhir`)

**Complete Flow**:
```
Call → Agent Collects Patient Data → Data Formatted (HL7/FHIR) → Sent to EHR System → Medical Record Updated
```

**What Data is Sent**:
- Patient demographics (name, DOB, phone, email)
- Appointment details (date, time, type, provider)
- Call summary and notes
- Any medical information collected during call

**Configuration** (Backend):
- HL7 endpoint URL
- FHIR endpoint URL
- Authentication credentials
- Data mapping rules

**View Integration Status**:
- Architecture → HL7 (`/architecture/hl7`)
- Architecture → FHIR (`/architecture/fhir`)

---

### 7. Email Sending After Calls (⚠️ NOT WORKING - SendGrid Missing)
**Location**: Backend service (automatic)

**What it does**: After every call ends, system should automatically send an email summary to a configured email address (patient, staff, or both).

**Current Status**: ⚠️ **NOT WORKING** - `SENDGRID_API_KEY` is not configured in backend `.env` file.

**What Should Happen** (When Fixed):
1. **Call Ends**: Patient hangs up or call is completed
2. **Email Triggered**: System automatically generates email summary
3. **Email Content**:
   - Call summary and transcript
   - Recording link (if available)
   - Appointment details (if scheduled)
   - Next steps or follow-up information
4. **Email Sent**: Email is sent to:
   - Patient (if email collected during call)
   - Staff/Admin (configured per agent or organization)
   - Both (if configured)

**Email Flow** (When Working):
```
Call Ends → Email Summary Generated → SendGrid API Called → Email Sent → Confirmation Logged
```

**To Fix**:
1. Get SendGrid API key:
   - Log in to SendGrid account
   - Go to Settings → API Keys
   - Create new API key (or use existing)
   - Copy the API key
2. Add to backend `.env` file:
   ```
   SENDGRID_API_KEY=SG.your_actual_api_key_here
   SENDGRID_FROM_EMAIL=noreply@ehealthmedai.com
   ```
3. Restart backend server:
   ```bash
   pm2 restart ehealth-backend
   ```
4. Test: Make a test call and verify email is sent after call ends

**Where emails are sent**: Configured per agent or organization settings in Settings page

**Note**: The old developer used SendGrid, but the API key was not provided. Once you get access to SendGrid account and add the API key, email functionality will work automatically.

---

### 8. User Management
**Location**: Dashboard → Settings → Users tab (`/dashboard/settings` → Users tab)

**What it does**: Add users to your organization who can access the dashboard.

**How to add**:
1. Go to Settings → Users tab
2. Click "Add User"
3. Enter email, password, name, role
4. Save

**Roles**:
- **Admin**: Full access
- **User**: Standard access
- **Patient**: Limited access
- **Doctor**: Medical staff access
- **Client**: Client organization access

---

### 9. Reports & Analytics
**Location**: Dashboard → Reports (`/dashboard/reports`)

**What it shows**:
- Call statistics
- Agent performance
- Call recordings
- Transcripts
- Appointment data

---

### 10. Billing & Collections
**Location**: Billing (`/billing`) and Collections (`/collections`)

**What it does**:
- **Billing**: Manage statements, payments, receipts
- **Collections**: Manage overdue payments, payment plans, reminders

**Note**: Email receipts won't work until SendGrid is configured.

---

## Complete Feature List - One Line Each

### Core Features
- **Dashboard**: Main overview with stats, charts, and quick actions
- **Agents**: Create and manage AI voice agents that handle phone calls
- **Phone Numbers**: Add Twilio phone numbers linked to your organization
- **Call Logs**: View all incoming/outgoing calls with recordings and transcripts
- **Appointments**: Manage patient appointments synced with Google Calendar
- **Users**: Add and manage users in your organization
- **Organization Settings**: Configure your sub-account (name, contact info, limits)

### Communication Features
- **Telephony**: Make/receive calls via Twilio with auto-recording
- **SMS**: Send and receive SMS messages (via Twilio)
- **Email**: ⚠️ **NOT WORKING** - Send emails after calls (SendGrid API key missing)
- **Web Chat**: Chat with AI agents via web interface

### Integration Features
- **Google Calendar**: Sync appointments automatically
- **HL7 Integration**: Connect with medical record systems using HL7 standard
- **FHIR Integration**: Connect with medical record systems using FHIR standard
- **Webhooks**: Receive real-time events (calls, appointments, etc.)

### Management Features
- **Reports**: View analytics, call statistics, agent performance
- **Billing**: Manage statements, payments, receipts
- **Collections**: Manage overdue balances, payment plans, reminders
- **Security**: View audit logs, encryption keys, access policies
- **Settings**: Configure organization, users, integrations

### Documentation Features
- **System Architecture**: Technical documentation
- **Glossary**: Medical and technical terminology
- **References**: HIPAA, HL7, FHIR, TCPA standards
- **Requirements**: RFC 2119 requirements
- **SRS**: Software Requirements Specification

---

## Complete Multi-Client Flow Example

### Scenario: Two Different Clients with Multiple Phone Numbers

**Client A: ABC Medical Clinic**
1. **Organization Created**: "ABC Medical Clinic" (sub-account)
2. **Phone Numbers Added**:
   - +17701234567 (Appointments line)
   - +17701234568 (Billing line)
   - +17701234569 (Emergency line)
3. **Agents Created & Linked**:
   - Agent "Appointment Scheduler" → Linked to +17701234567
   - Agent "Billing Assistant" → Linked to +17701234568
   - Agent "Emergency Triage" → Linked to +17701234569
4. **When Call Comes to +17701234567**:
   - System identifies: ABC Medical Clinic
   - Finds agent: "Appointment Scheduler"
   - Agent answers and handles call
   - Call recorded automatically
   - If appointment scheduled → Google Calendar updated
   - Patient data → Sent to EHR via HL7/FHIR
   - Email sent (when SendGrid configured)

**Client B: XYZ Hospital**
1. **Organization Created**: "XYZ Hospital" (separate sub-account)
2. **Phone Numbers Added**:
   - +17709876543 (Main line)
   - +17709876544 (Specialist line)
3. **Agents Created & Linked**:
   - Agent "Main Receptionist" → Linked to +17709876543
   - Agent "Specialist Coordinator" → Linked to +17709876544
4. **When Call Comes to +17709876543**:
   - System identifies: XYZ Hospital (NOT ABC Medical Clinic)
   - Finds agent: "Main Receptionist"
   - Agent answers and handles call
   - All data isolated to XYZ Hospital's account

**Key Points**:
- ✅ Each client has their own phone numbers
- ✅ Each phone number is linked to an agent for that client
- ✅ Data is completely isolated between clients
- ✅ Each client can have multiple phone numbers
- ✅ Each phone number can have its own agent

---

## Step-by-Step: Adding a New Client (Sub-Account)

### As Admin:
1. **Create Organization**:
   - Go to Settings → Organization
   - Fill in client details (name, contact info)
   - Click "Create Organization"
   - Note the Organization ID

2. **Add Client User**:
   - Go to Admin Panel (`/admin`)
   - Click "Create User"
   - Enter client's email, password, name
   - Set role to "client" or "user"
   - This user will be linked to the organization

3. **Client Logs In**:
   - Client logs in with their credentials
   - They see only their organization's data

4. **Client Adds Phone Number**:
   - Client goes to Telephony page
   - Adds their Twilio phone number
   - Phone number is linked to their organization

5. **Client Creates Agent**:
   - Client creates AI agent
   - Links agent to their phone number
   - Agent handles calls for that phone number

---

## Troubleshooting

### Email Not Working
**Problem**: Emails not being sent after calls
**Solution**: Add `SENDGRID_API_KEY` to backend `.env` file and restart server

### Calls Not Being Answered
**Problem**: Calls go to voicemail or fail
**Solution**: 
1. Check agent is linked to phone number
2. Check agent is active
3. Check Twilio webhook URL is configured correctly

### Calendar Not Syncing
**Problem**: Appointments not appearing in Google Calendar
**Solution**: Check Google Calendar credentials in backend `.env` file

### Can't Create Organization
**Problem**: "Admin access required" error
**Solution**: Make sure you're logged in as admin user

---

## Quick Reference: Where to Find Things

| What You Want to Do | Where to Go |
|---------------------|-------------|
| Create organization (sub-account) | Dashboard → Settings → Organization |
| Add phone number | Telephony page |
| Create AI agent | Dashboard → Create New Agent |
| View calls | Dashboard → Reports or Telephony page |
| Add users | Dashboard → Settings → Users |
| View appointments | Appointments page |
| Configure integrations | Settings → Integrations |
| View billing | Billing page |
| Manage collections | Collections page |
| View system docs | Architecture, Glossary, References pages |

---

## Important Reminders

1. ⚠️ **Email is NOT working** - SendGrid API key needs to be added
2. Each organization (sub-account) is completely separate
3. Phone numbers are linked to organizations, not individual users
4. Agents must be linked to phone numbers to handle calls
5. Calls are automatically recorded via Twilio
6. Google Calendar sync requires credentials in `.env`
7. HL7/FHIR integration is configured in backend

---

## Complete Feature Checklist - Client Requirements

### ✅ Requirement 1: Multiple Phone Numbers Per Client (Sub-Account)
**Status**: ✅ **IMPLEMENTED**
- Each client (organization) can have multiple phone numbers
- Phone numbers are linked to the organization (sub-account)
- Each client can choose their own phone numbers
- No limit on number of phone numbers (based on subscription tier)

**How to Use**:
1. Go to Telephony page
2. Click "Add Phone Number"
3. Add as many phone numbers as needed
4. Each phone number is automatically linked to your organization

---

### ✅ Requirement 2: Phone Numbers Linked to Agents for Sub-Account
**Status**: ✅ **IMPLEMENTED**
- Each phone number is linked to an agent for the sub-account
- When a call comes to a phone number, the linked agent automatically answers
- Each client can have multiple agents, each linked to different phone numbers

**How to Use**:
1. Create an agent (Dashboard → Create New Agent)
2. When creating agent, select which phone number it should handle
3. Save - agent is now linked to that phone number
4. When calls come to that number, the agent automatically answers

---

### ✅ Requirement 3: Call Recording
**Status**: ✅ **IMPLEMENTED & WORKING**
- Calls are automatically recorded via Twilio
- No additional setup needed
- Recording starts automatically when call begins
- Recording URL is saved in call log
- Access recordings from Dashboard → Reports or Telephony page

**How it Works**:
- Automatic - no configuration needed
- Twilio handles recording
- Recording available immediately after call ends

---

### ⚠️ Requirement 4: Email After Calls
**Status**: ⚠️ **IMPLEMENTED BUT NOT WORKING** (SendGrid API key missing)
- System is configured to send emails after calls
- Email includes: call summary, recording link, transcript, appointment details
- **Currently failing** because `SENDGRID_API_KEY` is not in backend `.env`

**To Fix**:
1. Get SendGrid API key from SendGrid account
2. Add to backend `.env`: `SENDGRID_API_KEY=your_key_here`
3. Restart backend server
4. Emails will work automatically after calls

---

### ✅ Requirement 5: Calendar Integration (Google Calendar)
**Status**: ✅ **IMPLEMENTED & WORKING**
- Google Calendar integration is configured
- When appointments are scheduled during calls, they automatically sync to Google Calendar
- Uses Google Calendar API credentials from backend `.env`

**How it Works**:
- Automatic - no user action needed
- Appointments created during calls → Google Calendar updated
- View appointments in Appointments page or Google Calendar

**Alternative**: System also supports GoHighLevel calendar (if configured)

---

### ✅ Requirement 6: HL7/FHIR Integration with Medical Record Systems
**Status**: ✅ **IMPLEMENTED & WORKING**
- HL7 integration for medical record systems
- FHIR integration for modern EHR systems
- Patient data and appointments automatically sent to EHR/EMR systems
- Configured in backend integration settings

**How it Works**:
- During/after calls, patient data is collected
- Data is formatted in HL7 or FHIR format
- Data is automatically sent to configured EHR/EMR system
- Medical records are updated in your system

**View Configuration**:
- Architecture → HL7 (`/architecture/hl7`)
- Architecture → FHIR (`/architecture/fhir`)

---

## Next Steps for Client

1. ✅ Create your organization (sub-account)
2. ✅ Add your phone number(s) - you can add multiple!
3. ✅ Create your first AI agent
4. ✅ Link agent to phone number
5. ✅ Test with a call - recording will work automatically
6. ⚠️ Configure SendGrid for email (get API key and add to `.env`)
7. ✅ Add team members as users
8. ✅ Google Calendar is already configured and working
9. ✅ HL7/FHIR integration is configured and working

---

**Need Help?** Contact support or refer to the documentation pages in the dashboard.

---

## Complete Visual Flow - End-to-End Process

### Multi-Client Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    EHealth Med AI Platform                       │
│                    (Multi-Tenant System)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌──────────────────┐                      ┌──────────────────┐
│  Client A       │                      │  Client B        │
│  ABC Medical     │                      │  XYZ Hospital    │
│  Clinic         │                      │                  │
│  (Sub-Account)  │                      │  (Sub-Account)    │
└──────────────────┘                      └──────────────────┘
        │                                           │
        │                                           │
        ▼                                           ▼
┌──────────────────┐                      ┌──────────────────┐
│ Phone Numbers:   │                      │ Phone Numbers:   │
│ +17701234567     │                      │ +17709876543     │
│ +17701234568     │                      │ +17709876544     │
│ +17701234569     │                      │                  │
└──────────────────┘                      └──────────────────┘
        │                                           │
        │                                           │
        ▼                                           ▼
┌──────────────────┐                      ┌──────────────────┐
│ Agents Linked:  │                      │ Agents Linked:  │
│ Agent 1 → +67   │                      │ Agent 1 → +43   │
│ Agent 2 → +68    │                      │ Agent 2 → +44    │
│ Agent 3 → +69    │                      │                  │
└──────────────────┘                      └──────────────────┘
```

### Complete Call Flow (Step-by-Step)

```
┌─────────────────────────────────────────────────────────────────┐
│                    INCOMING CALL FLOW                            │
└─────────────────────────────────────────────────────────────────┘

Step 1: Patient Calls Phone Number
   │
   │ Patient dials: +17701234567
   │
   ▼
┌─────────────────────────────────┐
│ Twilio Receives Call            │
└─────────────────────────────────┘
   │
   │
   ▼
Step 2: System Identifies Organization
   │
   │ System checks: Which organization owns +17701234567?
   │ Result: "ABC Medical Clinic" (Client A)
   │
   ▼
┌─────────────────────────────────┐
│ Organization Found: Client A   │
└─────────────────────────────────┘
   │
   │
   ▼
Step 3: System Finds Linked Agent
   │
   │ System checks: Which agent is linked to +17701234567?
   │ Result: "Appointment Scheduler" agent
   │
   ▼
┌─────────────────────────────────┐
│ Agent Found: Appointment        │
│ Scheduler (for Client A)        │
└─────────────────────────────────┘
   │
   │
   ▼
Step 4: Agent Auto-Answers Call
   │
   │ Agent automatically answers
   │ No human intervention needed
   │
   ▼
┌─────────────────────────────────┐
│ Call Recording Starts           │
│ (Automatic via Twilio)          │
└─────────────────────────────────┘
   │
   │
   ▼
Step 5: AI Conversation Begins
   │
   │ Agent uses AI to talk to patient
   │ Collects information
   │ Can schedule appointments
   │
   ▼
┌─────────────────────────────────┐
│ Conversation in Progress        │
│ (AI-powered, natural language) │
└─────────────────────────────────┘
   │
   │
   ▼
Step 6: Call Ends
   │
   │ Patient hangs up or agent ends call
   │
   ▼
┌─────────────────────────────────┐
│ Call Recording Saved            │
│ (Automatic - Twilio)            │
└─────────────────────────────────┘
   │
   │
   ▼
Step 7: Multiple Actions Triggered
   │
   ├─► Call Log Created (with transcript, duration, etc.)
   │
   ├─► Email Sent (⚠️ NOT WORKING - SendGrid missing)
   │
   ├─► Appointment → Google Calendar (✅ WORKING)
   │
   └─► Patient Data → EHR System (✅ WORKING - HL7/FHIR)
```

### Data Flow After Call

```
┌─────────────────────────────────────────────────────────────────┐
│                    POST-CALL DATA FLOW                          │
└─────────────────────────────────────────────────────────────────┘

Call Ends
   │
   │
   ├─────────────────────────────────────────────────────────┐
   │                                                           │
   ▼                                                           ▼
┌──────────────────────┐                          ┌──────────────────────┐
│ Call Log Created     │                          │ Recording Saved      │
│ - Caller info        │                          │ - Twilio storage     │
│ - Duration           │                          │ - URL in database    │
│ - Agent used         │                          │ - Accessible via UI  │
│ - Transcript         │                          └──────────────────────┘
│ - Recording URL      │
└──────────────────────┘
   │
   │
   ├─────────────────────────────────────────────────────────┐
   │                                                           │
   ▼                                                           ▼
┌──────────────────────┐                          ┌──────────────────────┐
│ Email Sent           │                          │ Google Calendar      │
│ ⚠️ NOT WORKING       │                          │ ✅ WORKING           │
│ (SendGrid missing)   │                          │ - Appointment added  │
│                      │                          │ - Auto-sync          │
│ Should include:      │                          │ - View in calendar   │
│ - Call summary       │                          └──────────────────────┘
│ - Recording link     │
│ - Transcript         │
│ - Appointment info   │
└──────────────────────┘
   │
   │
   ▼
┌──────────────────────┐
│ EHR Integration      │
│ ✅ WORKING           │
│ - HL7 format         │
│ - FHIR format        │
│ - Patient data sent  │
│ - Medical record     │
│   updated            │
└──────────────────────┘
```

### Multi-Phone Number Example Flow

```
Client: ABC Medical Clinic
│
├─ Phone Number 1: +17701234567
│  └─ Linked to Agent: "Appointment Scheduler"
│     └─ When call comes → Agent answers → Handles appointment scheduling
│
├─ Phone Number 2: +17701234568
│  └─ Linked to Agent: "Billing Assistant"
│     └─ When call comes → Agent answers → Handles billing inquiries
│
└─ Phone Number 3: +17701234569
   └─ Linked to Agent: "Emergency Triage"
      └─ When call comes → Agent answers → Handles emergency calls

Each phone number → Different agent → Different purpose
All under same organization (sub-account)
All data isolated to this client
```

---

## Summary: All Client Requirements

| Requirement | Status | Details |
|------------|--------|---------|
| **Multiple phone numbers per client** | ✅ **IMPLEMENTED** | Each client can add multiple phone numbers to their sub-account |
| **Phone numbers linked to agents** | ✅ **IMPLEMENTED** | Each phone number is linked to an agent for that client's sub-account |
| **Call recording** | ✅ **WORKING** | Automatic recording via Twilio, no setup needed |
| **Email after calls** | ⚠️ **NOT WORKING** | Implemented but SendGrid API key missing - needs to be added |
| **Google Calendar integration** | ✅ **WORKING** | Appointments automatically sync to Google Calendar |
| **HL7/FHIR integration** | ✅ **WORKING** | Patient data automatically sent to medical record systems |

---

**All requirements are implemented. Only email needs SendGrid API key to be added.**

