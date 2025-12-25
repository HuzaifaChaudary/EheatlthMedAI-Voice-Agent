# Where to Test Integrations in UI (Short Answer)

## 🎯 Quick Answer

**UI Location**: `/dashboard/integrations`

**Tabs Available**:
1. **Calendar** - Test Google Calendar, GoHighLevel, Calendly, Zocdoc
2. **CRM** - Test Salesforce, HubSpot, Zendesk, Freshdesk  
3. **Webhooks** - Manage webhook endpoints

## 📍 Full Paths

- **Local**: `http://localhost:3000/dashboard/integrations`
- **Production**: `https://huzaifaiftikhar.engineer/dashboard/integrations`

## ✅ How to Test

1. **Go to `/dashboard/integrations`**
2. **Click "Calendar" tab** (or "CRM" tab)
3. **Click "Test" button** on any integration
4. **See result** - Success ✅ or Error ❌

## 🔧 Enable/Disable

- Click **"Enable"** or **"Disable"** button on each integration
- Only **active** integrations sync data

## 🏥 EHR Testing

**UI Location**: `/architecture/ehr`

- View EHR systems
- Test connections
- Link to HL7/FHIR connectors

---

**That's it!** All integration testing is in `/dashboard/integrations`

