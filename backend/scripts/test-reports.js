/**
 * Test Script for Report Generation Features
 * 
 * Usage:
 * 1. Get a JWT token by logging in
 * 2. Set JWT_TOKEN environment variable or edit this file
 * 3. Run: node scripts/test-reports.js
 */

// Use native fetch (Node 18+) or install axios: npm install axios
let axios;
try {
  axios = require('axios');
} catch (e) {
  console.error('❌ Error: axios not installed. Install it with: npm install axios');
  process.exit(1);
}
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:5000/api';
const JWT_TOKEN = process.env.JWT_TOKEN || ''; // Set via: export JWT_TOKEN="your_token_here"

if (!JWT_TOKEN) {
  console.error('❌ Error: JWT_TOKEN environment variable not set');
  console.log('Usage: JWT_TOKEN="your_token" node scripts/test-reports.js');
  console.log('Or login first and copy token from browser/localStorage');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${JWT_TOKEN}`,
  'Content-Type': 'application/json'
};

const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

function logTest(name, passed, error = null) {
  if (passed) {
    console.log(`✅ ${name}`);
    testResults.passed++;
  } else {
    console.log(`❌ ${name}`);
    testResults.failed++;
    if (error) {
      testResults.errors.push({ name, error });
      console.log(`   Error: ${error}`);
    }
  }
}

async function testExcelExport() {
  console.log('\n📊 Testing Excel Export...');
  
  try {
    // 1. Create template
    console.log('   Creating Excel template...');
    const templateRes = await axios.post(`${API_URL}/reports/templates`, {
      name: 'Test Excel Report',
      type: 'call_analytics',
      description: 'Test report for Excel export',
      format: 'xlsx',
      query_config: {}
    }, { headers });
    
    logTest('Create Excel template', templateRes.status === 201);
    const templateId = templateRes.data.template.id;
    console.log(`   Template ID: ${templateId}`);

    // 2. Generate report
    console.log('   Generating Excel report...');
    const generateRes = await axios.post(`${API_URL}/reports/generate`, {
      template_id: templateId,
      parameters: {
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
      }
    }, { headers });
    
    logTest('Generate Excel report', generateRes.status === 201);
    const reportId = generateRes.data.report.id;
    console.log(`   Report ID: ${reportId}`);

    // 3. Wait for generation
    console.log('   Waiting for report generation (2 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Download report
    console.log('   Downloading Excel report...');
    const downloadRes = await axios.get(
      `${API_URL}/reports/${reportId}/download`,
      { 
        headers,
        responseType: 'arraybuffer'
      }
    );
    
    const isExcel = downloadRes.headers['content-type'] === 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    logTest('Download Excel report', downloadRes.status === 200 && isExcel);
    
    if (isExcel && downloadRes.data.length > 0) {
      // Save file
      const filename = path.join(__dirname, '..', 'test-report.xlsx');
      fs.writeFileSync(filename, downloadRes.data);
      console.log(`   ✅ Excel file saved: ${filename} (${downloadRes.data.length} bytes)`);
      logTest('Excel file is valid', true);
    } else {
      logTest('Excel file is valid', false, 'File is empty or wrong content type');
    }

  } catch (error) {
    logTest('Excel export test', false, 
      error.response?.data?.message || error.message);
  }
}

async function testPDFExport() {
  console.log('\n📄 Testing PDF Export...');
  
  try {
    // 1. Create template
    console.log('   Creating PDF template...');
    const templateRes = await axios.post(`${API_URL}/reports/templates`, {
      name: 'Test PDF Report',
      type: 'agent_performance',
      description: 'Test report for PDF export',
      format: 'pdf',
      query_config: {}
    }, { headers });
    
    logTest('Create PDF template', templateRes.status === 201);
    const templateId = templateRes.data.template.id;
    console.log(`   Template ID: ${templateId}`);

    // 2. Generate report
    console.log('   Generating PDF report...');
    const generateRes = await axios.post(`${API_URL}/reports/generate`, {
      template_id: templateId,
      parameters: {
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
      }
    }, { headers });
    
    logTest('Generate PDF report', generateRes.status === 201);
    const reportId = generateRes.data.report.id;
    console.log(`   Report ID: ${reportId}`);

    // 3. Wait for generation
    console.log('   Waiting for report generation (2 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Download report
    console.log('   Downloading PDF report...');
    const downloadRes = await axios.get(
      `${API_URL}/reports/${reportId}/download`,
      { 
        headers,
        responseType: 'arraybuffer'
      }
    );
    
    const isPDF = downloadRes.headers['content-type'] === 'application/pdf';
    logTest('Download PDF report', downloadRes.status === 200 && isPDF);
    
    if (isPDF && downloadRes.data.length > 0) {
      // Check PDF magic bytes
      const pdfMagic = downloadRes.data.slice(0, 4).toString();
      const isValidPDF = pdfMagic === '%PDF';
      
      // Save file
      const filename = path.join(__dirname, '..', 'test-report.pdf');
      fs.writeFileSync(filename, downloadRes.data);
      console.log(`   ✅ PDF file saved: ${filename} (${downloadRes.data.length} bytes)`);
      logTest('PDF file is valid', isValidPDF);
    } else {
      logTest('PDF file is valid', false, 'File is empty or wrong content type');
    }

  } catch (error) {
    logTest('PDF export test', false, 
      error.response?.data?.message || error.message);
  }
}

async function testAnalyticsEndpoint() {
  console.log('\n📈 Testing Analytics Endpoint...');
  
  try {
    const response = await axios.get(
      `${API_URL}/analytics/dashboard?start_date=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&end_date=${new Date().toISOString().split('T')[0]}`,
      { headers }
    );
    
    logTest('Analytics endpoint accessible', response.status === 200);
    
    const hasStats = response.data.call_stats !== undefined;
    const hasDailyVolume = Array.isArray(response.data.daily_volume);
    const hasAgentPerformance = Array.isArray(response.data.agent_performance);
    
    logTest('Analytics returns call_stats', hasStats);
    logTest('Analytics returns daily_volume array', hasDailyVolume);
    logTest('Analytics returns agent_performance array', hasAgentPerformance);
    
    if (hasDailyVolume && response.data.daily_volume.length > 0) {
      console.log(`   ✅ Daily volume data: ${response.data.daily_volume.length} days`);
    }
    
  } catch (error) {
    logTest('Analytics endpoint test', false, 
      error.response?.data?.message || error.message);
  }
}

async function testPermissions() {
  console.log('\n🔒 Testing Permissions...');
  
  try {
    // Test admin route (should work)
    const adminResponse = await axios.get(`${API_URL}/admin/stats`, { headers });
    logTest('Admin route accessible (as admin)', adminResponse.status === 200);
    
    // Test report template creation (should work as admin)
    try {
      const templateResponse = await axios.post(`${API_URL}/reports/templates`, {
        name: 'Permission Test Template',
        type: 'call_analytics',
        format: 'pdf'
      }, { headers });
      logTest('Create template (admin access)', templateResponse.status === 201);
    } catch (error) {
      if (error.response?.status === 403) {
        logTest('Create template (admin access)', false, 'Got 403 - user may not be admin');
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    if (error.response?.status === 403) {
      logTest('Admin route accessible (as admin)', false, 'Got 403 - user may not be admin');
    } else {
      logTest('Permissions test', false, error.response?.data?.message || error.message);
    }
  }
}

async function runTests() {
  console.log('🧪 Starting Report Generation Tests\n');
  console.log(`API URL: ${API_URL}`);
  console.log(`Token: ${JWT_TOKEN.substring(0, 20)}...\n`);

  await testExcelExport();
  await testPDFExport();
  await testAnalyticsEndpoint();
  await testPermissions();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Errors:');
    testResults.errors.forEach(({ name, error }) => {
      console.log(`   ${name}: ${error}`);
    });
  }
  
  console.log('\n💡 Tip: Check generated files: test-report.xlsx and test-report.pdf');
  console.log('='.repeat(50));
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('💥 Fatal error:', error.message);
  process.exit(1);
});

