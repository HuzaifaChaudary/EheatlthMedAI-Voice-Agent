/**
 * Fix Phone Number 404-738-7870 Configuration
 * Adds phone number to database, links to agent, and configures Twilio webhook
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const twilio = require('twilio');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://ehealthmedai:str0ng@localhost:5432/ehealthmedai'
});

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const API_URL = process.env.API_URL || process.env.FRONTEND_URL || 'https://ehealthmed.ai';

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

async function fixPhoneNumber() {
  log('\n🔧 Fixing Phone Number 404-738-7870 Configuration\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const targetPhone = '+14047387870'; // E.164 format
  
  try {
    // Step 1: Check if phone number exists in database
    log('\n📋 Step 1: Checking database...', 'cyan');
    let phoneResult = await pool.query(
      `SELECT * FROM phone_numbers 
       WHERE phone_number = $1 
       OR phone_number LIKE '%4047387870%'
       OR phone_number LIKE '%404-738-7870%'`,
      [targetPhone]
    );
    
    let phoneNumber;
    
    if (phoneResult.rows.length === 0) {
      log('⚠️  Phone number not found in database', 'yellow');
      
      // Step 2: Find phone number in Twilio
      log('\n📋 Step 2: Finding phone number in Twilio...', 'cyan');
      const twilioNumbers = await client.incomingPhoneNumbers.list();
      const twilioNumber = twilioNumbers.find(n => 
        n.phoneNumber === targetPhone || 
        n.phoneNumber.replace(/\D/g, '') === '14047387870'
      );
      
      if (!twilioNumber) {
        log('❌ Phone number not found in Twilio account', 'red');
        log('   Please verify the number exists in your Twilio account', 'yellow');
        return false;
      }
      
      log(`✅ Found in Twilio: ${twilioNumber.phoneNumber} (SID: ${twilioNumber.sid})`, 'green');
      
      // Step 3: Get organization
      const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
      const organizationId = orgResult.rows[0]?.id;
      
      if (!organizationId) {
        log('❌ No organization found', 'red');
        return false;
      }
      
      // Step 4: Add phone number to database
      log('\n📋 Step 3: Adding phone number to database...', 'cyan');
      const insertResult = await pool.query(
        `INSERT INTO phone_numbers (
          organization_id, phone_number, provider, provider_sid,
          capabilities, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          organizationId,
          targetPhone,
          'twilio',
          twilioNumber.sid,
          JSON.stringify({ voice: true, sms: true }),
          true
        ]
      );
      
      phoneNumber = insertResult.rows[0];
      log(`✅ Phone number added to database: ${phoneNumber.phone_number} (ID: ${phoneNumber.id})`, 'green');
    } else {
      phoneNumber = phoneResult.rows[0];
      log(`✅ Phone number found in database: ${phoneNumber.phone_number} (ID: ${phoneNumber.id})`, 'green');
      
      // Update if needed
      if (!phoneNumber.is_active) {
        await pool.query('UPDATE phone_numbers SET is_active = true WHERE id = $1', [phoneNumber.id]);
        log(`✅ Activated phone number`, 'green');
      }
    }
    
    // Step 5: Link to Front Desk agent
    log('\n📋 Step 4: Linking to Front Desk agent...', 'cyan');
    const agentResult = await pool.query(
      `SELECT * FROM ai_agents 
       WHERE (name ILIKE '%front desk%' OR type ILIKE '%front_desk%')
       AND is_active = true
       ORDER BY id
       LIMIT 1`
    );
    
    if (agentResult.rows.length === 0) {
      log('❌ Front Desk agent not found', 'red');
      return false;
    }
    
    const agent = agentResult.rows[0];
    log(`✅ Found Front Desk agent: ${agent.name} (ID: ${agent.id})`, 'green');
    
    // Check if already linked
    if (agent.phone_number_id === phoneNumber.id) {
      log(`✅ Phone number already linked to agent`, 'green');
    } else {
      await pool.query(
        'UPDATE ai_agents SET phone_number_id = $1 WHERE id = $2',
        [phoneNumber.id, agent.id]
      );
      log(`✅ Linked phone number to agent`, 'green');
    }
    
    // Step 6: Configure Twilio webhook
    log('\n📋 Step 5: Configuring Twilio webhook...', 'cyan');
    const webhookUrl = `${API_URL}/api/telephony/twilio/inbound`;
    
    try {
      const twilioNumber = await client.incomingPhoneNumbers(phoneNumber.provider_sid).update({
        voiceUrl: webhookUrl,
        voiceMethod: 'POST',
        statusCallback: `${API_URL}/api/telephony/twilio/status`,
        statusCallbackMethod: 'POST'
      });
      
      log(`✅ Twilio webhook configured: ${webhookUrl}`, 'green');
      log(`   Voice URL: ${twilioNumber.voiceUrl}`, 'blue');
      log(`   Status Callback: ${twilioNumber.statusCallback}`, 'blue');
    } catch (twilioError) {
      log(`⚠️  Could not update Twilio webhook: ${twilioError.message}`, 'yellow');
      log(`   Please manually set webhook in Twilio Console:`, 'yellow');
      log(`   URL: ${webhookUrl}`, 'yellow');
    }
    
    // Step 7: Verify configuration
    log('\n📋 Step 6: Verifying configuration...', 'cyan');
    
    const verifyPhone = await pool.query(
      'SELECT * FROM phone_numbers WHERE id = $1',
      [phoneNumber.id]
    );
    
    const verifyAgent = await pool.query(
      'SELECT * FROM ai_agents WHERE id = $1',
      [agent.id]
    );
    
    if (verifyPhone.rows[0].is_active && verifyAgent.rows[0].phone_number_id === phoneNumber.id) {
      log(`✅ Configuration verified!`, 'green');
      log(`\n📊 Summary:`, 'cyan');
      log(`   Phone Number: ${phoneNumber.phone_number} (ID: ${phoneNumber.id})`, 'blue');
      log(`   Agent: ${agent.name} (ID: ${agent.id})`, 'blue');
      log(`   Webhook: ${webhookUrl}`, 'blue');
      log(`\n✅ Phone number 404-738-7870 is now properly configured!`, 'green');
      return true;
    } else {
      log(`❌ Configuration verification failed`, 'red');
      return false;
    }
    
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    console.error(error);
    return false;
  }
}

fixPhoneNumber()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    pool.end();
    process.exit(1);
  });
