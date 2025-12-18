/**
 * CRM Service - Handles ticket creation and management
 * Supports Salesforce, HubSpot, and other CRM systems
 */

const db = require('../config/database');
const webhookService = require('./webhookService');

class CRMService {
  /**
   * Create ticket in CRM system
   */
  async createTicket(ticketData, integrationId, organizationId) {
    try {
      // Get integration configuration
      const integrationResult = await db.query(
        'SELECT * FROM integrations WHERE id = $1 AND organization_id = $2 AND type = $3 AND is_active = true',
        [integrationId, organizationId, 'crm']
      );

      if (integrationResult.rows.length === 0) {
        throw new Error(`CRM integration ${integrationId} not found or inactive`);
      }

      const integration = integrationResult.rows[0];
      const provider = integration.provider.toLowerCase();
      const credentials = typeof integration.credentials === 'string' 
        ? JSON.parse(integration.credentials) 
        : integration.credentials;

      let result;

      switch (provider) {
        case 'salesforce':
          result = await this.createSalesforceTicket(ticketData, credentials);
          break;
        case 'hubspot':
          result = await this.createHubSpotTicket(ticketData, credentials);
          break;
        case 'zendesk':
          result = await this.createZendeskTicket(ticketData, credentials);
          break;
        default:
          throw new Error(`Unsupported CRM provider: ${provider}`);
      }

      // Update integration last_sync_at
      await db.query(
        'UPDATE integrations SET last_sync_at = CURRENT_TIMESTAMP WHERE id = $1',
        [integrationId]
      );

      // Trigger webhook event
      await webhookService.deliverWebhookEvent('crm.ticket.created', {
        integration_id: integrationId,
        provider,
        ticket_id: result.ticketId,
        ticket_data: ticketData
      }, organizationId);

      return result;
    } catch (error) {
      console.error('Error creating CRM ticket:', error);
      throw error;
    }
  }

  /**
   * Create ticket in Salesforce
   */
  async createSalesforceTicket(ticketData, credentials) {
    // Note: This is a placeholder implementation
    // In production, you would use Salesforce REST API
    const { access_token, instance_url } = credentials;

    const salesforceCase = {
      Subject: ticketData.subject || 'Support Request',
      Description: ticketData.description || '',
      Status: 'New',
      Priority: ticketData.priority || 'Medium',
      Origin: 'Web',
      ContactId: ticketData.contact_id || null,
      AccountId: ticketData.account_id || null
    };

    // TODO: Implement actual Salesforce API integration
    // const response = await fetch(`${instance_url}/services/data/v57.0/sobjects/Case`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${access_token}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify(salesforceCase)
    // });
    // const result = await response.json();

    return {
      success: true,
      provider: 'salesforce',
      ticketId: `SF${Date.now()}`,
      message: 'Ticket created in Salesforce',
      // caseId: result.id
    };
  }

  /**
   * Create ticket in HubSpot
   */
  async createHubSpotTicket(ticketData, credentials) {
    // Note: This is a placeholder implementation
    // In production, you would use HubSpot API
    const { api_key } = credentials;

    const hubspotTicket = {
      name: ticketData.subject || 'Support Request',
      content: ticketData.description || '',
      hs_pipeline: ticketData.pipeline_id || 'default',
      hs_pipeline_stage: ticketData.stage_id || 'new',
      hubspot_owner_id: ticketData.owner_id || null
    };

    // TODO: Implement actual HubSpot API integration
    // const response = await fetch('https://api.hubapi.com/crm/v3/objects/tickets', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${api_key}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({ properties: hubspotTicket })
    // });
    // const result = await response.json();

    return {
      success: true,
      provider: 'hubspot',
      ticketId: `HS${Date.now()}`,
      message: 'Ticket created in HubSpot'
    };
  }

  /**
   * Create ticket in Zendesk
   */
  async createZendeskTicket(ticketData, credentials) {
    // Note: This is a placeholder implementation
    // In production, you would use Zendesk API
    const { subdomain, email, api_token } = credentials;

    const zendeskTicket = {
      ticket: {
        subject: ticketData.subject || 'Support Request',
        comment: {
          body: ticketData.description || ''
        },
        priority: ticketData.priority || 'normal',
        status: 'new',
        requester: {
          name: ticketData.requester_name || 'Patient',
          email: ticketData.requester_email || ''
        }
      }
    };

    // TODO: Implement actual Zendesk API integration
    // const auth = Buffer.from(`${email}/token:${api_token}`).toString('base64');
    // const response = await fetch(`https://${subdomain}.zendesk.com/api/v2/tickets.json`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${auth}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify(zendeskTicket)
    // });
    // const result = await response.json();

    return {
      success: true,
      provider: 'zendesk',
      ticketId: `ZD${Date.now()}`,
      message: 'Ticket created in Zendesk'
    };
  }

  /**
   * Update ticket in CRM system
   */
  async updateTicket(ticketId, updates, integrationId, organizationId) {
    try {
      const integrationResult = await db.query(
        'SELECT * FROM integrations WHERE id = $1 AND organization_id = $2 AND type = $3 AND is_active = true',
        [integrationId, organizationId, 'crm']
      );

      if (integrationResult.rows.length === 0) {
        throw new Error(`CRM integration ${integrationId} not found or inactive`);
      }

      const integration = integrationResult.rows[0];
      const provider = integration.provider.toLowerCase();
      const credentials = typeof integration.credentials === 'string' 
        ? JSON.parse(integration.credentials) 
        : integration.credentials;

      // TODO: Implement actual update logic for each provider
      return {
        success: true,
        provider,
        ticketId,
        message: `Ticket ${ticketId} updated in ${provider}`
      };
    } catch (error) {
      console.error('Error updating CRM ticket:', error);
      throw error;
    }
  }

  /**
   * Create ticket from conversation
   */
  async createTicketFromConversation(conversationId, ticketData, integrationId, organizationId) {
    try {
      // Get conversation details
      const conversationResult = await db.query(
        'SELECT * FROM conversations WHERE id = $1',
        [conversationId]
      );

      if (conversationResult.rows.length === 0) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      const conversation = conversationResult.rows[0];

      // Enhance ticket data with conversation information
      const enhancedTicketData = {
        ...ticketData,
        conversation_id: conversationId,
        patient_name: conversation.patient_name,
        patient_phone: conversation.patient_phone,
        subject: ticketData.subject || `Support Request - ${conversation.patient_name || 'Patient'}`,
        description: ticketData.description || `Support request from conversation ${conversationId}.\nPatient: ${conversation.patient_name || 'Unknown'}\nPhone: ${conversation.patient_phone || 'N/A'}`
      };

      return await this.createTicket(enhancedTicketData, integrationId, organizationId);
    } catch (error) {
      console.error('Error creating ticket from conversation:', error);
      throw error;
    }
  }
}

module.exports = new CRMService();

