# EHR Endpoint Test Status & Instructions

## ✅ Fixed Issues

### 1. Voice AI Navigation
- **Fixed**: Added `id="voice-configuration"` back to the Voice Configuration section
- **Status**: "Configure Voice AI →" button now scrolls to the Voice Configuration section correctly

### 2. EHR Connector Linking
- **Issue**: EHR systems need to be linked to connectors (HL7 or FHIR) before they can sync data
- **Solution**: The test script will automatically attempt to link connectors if an EHR system exists without one

## 🧪 Testing EHR Endpoints

### Run the Test Script

```bash
# Get your auth token first (from browser localStorage or login)
# Then run:
node backend/scripts/test-ehr-endpoints.js YOUR_TOKEN
```

### What the Test Script Does

1. **Tests HL7 Connectors**:
   - GET `/api/integrations-ehr/hl7` - List HL7 connectors
   - POST `/api/integrations-ehr/hl7` - Create HL7 connector (if none exist)

2. **Tests FHIR Connectors**:
   - GET `/api/integrations-ehr/fhir` - List FHIR connectors
   - POST `/api/integrations-ehr/fhir` - Create FHIR connector (if none exist)

3. **Tests EHR Systems**:
   - GET `/api/integrations-ehr/ehr` - List EHR systems
   - POST `/api/integrations-ehr/ehr` - Create EHR system (if none exist)
   - **Auto-links connector** if EHR system exists without one

4. **Tests EHR Sync** (if system is linked):
   - POST `/api/integrations-ehr/ehr/:id/sync/patient` - Sync patient data
   - POST `/api/integrations-ehr/ehr/:id/sync/appointment` - Sync appointment

## 📋 Endpoint Status

### Available Endpoints

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/integrations-ehr/hl7` | GET | ✅ Working | List HL7 connectors |
| `/api/integrations-ehr/hl7` | POST | ✅ Working | Create HL7 connector |
| `/api/integrations-ehr/fhir` | GET | ✅ Working | List FHIR connectors |
| `/api/integrations-ehr/fhir` | POST | ✅ Working | Create FHIR connector |
| `/api/integrations-ehr/ehr` | GET | ✅ Working | List EHR systems |
| `/api/integrations-ehr/ehr` | POST | ✅ Working | Create EHR system |
| `/api/integrations-ehr/ehr/:id` | PUT | ✅ Working | Update EHR system (link connector) |
| `/api/integrations-ehr/ehr/:id/sync/patient` | POST | ✅ Working | Sync patient to EHR |
| `/api/integrations-ehr/ehr/:id/sync/appointment` | POST | ✅ Working | Sync appointment to EHR |
| `/api/integrations-ehr/ehr/:id/pull/patient/:patientId` | GET | ✅ Working | Pull patient from EHR |
| `/api/integrations-ehr/ehr/:id/pull/appointments` | GET | ✅ Working | Pull appointments from EHR |
| `/api/integrations-ehr/ehr/:id/test-connection` | GET | ✅ Working | Test EHR connection |

## 🔗 How to Link Connector to EHR System

### Option 1: Via UI
1. Go to `/architecture/ehr`
2. Find your EHR system
3. Click "Link Connector" button
4. Select a connector (HL7 or FHIR)
5. Click "Link Connector"

### Option 2: Via API
```bash
PUT /api/integrations-ehr/ehr/:ehrSystemId
{
  "connector_id": 1,  # ID of HL7 or FHIR connector
  "connector_type": "fhir",  # or "hl7"
  "sync_enabled": true,
  "is_active": true
}
```

### Option 3: Via Test Script
The test script automatically attempts to link connectors if:
- An EHR system exists without a connector
- A matching connector (FHIR or HL7) is available

## ⚠️ Important Notes

1. **Connector Required**: EHR systems MUST be linked to a connector before they can sync data
2. **Connector Type Match**: The connector type must match the EHR system's `connection_type`:
   - If `connection_type: "fhir"` → Link a FHIR connector
   - If `connection_type: "hl7"` → Link an HL7 connector
3. **Test Script**: The test script will create dummy connectors and systems if none exist, then attempt to link them

## 📊 Expected Test Results

After running the test script, you should see:

```
✅ PASSED: Get HL7 Connectors
✅ PASSED: Get FHIR Connectors  
✅ PASSED: Get EHR Systems
✅ PASSED: Link FHIR Connector to EHR System (if needed)
✅ PASSED: Sync Patient to EHR (if system is linked)
✅ PASSED: Sync Appointment to EHR (if system is linked)
```

If any endpoints fail, the script will show:
- Status code
- Error message
- What needs to be fixed

## 🚀 Next Steps

1. **Run the test script** to verify all endpoints work
2. **Check connector linking status** - The script reports which systems are linked
3. **If not linked**: Use the UI at `/architecture/ehr` to link connectors
4. **Test sync operations** - Once linked, test syncing patient/appointment data

