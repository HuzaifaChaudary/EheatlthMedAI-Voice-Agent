/**
 * Setup Google Calendar Integration
 * Creates a Google Calendar integration with provided credentials
 */

const db = require('../config/database');

async function setupGoogleCalendar() {
  try {
    console.log('📅 Setting up Google Calendar Integration...\n');

    // Google Calendar credentials
    const credentials = {
      access_token: 'ya29.a0Aa7pCA8F8ZB-YeXdbW-5uI_9XYB1LSDAjaFEzY8pRXbhuVwbVve0CUlCPxFlnTho-_Gfaj6OuX1jCSCV_o1BYjWWfLgc-FNtFzrYUC0oNdENckwsSsdIgJSrUrhMmcMABnV3rctW35mF4xG_WpmqNmc-uhwe7HRBYvrN-uGrOkeBfTWmNTks7wqWm2U1xlJKVIwxTxcaCgYKAX0SARcSFQHGX2Miy_Ae7l3UO6xl78D33822fg0206',
      refresh_token: '1//04N8Tb4bAblqwCgYIARAAGAQSNwF-L9IraZYykFTEuUDqAYoL2ISl5XPeczAgN43ufLlmnj3TWUwpA9iFpbhcnzkp4CEqt748fz8',
      client_id: '407408718192.apps.googleusercontent.com',
      client_secret: '', // Empty in provided credentials
      calendar_id: 'primary'
    };

    // Get all organizations
    const orgsResult = await db.query('SELECT id, name FROM organizations ORDER BY id');
    
    if (orgsResult.rows.length === 0) {
      console.log('⚠️  No organizations found. Creating integration without organization_id...');
      
      // Check if integration already exists
      const existingCheck = await db.query(
        `SELECT id, name, is_active, organization_id FROM integrations 
         WHERE provider = 'google_calendar' AND organization_id IS NULL`
      );

      if (existingCheck.rows.length > 0) {
        console.log('✅ Google Calendar integration already exists:');
        existingCheck.rows.forEach(int => {
          console.log(`   ID: ${int.id}, Name: ${int.name}, Active: ${int.is_active}, Org: ${int.organization_id || 'NULL'}`);
        });
        console.log('\n🔄 Updating existing integration...');
        
        await db.query(
          `UPDATE integrations 
           SET credentials = $1, is_active = true, updated_at = CURRENT_TIMESTAMP
           WHERE provider = 'google_calendar' AND organization_id IS NULL`,
          [JSON.stringify(credentials)]
        );
        console.log('✅ Integration updated successfully!\n');
      } else {
        // Create new integration
        const result = await db.query(
          `INSERT INTO integrations (organization_id, name, type, provider, credentials, is_active)
           VALUES (NULL, 'Google Calendar', 'scheduling', 'google_calendar', $1, true)
           RETURNING id, name, type, provider, is_active, created_at`,
          [JSON.stringify(credentials)]
        );
        console.log('✅ Google Calendar integration created successfully!');
        console.log(`   ID: ${result.rows[0].id}`);
        console.log(`   Name: ${result.rows[0].name}`);
        console.log(`   Active: ${result.rows[0].is_active}\n`);
      }
    } else {
      console.log(`📋 Found ${orgsResult.rows.length} organization(s):\n`);
      
      for (const org of orgsResult.rows) {
        console.log(`   Setting up for: ${org.name} (ID: ${org.id})`);
        
        // Check if integration already exists for this org
        const existingCheck = await db.query(
          `SELECT id, name, is_active FROM integrations 
           WHERE provider = 'google_calendar' AND organization_id = $1`,
          [org.id]
        );

        if (existingCheck.rows.length > 0) {
          console.log(`   ✅ Integration already exists (ID: ${existingCheck.rows[0].id})`);
          console.log(`   🔄 Updating...`);
          
          await db.query(
            `UPDATE integrations 
             SET credentials = $1, is_active = true, updated_at = CURRENT_TIMESTAMP
             WHERE provider = 'google_calendar' AND organization_id = $2`,
            [JSON.stringify(credentials), org.id]
          );
          console.log(`   ✅ Updated successfully!\n`);
        } else {
          // Create new integration
          const result = await db.query(
            `INSERT INTO integrations (organization_id, name, type, provider, credentials, is_active)
             VALUES ($1, 'Google Calendar', 'scheduling', 'google_calendar', $2, true)
             RETURNING id, name, type, provider, is_active, created_at`,
            [org.id, JSON.stringify(credentials)]
          );
          console.log(`   ✅ Created successfully! (ID: ${result.rows[0].id})\n`);
        }
      }
    }

    // Verify setup
    console.log('🔍 Verifying setup...\n');
    const verifyResult = await db.query(
      `SELECT id, name, type, provider, is_active, organization_id, created_at 
       FROM integrations 
       WHERE provider = 'google_calendar'
       ORDER BY organization_id NULLS LAST, created_at DESC`
    );

    console.log(`✅ Found ${verifyResult.rows.length} Google Calendar integration(s):\n`);
    verifyResult.rows.forEach(int => {
      const orgLabel = int.organization_id ? `Org ID: ${int.organization_id}` : 'No Organization';
      const status = int.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
      console.log(`   ${status} - ${int.name} (ID: ${int.id}, ${orgLabel})`);
    });

    console.log('\n✅ Google Calendar integration setup complete!\n');

  } catch (error) {
    console.error('❌ Error setting up Google Calendar integration:', error);
    process.exit(1);
  } finally {
    // Database connection is managed by the pool, no need to close
    process.exit(0);
  }
}

// Run the setup
setupGoogleCalendar();

