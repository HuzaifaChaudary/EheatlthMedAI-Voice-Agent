/**
 * Webhook Service - Handles secure webhook delivery with retry logic and authentication
 */

const crypto = require('crypto');
const db = require('../config/database');

class WebhookService {
  constructor() {
    this.maxRetries = 3;
    this.retryDelays = [1000, 5000, 30000]; // 1s, 5s, 30s
    this.timeout = 30000; // 30 seconds
  }

  /**
   * Generate webhook signature for authentication
   */
  generateSignature(payload, secretKey) {
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  /**
   * Deliver webhook with retry logic
   */
  async deliverWebhook(webhookId, eventType, payload, organizationId = null) {
    try {
      // Get webhook configuration
      let webhookResult;
      if (organizationId) {
        webhookResult = await db.query(
          'SELECT * FROM webhooks WHERE id = $1 AND organization_id = $2 AND is_active = true',
          [webhookId, organizationId]
        );
      } else {
        webhookResult = await db.query(
          'SELECT * FROM webhooks WHERE id = $1 AND is_active = true',
          [webhookId]
        );
      }

      if (webhookResult.rows.length === 0) {
        throw new Error(`Webhook ${webhookId} not found or inactive`);
      }

      const webhook = webhookResult.rows[0];

      // Check if webhook subscribes to this event type
      if (!webhook.events || !webhook.events.includes(eventType)) {
        console.log(`Webhook ${webhookId} does not subscribe to event type ${eventType}`);
        return { success: false, skipped: true, reason: 'Event type not subscribed' };
      }

      // Prepare webhook payload
      const webhookPayload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload
      };

      // Generate signature
      const signature = this.generateSignature(webhookPayload, webhook.secret_key);

      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': eventType,
        'X-Webhook-Id': webhook.id.toString(),
        'User-Agent': 'EHealthMedAI-Webhook/1.0'
      };

      // Create webhook event record
      const eventResult = await db.query(
        `INSERT INTO webhook_events (webhook_id, organization_id, event_type, payload, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING id`,
        [webhookId, organizationId, eventType, JSON.stringify(webhookPayload)]
      );

      const eventId = eventResult.rows[0].id;

      // Attempt delivery with retry logic
      let lastError = null;
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.timeout);

          const response = await fetch(webhook.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(webhookPayload),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          const responseText = await response.text();
          let responseBody;
          try {
            responseBody = JSON.parse(responseText);
          } catch {
            responseBody = responseText;
          }

          // Update webhook event record
          await db.query(
            `UPDATE webhook_events 
             SET status = $1, response_code = $2, response_body = $3, processed_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [
              response.ok ? 'completed' : 'failed',
              response.status,
              typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody),
              eventId
            ]
          );

          // Update webhook last_triggered_at
          await db.query(
            'UPDATE webhooks SET last_triggered_at = CURRENT_TIMESTAMP WHERE id = $1',
            [webhookId]
          );

          if (response.ok) {
            return {
              success: true,
              eventId,
              statusCode: response.status,
              response: responseBody,
              attempt: attempt + 1
            };
          } else {
            lastError = new Error(`Webhook returned status ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          lastError = error;
          console.error(`Webhook delivery attempt ${attempt + 1} failed:`, error.message);

          // Update retry count and next retry time
          if (attempt < this.maxRetries) {
            const nextRetryAt = new Date(Date.now() + this.retryDelays[attempt]);
            await db.query(
              `UPDATE webhook_events 
               SET retry_count = $1, next_retry_at = $2, status = 'pending'
               WHERE id = $3`,
              [attempt + 1, nextRetryAt, eventId]
            );
          }

          // Wait before retry (except on last attempt)
          if (attempt < this.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, this.retryDelays[attempt]));
          }
        }
      }

      // All retries failed
      await db.query(
        `UPDATE webhook_events 
         SET status = 'failed', retry_count = $1
         WHERE id = $2`,
        [this.maxRetries + 1, eventId]
      );

      return {
        success: false,
        eventId,
        error: lastError.message,
        attempts: this.maxRetries + 1
      };
    } catch (error) {
      console.error('Error delivering webhook:', error);
      throw error;
    }
  }

  /**
   * Deliver webhook to all matching webhooks for an event type
   */
  async deliverWebhookEvent(eventType, payload, organizationId = null) {
    try {
      // Get all active webhooks that subscribe to this event type
      let webhooksResult;
      if (organizationId) {
        webhooksResult = await db.query(
          `SELECT id FROM webhooks 
           WHERE organization_id = $1 
           AND is_active = true 
           AND $2 = ANY(events)`,
          [organizationId, eventType]
        );
      } else {
        webhooksResult = await db.query(
          `SELECT id FROM webhooks 
           WHERE is_active = true 
           AND $1 = ANY(events)`,
          [eventType]
        );
      }

      const webhooks = webhooksResult.rows;
      const results = [];

      // Deliver to all matching webhooks
      for (const webhook of webhooks) {
        try {
          const result = await this.deliverWebhook(webhook.id, eventType, payload, organizationId);
          results.push({ webhookId: webhook.id, ...result });
        } catch (error) {
          results.push({
            webhookId: webhook.id,
            success: false,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error delivering webhook event:', error);
      throw error;
    }
  }

  /**
   * Retry failed webhook events
   */
  async retryFailedWebhooks(limit = 10) {
    try {
      const failedEvents = await db.query(
        `SELECT we.*, w.url, w.secret_key, w.organization_id
         FROM webhook_events we
         JOIN webhooks w ON we.webhook_id = w.id
         WHERE we.status = 'failed' 
         AND we.retry_count < $1
         AND (we.next_retry_at IS NULL OR we.next_retry_at <= CURRENT_TIMESTAMP)
         AND w.is_active = true
         ORDER BY we.created_at ASC
         LIMIT $2`,
        [this.maxRetries, limit]
      );

      const results = [];

      for (const event of failedEvents.rows) {
        try {
          const payload = typeof event.payload === 'string' 
            ? JSON.parse(event.payload) 
            : event.payload;

          const result = await this.deliverWebhook(
            event.webhook_id,
            event.event_type,
            payload.data || payload,
            event.organization_id
          );

          results.push({ eventId: event.id, ...result });
        } catch (error) {
          results.push({
            eventId: event.id,
            success: false,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error retrying failed webhooks:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature (for incoming webhooks)
   */
  verifySignature(payload, signature, secretKey) {
    try {
      const expectedSignature = this.generateSignature(payload, secretKey);
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      return false;
    }
  }
}

module.exports = new WebhookService();

