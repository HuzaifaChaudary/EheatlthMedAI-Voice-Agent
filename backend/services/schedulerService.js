const cron = require('node-cron');
const { cleanupRetentionData } = require('../scripts/cleanup-retention-data');
const { rotateExpiredKeys, rotateKeysBySchedule } = require('../scripts/rotate-encryption-keys');
const db = require('../config/database');
const webhookService = require('./webhookService');

class SchedulerService {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    console.log('Starting scheduled tasks...');

    // Daily data retention cleanup at 2 AM
    const retentionCleanup = cron.schedule('0 2 * * *', async () => {
      console.log('Running scheduled data retention cleanup...');
      try {
        await cleanupRetentionData();
        console.log('Data retention cleanup completed successfully');
      } catch (error) {
        console.error('Error in scheduled data retention cleanup:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // Daily encryption key rotation check at 3 AM
    const keyRotation = cron.schedule('0 3 * * *', async () => {
      console.log('Running scheduled encryption key rotation...');
      try {
        await rotateExpiredKeys();
        console.log('Encryption key rotation completed successfully');
      } catch (error) {
        console.error('Error in scheduled encryption key rotation:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // Weekly key rotation by schedule (every Sunday at 4 AM)
    const weeklyKeyRotation = cron.schedule('0 4 * * 0', async () => {
      console.log('Running weekly scheduled encryption key rotation...');
      try {
        await rotateKeysBySchedule();
        console.log('Weekly encryption key rotation completed successfully');
      } catch (error) {
        console.error('Error in weekly encryption key rotation:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // Daily BAA expiration check at 9 AM
    const baaExpirationCheck = cron.schedule('0 9 * * *', async () => {
      console.log('Running BAA expiration check...');
      try {
        await this.checkBAAExpirations();
        console.log('BAA expiration check completed successfully');
      } catch (error) {
        console.error('Error in BAA expiration check:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // Webhook retry job (every 5 minutes)
    const webhookRetry = cron.schedule('*/5 * * * *', async () => {
      console.log('Retrying failed webhooks...');
      try {
        await webhookService.retryFailedWebhooks(50);
        console.log('Webhook retry completed successfully');
      } catch (error) {
        console.error('Error retrying failed webhooks:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // Store job references
    this.jobs = [
      { name: 'retentionCleanup', job: retentionCleanup },
      { name: 'keyRotation', job: keyRotation },
      { name: 'weeklyKeyRotation', job: weeklyKeyRotation },
      { name: 'baaExpirationCheck', job: baaExpirationCheck },
      { name: 'webhookRetry', job: webhookRetry }
    ];

    // Start all jobs
    this.jobs.forEach(({ name, job }) => {
      job.start();
      console.log(`Started scheduled task: ${name}`);
    });

    this.isRunning = true;
    console.log('All scheduled tasks started');
  }

  stop() {
    if (!this.isRunning) {
      console.log('Scheduler is not running');
      return;
    }

    console.log('Stopping scheduled tasks...');
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      console.log(`Stopped scheduled task: ${name}`);
    });

    this.jobs = [];
    this.isRunning = false;
    console.log('All scheduled tasks stopped');
  }

  async checkBAAExpirations() {
    try {
      // Find BAAs expiring in the next 30 days
      const expiringBAAs = await db.query(`
        SELECT ba.*, o.name as organization_name
        FROM baa_agreements ba
        JOIN organizations o ON ba.organization_id = o.id
        WHERE ba.expiration_date IS NOT NULL
          AND ba.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
          AND ba.expiration_date > CURRENT_DATE
          AND ba.status IN ('signed', 'pending')
        ORDER BY ba.expiration_date ASC
      `);

      console.log(`Found ${expiringBAAs.rows.length} BAAs expiring soon`);

      for (const baa of expiringBAAs.rows) {
        const daysUntilExpiration = Math.ceil(
          (new Date(baa.expiration_date) - new Date()) / (1000 * 60 * 60 * 24)
        );

        // Log expiration warning
        await db.query(`
          INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          1,
          'BAA_EXPIRATION_WARNING',
          'baa_agreements',
          baa.id,
          JSON.stringify({
            vendor_name: baa.vendor_name,
            expiration_date: baa.expiration_date,
            days_until_expiration: daysUntilExpiration,
            organization_name: baa.organization_name
          })
        ]);

        // If expiring in 7 days or less, update status to 'expiring_soon'
        if (daysUntilExpiration <= 7) {
          await db.query(`
            UPDATE baa_agreements 
            SET status = 'expiring_soon',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [baa.id]);
        }
      }

      // Find expired BAAs
      const expiredBAAs = await db.query(`
        SELECT ba.*, o.name as organization_name
        FROM baa_agreements ba
        JOIN organizations o ON ba.organization_id = o.id
        WHERE ba.expiration_date IS NOT NULL
          AND ba.expiration_date < CURRENT_DATE
          AND ba.status != 'expired'
      `);

      console.log(`Found ${expiredBAAs.rows.length} expired BAAs`);

      for (const baa of expiredBAAs.rows) {
        await db.query(`
          UPDATE baa_agreements 
          SET status = 'expired',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [baa.id]);

        await db.query(`
          INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          1,
          'BAA_EXPIRED',
          'baa_agreements',
          baa.id,
          JSON.stringify({
            vendor_name: baa.vendor_name,
            expiration_date: baa.expiration_date,
            organization_name: baa.organization_name
          })
        ]);
      }
    } catch (error) {
      console.error('Error checking BAA expirations:', error);
      throw error;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      jobs: this.jobs.map(({ name, job }) => ({
        name,
        running: job.running || false
      }))
    };
  }
}

module.exports = new SchedulerService();

