/**
 * Migration Script: Add organization_id to conversations table
 * 
 * This script adds the organization_id column to the conversations table
 * for multi-tenancy support. It's safe to run multiple times.
 * 
 * Usage: node backend/scripts/add-organization-id-to-conversations.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function addOrganizationIdColumn() {
  try {
    console.log('🔄 Adding organization_id column to conversations table...\n');

    // Check if column exists
    const checkResult = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'conversations' 
      AND column_name = 'organization_id'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ organization_id column already exists in conversations table');
      return;
    }

    // Add organization_id column
    console.log('📝 Adding organization_id column...');
    await db.query(`
      ALTER TABLE conversations 
      ADD COLUMN organization_id INTEGER REFERENCES organizations(id)
    `);
    console.log('✅ Added organization_id column');

    // Create index
    console.log('📝 Creating index...');
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_organization_id 
      ON conversations(organization_id)
    `);
    console.log('✅ Created index');

    // Update existing conversations to have organization_id based on user's organization
    console.log('📝 Updating existing conversations...');
    const updateResult = await db.query(`
      UPDATE conversations c
      SET organization_id = u.organization_id
      FROM users u
      WHERE c.user_id = u.id 
      AND c.organization_id IS NULL
      AND u.organization_id IS NOT NULL
    `);
    console.log(`✅ Updated ${updateResult.rowCount} existing conversations`);

    // Update conversations based on agent's organization
    const updateAgentResult = await db.query(`
      UPDATE conversations c
      SET organization_id = a.organization_id
      FROM ai_agents a
      WHERE c.agent_id = a.id 
      AND c.organization_id IS NULL
      AND a.organization_id IS NOT NULL
    `);
    console.log(`✅ Updated ${updateAgentResult.rowCount} conversations via agents`);

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

addOrganizationIdColumn();

