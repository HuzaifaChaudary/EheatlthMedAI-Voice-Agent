/**
 * CRM Service - Handles ticket creation and management
 * Supports Salesforce, HubSpot, Zendesk, and other CRM systems
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
        case 'freshdesk':
          result = await this.createFreshdeskTicket(ticketData, credentials);
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
   * Uses Salesforce REST API
   */
  async createSalesforceTicket(ticketData, credentials) {
    const { access_token, instance_url, refresh_token, client_id, client_secret } = credentials;

    if (!access_token || !instance_url) {
      throw new Error('Salesforce access_token and instance_url are required');
    }

    const salesforceCase = {
      Subject: ticketData.subject || 'Support Request',
      Description: ticketData.description || '',
      Status: ticketData.status || 'New',
      Priority: this.mapPriorityToSalesforce(ticketData.priority),
      Origin: ticketData.origin || 'Web',
      Type: ticketData.type || 'Question',
      ContactId: ticketData.contact_id || null,
      AccountId: ticketData.account_id || null,
      SuppliedName: ticketData.requester_name || '',
      SuppliedEmail: ticketData.requester_email || '',
      SuppliedPhone: ticketData.requester_phone || ''
    };

    // Add custom fields if provided
    if (ticketData.custom_fields) {
      Object.assign(salesforceCase, ticketData.custom_fields);
    }

    try {
      const response = await fetch(
        `${instance_url}/services/data/v57.0/sobjects/Case`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(salesforceCase)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle token expiration
        if (response.status === 401 && refresh_token) {
          const newToken = await this.refreshSalesforceToken(credentials);
          if (newToken) {
            // Retry with new token
            return await this.createSalesforceTicket(ticketData, { ...credentials, access_token: newToken });
          }
        }
        
        throw new Error(`Salesforce API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();

      return {
        success: true,
        provider: 'salesforce',
        ticketId: result.id,
        caseNumber: result.CaseNumber,
        message: 'Ticket created in Salesforce',
        url: `${instance_url}/lightning/r/Case/${result.id}/view`
      };
    } catch (error) {
      console.error('Salesforce ticket creation error:', error);
      throw new Error(`Failed to create Salesforce ticket: ${error.message}`);
    }
  }

  /**
   * Refresh Salesforce access token
   */
  async refreshSalesforceToken(credentials) {
    const { refresh_token, client_id, client_secret } = credentials;

    try {
      const response = await fetch(
        'https://login.salesforce.com/services/oauth2/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id,
            client_secret,
            refresh_token
          }).toString()
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Failed to refresh Salesforce token:', error);
      return null;
    }
  }

  /**
   * Map priority to Salesforce format
   */
  mapPriorityToSalesforce(priority) {
    const mapping = {
      'low': 'Low',
      'medium': 'Medium',
      'high': 'High',
      'urgent': 'High',
      'critical': 'High'
    };
    return mapping[priority?.toLowerCase()] || 'Medium';
  }

  /**
   * Create ticket in HubSpot
   * Uses HubSpot CRM API v3
   */
  async createHubSpotTicket(ticketData, credentials) {
    const { api_key, access_token } = credentials;

    const authToken = access_token || api_key;
    if (!authToken) {
      throw new Error('HubSpot api_key or access_token is required');
    }

    const hubspotTicket = {
      properties: {
        subject: ticketData.subject || 'Support Request',
        content: ticketData.description || '',
        hs_pipeline: ticketData.pipeline_id || '0',
        hs_pipeline_stage: ticketData.stage_id || '1',
        hs_ticket_priority: this.mapPriorityToHubSpot(ticketData.priority),
        source_type: ticketData.source || 'WEB',
        hs_ticket_category: ticketData.category || null
      }
    };

    // Add owner if specified
    if (ticketData.owner_id) {
      hubspotTicket.properties.hubspot_owner_id = ticketData.owner_id;
    }

    try {
      const response = await fetch(
        'https://api.hubapi.com/crm/v3/objects/tickets',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(hubspotTicket)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HubSpot API error: ${response.status} - ${errorData.message || JSON.stringify(errorData)}`);
      }

      const result = await response.json();

      // Associate with contact if email provided
      if (ticketData.requester_email && result.id) {
        await this.associateHubSpotTicketWithContact(authToken, result.id, ticketData.requester_email);
      }

      return {
        success: true,
        provider: 'hubspot',
        ticketId: result.id,
        message: 'Ticket created in HubSpot',
        url: `https://app.hubspot.com/contacts/tickets/${result.id}`
      };
    } catch (error) {
      console.error('HubSpot ticket creation error:', error);
      throw new Error(`Failed to create HubSpot ticket: ${error.message}`);
    }
  }

  /**
   * Associate HubSpot ticket with contact by email
   */
  async associateHubSpotTicketWithContact(authToken, ticketId, email) {
    try {
      // First, find the contact by email
      const searchResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts/search',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filterGroups: [{
              filters: [{
                propertyName: 'email',
                operator: 'EQ',
                value: email
              }]
            }]
          })
        }
      );

      if (searchResponse.ok) {
        const searchResult = await searchResponse.json();
        if (searchResult.results && searchResult.results.length > 0) {
          const contactId = searchResult.results[0].id;

          // Associate ticket with contact
          await fetch(
            `https://api.hubapi.com/crm/v3/objects/tickets/${ticketId}/associations/contacts/${contactId}/ticket_to_contact`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            }
          );
        }
      }
    } catch (error) {
      console.error('Failed to associate HubSpot ticket with contact:', error);
      // Don't throw - association is optional
    }
  }

  /**
   * Map priority to HubSpot format
   */
  mapPriorityToHubSpot(priority) {
    const mapping = {
      'low': 'LOW',
      'medium': 'MEDIUM',
      'high': 'HIGH',
      'urgent': 'HIGH',
      'critical': 'HIGH'
    };
    return mapping[priority?.toLowerCase()] || 'MEDIUM';
  }

  /**
   * Create ticket in Zendesk
   * Uses Zendesk API v2
   */
  async createZendeskTicket(ticketData, credentials) {
    const { subdomain, email, api_token, access_token } = credentials;

    if (!subdomain) {
      throw new Error('Zendesk subdomain is required');
    }

    let authHeader;
    if (access_token) {
      authHeader = `Bearer ${access_token}`;
    } else if (email && api_token) {
      authHeader = `Basic ${Buffer.from(`${email}/token:${api_token}`).toString('base64')}`;
    } else {
      throw new Error('Zendesk authentication credentials required (email+api_token or access_token)');
    }

    const zendeskTicket = {
      ticket: {
        subject: ticketData.subject || 'Support Request',
        comment: {
          body: ticketData.description || '',
          public: ticketData.public !== false
        },
        priority: this.mapPriorityToZendesk(ticketData.priority),
        status: ticketData.status || 'new',
        type: ticketData.type || 'question',
        requester: {
          name: ticketData.requester_name || 'Customer',
          email: ticketData.requester_email || ''
        },
        tags: ticketData.tags || [],
        custom_fields: ticketData.custom_fields || []
      }
    };

    // Add assignee if specified
    if (ticketData.assignee_id) {
      zendeskTicket.ticket.assignee_id = ticketData.assignee_id;
    }

    // Add group if specified
    if (ticketData.group_id) {
      zendeskTicket.ticket.group_id = ticketData.group_id;
    }

    try {
      const response = await fetch(
        `https://${subdomain}.zendesk.com/api/v2/tickets.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(zendeskTicket)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Zendesk API error: ${response.status} - ${errorData.error || JSON.stringify(errorData)}`);
      }

      const result = await response.json();

      return {
        success: true,
        provider: 'zendesk',
        ticketId: result.ticket.id,
        ticketUrl: result.ticket.url,
        message: 'Ticket created in Zendesk',
        url: `https://${subdomain}.zendesk.com/agent/tickets/${result.ticket.id}`
      };
    } catch (error) {
      console.error('Zendesk ticket creation error:', error);
      throw new Error(`Failed to create Zendesk ticket: ${error.message}`);
    }
  }

  /**
   * Map priority to Zendesk format
   */
  mapPriorityToZendesk(priority) {
    const mapping = {
      'low': 'low',
      'medium': 'normal',
      'high': 'high',
      'urgent': 'urgent',
      'critical': 'urgent'
    };
    return mapping[priority?.toLowerCase()] || 'normal';
  }

  /**
   * Create ticket in Freshdesk
   * Uses Freshdesk API v2
   */
  async createFreshdeskTicket(ticketData, credentials) {
    const { domain, api_key } = credentials;

    if (!domain || !api_key) {
      throw new Error('Freshdesk domain and api_key are required');
    }

    const freshdeskTicket = {
      subject: ticketData.subject || 'Support Request',
      description: ticketData.description || '',
      email: ticketData.requester_email,
      priority: this.mapPriorityToFreshdesk(ticketData.priority),
      status: 2, // Open
      source: 7, // Chat/Widget
      type: ticketData.type || 'Question',
      name: ticketData.requester_name || 'Customer',
      phone: ticketData.requester_phone || null
    };

    try {
      const response = await fetch(
        `https://${domain}.freshdesk.com/api/v2/tickets`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${api_key}:X`).toString('base64')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(freshdeskTicket)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Freshdesk API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();

      return {
        success: true,
        provider: 'freshdesk',
        ticketId: result.id,
        message: 'Ticket created in Freshdesk',
        url: `https://${domain}.freshdesk.com/a/tickets/${result.id}`
      };
    } catch (error) {
      console.error('Freshdesk ticket creation error:', error);
      throw new Error(`Failed to create Freshdesk ticket: ${error.message}`);
    }
  }

  /**
   * Map priority to Freshdesk format (1=Low, 2=Medium, 3=High, 4=Urgent)
   */
  mapPriorityToFreshdesk(priority) {
    const mapping = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'urgent': 4,
      'critical': 4
    };
    return mapping[priority?.toLowerCase()] || 2;
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

      let result;

      switch (provider) {
        case 'salesforce':
          result = await this.updateSalesforceTicket(ticketId, updates, credentials);
          break;
        case 'hubspot':
          result = await this.updateHubSpotTicket(ticketId, updates, credentials);
          break;
        case 'zendesk':
          result = await this.updateZendeskTicket(ticketId, updates, credentials);
          break;
        default:
          result = {
            success: true,
            provider,
            ticketId,
            message: `Ticket update not implemented for ${provider}`
          };
      }

      return result;
    } catch (error) {
      console.error('Error updating CRM ticket:', error);
      throw error;
    }
  }

  /**
   * Update Salesforce ticket
   */
  async updateSalesforceTicket(ticketId, updates, credentials) {
    const { access_token, instance_url } = credentials;

    try {
      const response = await fetch(
        `${instance_url}/services/data/v57.0/sobjects/Case/${ticketId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updates)
        }
      );

      if (!response.ok) {
        throw new Error(`Salesforce update error: ${response.status}`);
      }

      return {
        success: true,
        provider: 'salesforce',
        ticketId,
        message: 'Ticket updated in Salesforce'
      };
    } catch (error) {
      throw new Error(`Failed to update Salesforce ticket: ${error.message}`);
    }
  }

  /**
   * Update HubSpot ticket
   */
  async updateHubSpotTicket(ticketId, updates, credentials) {
    const { api_key, access_token } = credentials;
    const authToken = access_token || api_key;

    try {
      const response = await fetch(
        `https://api.hubapi.com/crm/v3/objects/tickets/${ticketId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ properties: updates })
        }
      );

      if (!response.ok) {
        throw new Error(`HubSpot update error: ${response.status}`);
      }

      return {
        success: true,
        provider: 'hubspot',
        ticketId,
        message: 'Ticket updated in HubSpot'
      };
    } catch (error) {
      throw new Error(`Failed to update HubSpot ticket: ${error.message}`);
    }
  }

  /**
   * Update Zendesk ticket
   */
  async updateZendeskTicket(ticketId, updates, credentials) {
    const { subdomain, email, api_token, access_token } = credentials;

    let authHeader;
    if (access_token) {
      authHeader = `Bearer ${access_token}`;
    } else {
      authHeader = `Basic ${Buffer.from(`${email}/token:${api_token}`).toString('base64')}`;
    }

    try {
      const response = await fetch(
        `https://${subdomain}.zendesk.com/api/v2/tickets/${ticketId}.json`,
        {
          method: 'PUT',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ticket: updates })
        }
      );

      if (!response.ok) {
        throw new Error(`Zendesk update error: ${response.status}`);
      }

      return {
        success: true,
        provider: 'zendesk',
        ticketId,
        message: 'Ticket updated in Zendesk'
      };
    } catch (error) {
      throw new Error(`Failed to update Zendesk ticket: ${error.message}`);
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
        requester_name: ticketData.requester_name || conversation.patient_name || 'Patient',
        requester_phone: ticketData.requester_phone || conversation.patient_phone,
        requester_email: ticketData.requester_email || conversation.patient_email,
        subject: ticketData.subject || `Support Request - ${conversation.patient_name || 'Patient'}`,
        description: ticketData.description || `Support request from conversation ${conversationId}.\n\nPatient: ${conversation.patient_name || 'Unknown'}\nPhone: ${conversation.patient_phone || 'N/A'}\nEmail: ${conversation.patient_email || 'N/A'}\n\nConversation ID: ${conversationId}`
      };

      return await this.createTicket(enhancedTicketData, integrationId, organizationId);
    } catch (error) {
      console.error('Error creating ticket from conversation:', error);
      throw error;
    }
  }

  /**
   * Get ticket status from CRM
   */
  async getTicketStatus(ticketId, integrationId, organizationId) {
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

      switch (provider) {
        case 'zendesk':
          return await this.getZendeskTicketStatus(ticketId, credentials);
        case 'hubspot':
          return await this.getHubSpotTicketStatus(ticketId, credentials);
        default:
          return {
            success: true,
            provider,
            ticketId,
            status: 'unknown',
            message: `Status lookup not implemented for ${provider}`
          };
      }
    } catch (error) {
      console.error('Error getting ticket status:', error);
      throw error;
    }
  }

  /**
   * Get Zendesk ticket status
   */
  async getZendeskTicketStatus(ticketId, credentials) {
    const { subdomain, email, api_token, access_token } = credentials;

    let authHeader;
    if (access_token) {
      authHeader = `Bearer ${access_token}`;
    } else {
      authHeader = `Basic ${Buffer.from(`${email}/token:${api_token}`).toString('base64')}`;
    }

    try {
      const response = await fetch(
        `https://${subdomain}.zendesk.com/api/v2/tickets/${ticketId}.json`,
        {
          method: 'GET',
          headers: {
            'Authorization': authHeader
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Zendesk API error: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        provider: 'zendesk',
        ticketId,
        status: result.ticket.status,
        priority: result.ticket.priority,
        subject: result.ticket.subject
      };
    } catch (error) {
      throw new Error(`Failed to get Zendesk ticket status: ${error.message}`);
    }
  }

  /**
   * Get HubSpot ticket status
   */
  async getHubSpotTicketStatus(ticketId, credentials) {
    const { api_key, access_token } = credentials;
    const authToken = access_token || api_key;

    try {
      const response = await fetch(
        `https://api.hubapi.com/crm/v3/objects/tickets/${ticketId}?properties=subject,hs_pipeline_stage,hs_ticket_priority`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HubSpot API error: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        provider: 'hubspot',
        ticketId,
        status: result.properties.hs_pipeline_stage,
        priority: result.properties.hs_ticket_priority,
        subject: result.properties.subject
      };
    } catch (error) {
      throw new Error(`Failed to get HubSpot ticket status: ${error.message}`);
    }
  }
}

module.exports = new CRMService();
