# Admin Console Features Testing Guide

This guide explains how to test the newly implemented Admin Console features.

## Prerequisites

1. Backend server running on port 5000
2. Frontend server running on port 3000
3. Admin user account logged in
4. Dependencies installed: `npm install` in backend directory

## 1. Testing Excel Export Functionality

### Step 1: Create a Report Template

**Via API (Postman/curl):**

```bash
POST http://localhost:5000/api/reports/templates
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "Call Analytics Report",
  "type": "call_analytics",
  "description": "Daily call statistics report",
  "format": "xlsx",
  "query_config": {
    "query": "SELECT * FROM call_logs LIMIT 10"
  }
}
```

**Expected Response:**
```json
{
  "template": {
    "id": 1,
    "name": "Call Analytics Report",
    "type": "call_analytics",
    "format": "xlsx",
    ...
  }
}
```

### Step 2: Generate Report

```bash
POST http://localhost:5000/api/reports/generate
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "template_id": 1,
  "parameters": {
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  }
}
```

**Expected Response:**
```json
{
  "report": {
    "id": 1,
    "template_id": 1,
    "status": "generating",
    ...
  }
}
```

### Step 3: Download Excel Report

Wait a few seconds for generation, then:

```bash
GET http://localhost:5000/api/reports/1/download
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected:**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- File download: `report-1.xlsx`
- File should open in Excel with proper formatting

### Step 4: Verify Excel File

1. Open the downloaded `.xlsx` file
2. Check for:
   - Formatted header row (blue background, white text)
   - Data rows with proper values
   - Auto-adjusted column widths
   - Date formatting if dates are present

## 2. Testing PDF Export Functionality

### Step 1: Create PDF Report Template

```bash
POST http://localhost:5000/api/reports/templates
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "Agent Performance PDF",
  "type": "agent_performance",
  "description": "Agent performance metrics",
  "format": "pdf",
  "query_config": {}
}
```

### Step 2: Generate PDF Report

```bash
POST http://localhost:5000/api/reports/generate
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "template_id": 2,
  "parameters": {
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  }
}
```

### Step 3: Download PDF Report

```bash
GET http://localhost:5000/api/reports/2/download
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected:**
- Content-Type: `application/pdf`
- File download: `report-2.pdf`
- PDF should open with proper formatting, tables, and page numbers

### Step 4: Verify PDF File

1. Open the downloaded `.pdf` file
2. Check for:
   - Header with report name and metadata
   - Formatted table with data
   - Page numbers on each page
   - Professional formatting

## 3. Testing Analytics Dashboard Visualizations

### Step 1: Access Analytics Page

1. Navigate to: http://localhost:3000/analytics
2. Login with admin credentials if needed

### Step 2: Verify Chart Display

**Check for:**
- Daily Call Volume bar chart (horizontal bars)
- Chart shows data from last 30 days
- Hover tooltips show call counts
- Date labels on x-axis
- List view below chart with detailed data

### Step 3: Test Date Range Filter

1. Change "Start Date" to a different date
2. Change "End Date" to a different date
3. Chart should update automatically
4. Verify data matches selected date range

### Step 4: Verify Statistics Cards

**Check all 6 cards display:**
- Total Calls
- Completed Calls
- Failed Calls
- Avg Duration
- Total Duration
- Total Cost

All should show actual numbers (may be 0 if no data).

## 4. Testing Role-Based Permissions

### Step 1: Test Admin Access

As admin user, verify you can:
- Create report templates: `POST /api/reports/templates` (should succeed)
- Generate reports: `POST /api/reports/generate` (should succeed)
- Access admin routes: `GET /api/admin/stats` (should succeed)

### Step 2: Test Non-Admin Access

1. Login as non-admin user (role: 'user')
2. Try to create report template: `POST /api/reports/templates`
3. **Expected:** 403 Forbidden error with message "Admin access required"

### Step 3: Test Permission Middleware

Create a test route using the permission middleware:

```javascript
const { requireRole, requirePermission } = require('../middleware/permissions');

// Test requireRole
router.get('/test-admin', authenticateToken, requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin access granted' });
});

// Test requirePermission
router.get('/test-permission', authenticateToken, 
  requirePermission('reports', 'read'), 
  (req, res) => {
    res.json({ message: 'Permission granted' });
  }
);
```

## 5. Quick Test Script

Run this Node.js script to quickly test report generation:

```javascript
// test-reports.js
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
const TOKEN = 'YOUR_JWT_TOKEN'; // Get from login

async function testReports() {
  try {
    const headers = {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    };

    // 1. Create template
    console.log('Creating report template...');
    const templateRes = await axios.post(`${API_URL}/reports/templates`, {
      name: 'Test Report',
      type: 'call_analytics',
      format: 'xlsx'
    }, { headers });
    console.log('Template created:', templateRes.data);

    // 2. Generate report
    console.log('Generating report...');
    const generateRes = await axios.post(`${API_URL}/reports/generate`, {
      template_id: templateRes.data.template.id,
      parameters: {}
    }, { headers });
    console.log('Report generated:', generateRes.data);

    // 3. Wait for generation
    console.log('Waiting for report generation...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Download report
    console.log('Downloading report...');
    const downloadRes = await axios.get(
      `${API_URL}/reports/${generateRes.data.report.id}/download`,
      { 
        headers,
        responseType: 'arraybuffer' // Important for binary files
      }
    );
    console.log('Report downloaded! Size:', downloadRes.data.length, 'bytes');
    console.log('Content-Type:', downloadRes.headers['content-type']);

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testReports();
```

## 6. UI Testing Locations

### Excel/PDF Export
- **Location:** Report templates and generated reports pages (if they exist)
- **Test:** Create template → Generate report → Download
- **Verify:** File downloads and opens correctly

### Analytics Dashboard
- **Location:** http://localhost:3000/analytics
- **Test:** View charts, change date ranges, verify data updates
- **Verify:** Charts render correctly, data is accurate

### Permissions
- **Location:** All admin routes
- **Test:** Login as non-admin, try admin actions
- **Verify:** Proper 403 errors returned

## Troubleshooting

### Excel file won't open
- Check that `exceljs` is installed: `npm list exceljs`
- Verify Content-Type header is correct
- Check file size is > 0 bytes

### PDF file corrupted
- Check that `pdfkit` is installed: `npm list pdfkit`
- Verify buffer is being sent correctly
- Check server logs for errors

### Charts not showing
- Check browser console for errors
- Verify analytics API returns data: `GET /api/analytics/dashboard`
- Check that daily_volume array has data

### Permission errors
- Verify JWT token includes role
- Check that user role is 'admin' for admin routes
- Review server logs for permission check errors

## Testing Checklist

- [ ] Excel export generates valid .xlsx file
- [ ] PDF export generates valid .pdf file
- [ ] Analytics dashboard shows bar charts
- [ ] Date range filtering works on analytics
- [ ] Admin routes require admin role
- [ ] Non-admin users get 403 errors
- [ ] Report data is accurate (matches database)
- [ ] File downloads work in browser
- [ ] Charts are responsive and interactive

