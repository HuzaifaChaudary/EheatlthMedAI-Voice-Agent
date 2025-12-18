# Quick Testing Guide - Admin Console Features

## 🚀 Quick Start Testing

### 1. Excel & PDF Export Testing (UI - RECOMMENDED)

**Location:** http://localhost:3000/architecture/reports

**Steps:**
1. Navigate to http://localhost:3000/architecture/reports
2. Click "+ Create Template"
3. Fill in:
   - Name: "Test Excel Report"
   - Type: "Call Analytics"
   - Format: "Excel (XLSX)"
4. Click "Create Template"
5. Click "Generate Report" on the template card
6. Set date range (or leave default)
7. Click "Generate Report"
8. Wait a few seconds, then switch to "Generated Reports" tab
9. Click "Download" button on the completed report
10. File downloads! Open it to verify

**For PDF:** Same steps, but choose "PDF" format

### 2. Excel & PDF Export Testing (API)

**Location:** Backend API endpoints

#### Test via Browser/Postman:

1. **Login first to get JWT token:**
   ```
   POST http://localhost:5000/api/auth/login
   Body: { "email": "your-email", "password": "your-password" }
   ```
   Copy the `token` from response

2. **Create a report template:**
   ```
   POST http://localhost:5000/api/reports/templates
   Headers: Authorization: Bearer YOUR_TOKEN
   Body: {
     "name": "Test Excel Report",
     "type": "call_analytics",
     "format": "xlsx"
   }
   ```
   Note the `template.id` from response

3. **Generate report:**
   ```
   POST http://localhost:5000/api/reports/generate
   Headers: Authorization: Bearer YOUR_TOKEN
   Body: {
     "template_id": 1,
     "parameters": {}
   }
   ```
   Note the `report.id` from response

4. **Download report (Excel):**
   ```
   GET http://localhost:5000/api/reports/1/download
   Headers: Authorization: Bearer YOUR_TOKEN
   ```
   File should download as `report-1.xlsx`

5. **Test PDF - same steps but use format: "pdf"**
   - Create template with `"format": "pdf"`
   - Generate and download
   - File should download as `report-2.pdf`

### 3. Analytics Dashboard Testing

**Location:** http://localhost:3000/analytics

#### Steps:
1. Open browser: http://localhost:3000/analytics
2. Login if needed
3. **What to verify:**
   - ✅ Statistics cards show numbers (6 cards: Total Calls, Completed, Failed, Avg Duration, Total Duration, Total Cost)
   - ✅ Bar chart displays for "Daily Call Volume" (horizontal bars)
   - ✅ Chart is interactive (hover shows tooltips)
   - ✅ Date range selector works (change dates, chart updates)
   - ✅ List view below chart shows daily data

### 4. Automated Test Script

**Run the automated test script:**

```bash
# 1. Get your JWT token (login via API or copy from browser localStorage)
# 2. Run test script:
cd backend
JWT_TOKEN="your_token_here" node scripts/test-reports.js
```

**What it tests:**
- ✅ Excel template creation
- ✅ Excel report generation
- ✅ Excel file download and validation
- ✅ PDF template creation  
- ✅ PDF report generation
- ✅ PDF file download and validation
- ✅ Analytics endpoint accessibility
- ✅ Permission checks

**Expected output:**
```
✅ Create Excel template
✅ Generate Excel report
✅ Download Excel report
✅ Excel file is valid
✅ Create PDF template
✅ Generate PDF report
✅ Download PDF report
✅ PDF file is valid
✅ Analytics endpoint accessible
...
Test Summary
✅ Passed: X
❌ Failed: Y
```

## 📍 Testing Locations Summary

| Feature | Location | How to Test |
|---------|----------|-------------|
| **Excel Export (UI)** | http://localhost:3000/architecture/reports | UI: Create template (Excel) → Generate → Download |
| **PDF Export (UI)** | http://localhost:3000/architecture/reports | UI: Create template (PDF) → Generate → Download |
| **Excel Export (API)** | `POST /api/reports/templates` (format: xlsx) | API: Create template → Generate → Download |
| **PDF Export (API)** | `POST /api/reports/templates` (format: pdf) | API: Create template → Generate → Download |
| **Analytics Charts** | http://localhost:3000/analytics | View page, check charts render |
| **Permissions** | All `/api/admin/*` routes | Try as non-admin user, should get 403 |

## 🔍 Verification Checklist

### Excel Files
- [ ] File downloads successfully
- [ ] File opens in Excel/LibreOffice
- [ ] Headers are formatted (blue background, white text)
- [ ] Data rows are present
- [ ] Column widths auto-adjusted
- [ ] Date formatting works (if dates present)

### PDF Files
- [ ] File downloads successfully
- [ ] File opens in PDF viewer
- [ ] Header with report name visible
- [ ] Table with data present
- [ ] Page numbers visible (if multi-page)
- [ ] Professional formatting

### Analytics Dashboard
- [ ] Page loads without errors
- [ ] All 6 stat cards display
- [ ] Bar chart renders (not just list)
- [ ] Chart bars are visible and colored
- [ ] Date range changes update chart
- [ ] Hover tooltips work (if implemented)

## 🐛 Troubleshooting

**Excel file won't open?**
- Check backend logs for errors
- Verify exceljs is installed: `npm list exceljs`
- Try downloading again after waiting a few seconds

**PDF file corrupted?**
- Check backend logs for errors
- Verify pdfkit is installed: `npm list pdfkit`
- Ensure report generation completed (status: 'completed')

**Charts not showing?**
- Open browser console (F12) and check for errors
- Verify API returns data: `GET /api/analytics/dashboard`
- Check network tab for failed requests

**403 Permission errors?**
- Verify you're logged in as admin user
- Check JWT token is valid and not expired
- Check token includes role: 'admin'

## 💡 Pro Tips

1. **Use browser DevTools** to inspect API responses
2. **Check backend logs** for detailed error messages
3. **Test with actual data** - create some test conversations/calls first
4. **Use Postman/Insomnia** for easier API testing
5. **Check file sizes** - Excel/PDF files should be > 0 bytes
