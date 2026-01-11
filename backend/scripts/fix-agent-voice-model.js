/**
 * Fix Agent Voice Model
 * Changes agent 7's voice_model from 'deepgram' to 'openai'
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixAgentVoiceModel() {
  console.log('🔧 Fixing agent voice model...');
  
  try {
    // Update agent to use openai
    const updateResult = await pool.query(
      "UPDATE ai_agents SET voice_model = 'openai' WHERE id = 7"
    );
    console.log('✅ Updated rows:', updateResult.rowCount);
    
    // Verify the change
    const selectResult = await pool.query(
      'SELECT id, name, voice_model FROM ai_agents WHERE id = 7'
    );
    console.log('📋 Agent after update:', selectResult.rows[0]);
    
    // Also update any NLU config to use openai
    const nluResult = await pool.query(
      "UPDATE nlu_configurations SET provider = 'openai' WHERE agent_id = 7"
    );
    console.log('✅ Updated NLU configs:', nluResult.rowCount);
    
    pool.end();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    pool.end();
    process.exit(1);
  }
}

fixAgentVoiceModel();

