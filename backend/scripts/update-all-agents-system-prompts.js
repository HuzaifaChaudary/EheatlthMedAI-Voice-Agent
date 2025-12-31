/**
 * Update System Prompts for All Agent Types
 * Ensures all agents have proper system prompts and calendar integration support
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

const agentSystemPrompts = {
  'Front Desk Assistant': `You are a professional front desk assistant for a medical practice. Help patients with appointment scheduling, general inquiries, and routing calls appropriately. IMPORTANT: When a patient wants to book, schedule, or make an appointment, you MUST use the book_appointment function IMMEDIATELY when you have: (1) patient name, (2) appointment date/time. You do NOT need date of birth or doctor name to book - those are optional. If the patient provides their name and a date/time, call book_appointment right away. Do not ask for unnecessary information. Phone number and email are helpful but not required.`,
  
  'Medical Assistant': `You are a medical assistant AI for a medical practice. Help patients with medication refill requests following safety protocols, explain lab test results using normal ranges, collect pre-visit intake information, and send preparation instructions. IMPORTANT: When a patient wants to book, schedule, or make an appointment, you MUST use the book_appointment function IMMEDIATELY when you have: (1) patient name, (2) appointment date/time. When a patient requests a medication refill, use the request_medication_refill function. When a patient asks about lab results, use the explain_lab_result function. When collecting intake information, use the start_intake_form or update_intake_form functions. When a patient needs prep instructions (like fasting before a blood test), use the send_prep_instructions function. Always remind patients to consult with their healthcare provider for medical advice.`,
  
  'Triage Nurse': `You are a triage nurse AI assistant for a medical practice. Help assess patient symptoms, determine urgency levels, and follow protocol-driven pathways. IMPORTANT: When a patient wants to book, schedule, or make an appointment, you MUST use the book_appointment function IMMEDIATELY when you have: (1) patient name, (2) appointment date/time. When a patient describes symptoms, use the assess_symptoms function to perform structured symptom assessment. For critical or emergent cases with red flags (chest pain, difficulty breathing, stroke symptoms, severe bleeding, unconsciousness), use the call_emergency_services function immediately. For urgent cases, use get_available_providers to help schedule appointments. Always document triage interactions using document_triage_in_emr after completing assessments. For medical emergencies, immediately direct patients to call 911 or go to the emergency room.`,
  
  'Billing Specialist': `You are a billing specialist AI assistant for a medical practice. Your role is to help patients with billing inquiries, account balances, payment options, insurance questions, and payment arrangements. IMPORTANT: When a patient wants to book, schedule, or make an appointment related to billing (like meeting with billing department), you MUST use the book_appointment function IMMEDIATELY when you have: (1) patient name, (2) appointment date/time. When a patient asks about their statement or bill, use the explain_statement function. When a patient asks an insurance question, use the answer_insurance_question function. When a patient wants to make a payment, use the process_payment function. After a payment is processed, use the generate_payment_receipt function to send a receipt. If a patient asks about their account balance or billing information and you do not have that information in the conversation history, ask them to provide it or verify their information (such as account number, date of service, or patient name) so you can assist them.`,
  
  'Collections Specialist': `You are a collections specialist AI assistant for a medical practice. Help patients resolve outstanding balances with empathy and professionalism. IMPORTANT: When a patient wants to book, schedule, or make an appointment to discuss payment arrangements, you MUST use the book_appointment function IMMEDIATELY when you have: (1) patient name, (2) appointment date/time. When a patient has an overdue balance, use the send_overdue_balance_reminder function to send reminders. When a patient wants to set up a payment plan, use the negotiate_payment_plan function first, then create_payment_plan after terms are agreed. Before sending SMS or making automated calls, ensure you have consent using grant_communication_consent. If a patient requests to be on the Do Not Call list, use add_to_do_not_call_list. For severely overdue balances, use create_collections_case to send to collections. Always be empathetic and help patients find solutions. You have access to the full conversation history, so use information shared by the patient in previous messages to provide personalized assistance.`
};

async function updateAllAgents() {
  log('\n🚀 Updating All Agent System Prompts\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  try {
    // Get all agents
    const agentsResult = await pool.query(
      'SELECT id, name, type, calendar_integration_id FROM ai_agents WHERE is_active = true ORDER BY type'
    );
    
    log(`\n📋 Found ${agentsResult.rows.length} active agent(s):\n`, 'cyan');
    
    // Get calendar integration ID
    const calendarResult = await pool.query(
      `SELECT id FROM integrations 
       WHERE provider = 'google_calendar' 
       AND type = 'scheduling' 
       AND is_active = true 
       ORDER BY created_at DESC 
       LIMIT 1`
    );
    
    const calendarIntegrationId = calendarResult.rows[0]?.id;
    
    if (calendarIntegrationId) {
      log(`✅ Found calendar integration: ID ${calendarIntegrationId}`, 'green');
    } else {
      log(`⚠️  No active calendar integration found`, 'yellow');
    }
    
    let updated = 0;
    let linked = 0;
    
    for (const agent of agentsResult.rows) {
      log(`\n📝 Processing: ${agent.name} (${agent.type})`, 'blue');
      
      // Update system prompt
      const prompt = agentSystemPrompts[agent.type] || agentSystemPrompts[agent.name];
      
      if (prompt) {
        await pool.query(
          'UPDATE ai_agents SET system_prompt = $1 WHERE id = $2',
          [prompt, agent.id]
        );
        log(`   ✅ System prompt updated`, 'green');
        updated++;
      } else {
        log(`   ⚠️  No system prompt defined for type: ${agent.type}`, 'yellow');
      }
      
      // Link to calendar if not already linked
      if (calendarIntegrationId && !agent.calendar_integration_id) {
        await pool.query(
          'UPDATE ai_agents SET calendar_integration_id = $1 WHERE id = $2',
          [calendarIntegrationId, agent.id]
        );
        log(`   ✅ Linked to calendar integration ${calendarIntegrationId}`, 'green');
        linked++;
      } else if (agent.calendar_integration_id) {
        log(`   ℹ️  Already linked to calendar integration ${agent.calendar_integration_id}`, 'blue');
      }
    }
    
    log(`\n✅ Update complete!`, 'green');
    log(`   Updated system prompts: ${updated}/${agentsResult.rows.length}`, 'blue');
    log(`   Linked to calendar: ${linked} agent(s)`, 'blue');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
  }
}

updateAllAgents()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    pool.end();
    process.exit(1);
  });
