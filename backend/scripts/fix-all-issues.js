/**
 * Fix All Issues Script
 * 1. Fix calendar integration ID mismatch
 * 2. Fix EHR sync SQL error
 * 3. Update agent system prompt
 * 4. Update Google Calendar credentials
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://ehealthmedai:str0ng@localhost:5432/ehealthmedai'
});

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function fixCalendarIntegration() {
  log('\n🔧 Fix 1: Calendar Integration ID Mismatch', 'cyan');
  
  try {
    // Find active calendar integration
    const integrationResult = await pool.query(
      `SELECT id, name, provider, type, is_active, organization_id 
       FROM integrations 
       WHERE provider = 'google_calendar' 
       AND type = 'scheduling' 
       AND is_active = true 
       ORDER BY created_at DESC 
       LIMIT 5`
    );
    
    if (integrationResult.rows.length === 0) {
      log('⚠️  No active calendar integration found. Creating one...', 'yellow');
      
      // Get organization
      const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
      const orgId = orgResult.rows[0]?.id;
      
      // Create new integration with new tokens
      const newAccessToken = 'ya29.a0Aa7pCA-ak9EWG5yduqpzN_DwNY-IcPKnjmVZeEDH7F5_Ac2w3LNKol8f359zbWJjxH3h2-BpSa3f8WIvepXYmP5buFM5joUr-nRtiTP6OzbDLJ7yHxVrS9kYvKvDo1mDDH5eWjj-E-B6PkwG4yZ5VwnmJdKHEswJFJJ2MCrADEwBwUENWJlY_7cPjWPmb7yovx9hRgMaCgYKAaASARcSFQHGX2MiwKL9C1oR5CWIBUWJ4M5qaA0206';
      const newRefreshToken = '1//04VCrzcFcNC6_CgYIARAAGAQSNwF-L9Irb3bgvQ2N5hOyB0qakxUhnfsnJrrfjYjVq20Bzl7qpMXOoOFz_MWjkrToh2j3YKDQXDs';
      const clientId = '407408718192.apps.googleusercontent.com';
      
      const credentials = {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        client_id: clientId,
        calendar_id: 'primary'
      };
      
      const insertResult = await pool.query(
        `INSERT INTO integrations (organization_id, name, type, provider, credentials, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [orgId, 'Google Calendar', 'scheduling', 'google_calendar', JSON.stringify(credentials), true]
      );
      
      const integrationId = insertResult.rows[0].id;
      log(`✅ Created new calendar integration: ID ${integrationId}`, 'green');
      
      // Update agent
      await pool.query(
        'UPDATE ai_agents SET calendar_integration_id = $1 WHERE id = 7',
        [integrationId]
      );
      log(`✅ Updated agent 7 to use calendar integration ${integrationId}`, 'green');
      
      return integrationId;
    } else {
      const integration = integrationResult.rows[0];
      log(`✅ Found active calendar integration: ID ${integration.id}`, 'green');
      
      // Update with new tokens
      let credentials = {};
      try {
        if (typeof integration.credentials === 'string') {
          credentials = JSON.parse(integration.credentials);
        } else if (integration.credentials) {
          credentials = integration.credentials;
        }
      } catch (e) {
        credentials = {};
      }
      
      // Set new tokens
      credentials.access_token = 'ya29.a0Aa7pCA-ak9EWG5yduqpzN_DwNY-IcPKnjmVZeEDH7F5_Ac2w3LNKol8f359zbWJjxH3h2-BpSa3f8WIvepXYmP5buFM5joUr-nRtiTP6OzbDLJ7yHxVrS9kYvKvDo1mDDH5eWjj-E-B6PkwG4yZ5VwnmJdKHEswJFJJ2MCrADEwBwUENWJlY_7cPjWPmb7yovx9hRgMaCgYKAaASARcSFQHGX2MiwKL9C1oR5CWIBUWJ4M5qaA0206';
      credentials.refresh_token = '1//04VCrzcFcNC6_CgYIARAAGAQSNwF-L9Irb3bgvQ2N5hOyB0qakxUhnfsnJrrfjYjVq20Bzl7qpMXOoOFz_MWjkrToh2j3YKDQXDs';
      credentials.client_id = '407408718192.apps.googleusercontent.com';
      credentials.calendar_id = credentials.calendar_id || 'primary';
      
      await pool.query(
        'UPDATE integrations SET credentials = $1, is_active = true WHERE id = $2',
        [JSON.stringify(credentials), integration.id]
      );
      log(`✅ Updated calendar integration ${integration.id} with new tokens`, 'green');
      
      // Update agent to use this integration
      await pool.query(
        'UPDATE ai_agents SET calendar_integration_id = $1 WHERE id = 7',
        [integration.id]
      );
      log(`✅ Updated agent 7 to use calendar integration ${integration.id}`, 'green');
      
      return integration.id;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return null;
  }
}

async function fixEHRSyncSQL() {
  log('\n🔧 Fix 2: EHR Sync SQL Error', 'cyan');
  
  try {
    // Read the file
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../services/appointmentSyncService.js');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix the SQL query - use separate queries instead of CASE/WHEN
    const oldQuery = `SELECT e.*, 
                CASE WHEN e.connector_type = 'hl7' THEN h.*
                     WHEN e.connector_type = 'fhir' THEN f.*
                END as connector
         FROM ehr_systems e
         LEFT JOIN hl7_connectors h ON e.connector_id = h.id AND e.connector_type = 'hl7'
         LEFT JOIN fhir_connectors f ON e.connector_id = f.id AND e.connector_type = 'fhir'
         WHERE e.organization_id = $1 AND e.is_active = true
         LIMIT 1`;
    
    const newQuery = `SELECT e.*, 
                h.id as hl7_connector_id, h.host as hl7_host, h.port as hl7_port, h.facility as hl7_facility,
                f.id as fhir_connector_id, f.base_url as fhir_base_url, f.client_id as fhir_client_id
         FROM ehr_systems e
         LEFT JOIN hl7_connectors h ON e.connector_id = h.id AND e.connector_type = 'hl7'
         LEFT JOIN fhir_connectors f ON e.connector_id = f.id AND e.connector_type = 'fhir'
         WHERE e.organization_id = $1 AND e.is_active = true
         LIMIT 1`;
    
    if (content.includes(oldQuery)) {
      content = content.replace(oldQuery, newQuery);
      fs.writeFileSync(filePath, content, 'utf8');
      log(`✅ Fixed SQL query in appointmentSyncService.js`, 'green');
      return true;
    } else {
      log(`⚠️  SQL query not found in expected format`, 'yellow');
      // Try to find and fix it anyway
      const regex = /CASE\s+WHEN\s+e\.connector_type\s*=\s*'hl7'\s+THEN\s+h\.\*\s+WHEN\s+e\.connector_type\s*=\s*'fhir'\s+THEN\s+f\.\*/s;
      if (regex.test(content)) {
        content = content.replace(regex, `h.id as hl7_connector_id, h.host as hl7_host, h.port as hl7_port, h.facility as hl7_facility,
                f.id as fhir_connector_id, f.base_url as fhir_base_url, f.client_id as fhir_client_id`);
        fs.writeFileSync(filePath, content, 'utf8');
        log(`✅ Fixed SQL query (regex match)`, 'green');
        return true;
      }
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function fixAgentSystemPrompt() {
  log('\n🔧 Fix 3: Update Agent System Prompt', 'cyan');
  
  try {
    const newPrompt = `You are a professional front desk assistant for a medical practice. Help patients with appointment scheduling, general inquiries, and routing calls appropriately. IMPORTANT: When a patient wants to book, schedule, or make an appointment, you MUST use the book_appointment function IMMEDIATELY when you have: (1) patient name, (2) appointment date/time. You do NOT need date of birth or doctor name to book - those are optional. If the patient provides their name and a date/time, call book_appointment right away. Do not ask for unnecessary information. Phone number and email are helpful but not required.`;
    
    await pool.query(
      'UPDATE ai_agents SET system_prompt = $1 WHERE id = 7',
      [newPrompt]
    );
    
    log(`✅ Updated agent 7 system prompt`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testFixes() {
  log('\n🧪 Testing Fixes...', 'cyan');
  
  try {
    // Test 1: Check calendar integration
    const agentResult = await pool.query(
      'SELECT id, name, calendar_integration_id FROM ai_agents WHERE id = 7'
    );
    const agent = agentResult.rows[0];
    
    if (agent.calendar_integration_id) {
      const integrationResult = await pool.query(
        'SELECT id, is_active FROM integrations WHERE id = $1',
        [agent.calendar_integration_id]
      );
      
      if (integrationResult.rows.length > 0 && integrationResult.rows[0].is_active) {
        log(`✅ Calendar integration linked correctly: ID ${agent.calendar_integration_id}`, 'green');
      } else {
        log(`❌ Calendar integration ${agent.calendar_integration_id} not found or inactive`, 'red');
        return false;
      }
    } else {
      log(`❌ Agent has no calendar integration linked`, 'red');
      return false;
    }
    
    // Test 2: Check system prompt
    if (agent.system_prompt && agent.system_prompt.includes('book_appointment function IMMEDIATELY')) {
      log(`✅ Agent system prompt updated correctly`, 'green');
    } else {
      log(`⚠️  Agent system prompt may not be updated`, 'yellow');
    }
    
    // Test 3: Check SQL file
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../services/appointmentSyncService.js');
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (!content.includes("CASE WHEN e.connector_type = 'hl7' THEN h.*")) {
      log(`✅ SQL query fixed`, 'green');
    } else {
      log(`❌ SQL query still has error`, 'red');
      return false;
    }
    
    return true;
  } catch (error) {
    log(`❌ Test error: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('\n🚀 Fixing All Issues\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // Fix 1: Calendar Integration
  const calendarFixed = await fixCalendarIntegration();
  
  // Fix 2: EHR SQL
  const ehrFixed = await fixEHRSyncSQL();
  
  // Fix 3: Agent Prompt
  const promptFixed = await fixAgentSystemPrompt();
  
  // Test all fixes
  const allFixed = await testFixes();
  
  if (allFixed && calendarFixed && ehrFixed && promptFixed) {
    log('\n✅ All fixes applied successfully!', 'green');
    log('\n📝 Next: Restart backend and test', 'cyan');
    log('   On EC2: pm2 restart ehealth-backend', 'blue');
  } else {
    log('\n⚠️  Some fixes may not have been applied correctly', 'yellow');
  }
}

main()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    pool.end();
    process.exit(1);
  });
