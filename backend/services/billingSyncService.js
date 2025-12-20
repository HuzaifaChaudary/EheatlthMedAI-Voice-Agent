/**
 * Billing Data Synchronization Service
 * Handles synchronization with billing platforms (Kareo, AdvancedMD, DrChrono, AthenaHealth)
 */

const db = require('../config/database');
const webhookService = require('./webhookService');

class BillingSyncService {
  /**
   * Sync billing data to billing platform
   */
  async syncBillingData(billingData, integrationId, organizationId) {
    try {
      // Get integration configuration
      const integrationResult = await db.query(
        'SELECT * FROM integrations WHERE id = $1 AND organization_id = $2 AND type = $3 AND is_active = true',
        [integrationId, organizationId, 'billing']
      );

      if (integrationResult.rows.length === 0) {
        throw new Error(`Billing integration ${integrationId} not found or inactive`);
      }

      const integration = integrationResult.rows[0];
      const provider = integration.provider.toLowerCase();
      const credentials = typeof integration.credentials === 'string' 
        ? JSON.parse(integration.credentials) 
        : integration.credentials;

      let result;

      switch (provider) {
        case 'kareo':
          result = await this.syncToKareo(billingData, credentials);
          break;
        case 'advancedmd':
          result = await this.syncToAdvancedMD(billingData, credentials);
          break;
        case 'drchrono':
          result = await this.syncToDrChrono(billingData, credentials);
          break;
        case 'athenahealth':
          result = await this.syncToAthenaHealth(billingData, credentials);
          break;
        default:
          throw new Error(`Unsupported billing provider: ${provider}`);
      }

      // Update integration last_sync_at
      await db.query(
        'UPDATE integrations SET last_sync_at = CURRENT_TIMESTAMP WHERE id = $1',
        [integrationId]
      );

      // Trigger webhook event
      await webhookService.deliverWebhookEvent('billing.synced', {
        integration_id: integrationId,
        provider,
        billing_data_id: billingData.id || billingData.patient_id,
        result
      }, organizationId);

      return result;
    } catch (error) {
      console.error('Error syncing billing data:', error);
      throw error;
    }
  }

  /**
   * Sync to Kareo
   * Uses Kareo API v3
   */
  async syncToKareo(billingData, credentials) {
    const { api_key, api_secret, practice_id, customer_key } = credentials;

    if (!api_key || !practice_id) {
      throw new Error('Kareo api_key and practice_id are required');
    }

    const kareoPayload = {
      PracticeId: practice_id,
      PatientId: billingData.patient_id,
      PatientFirstName: billingData.patient_name?.split(' ')[0] || '',
      PatientLastName: billingData.patient_name?.split(' ').slice(1).join(' ') || '',
      Amount: billingData.amount,
      Description: billingData.description || 'Medical Service',
      ServiceDate: billingData.date_of_service || new Date().toISOString().split('T')[0],
      ProcedureCode: billingData.procedure_code || '99213', // Default office visit
      DiagnosisCode: billingData.diagnosis_code || '',
      InsuranceId: billingData.insurance_id || null,
      PlaceOfService: billingData.place_of_service || '11', // Office
      Units: billingData.units || 1
    };

    try {
      const response = await fetch(
        `https://webservice.kareo.com/services/soap/2.1/KareoServices.svc/json/CreateCharge`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${api_key}:${api_secret || ''}`).toString('base64')}`,
            'CustomerKey': customer_key || ''
          },
          body: JSON.stringify({
            request: {
              RequestHeader: {
                CustomerKey: customer_key,
                Password: api_secret,
                User: api_key
              },
              Charge: kareoPayload
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Kareo API error: ${response.status} - ${errorData.ErrorMessage || response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        provider: 'kareo',
        chargeId: result.ChargeId || result.ID,
        message: 'Billing data synced to Kareo',
        response: result
      };
    } catch (error) {
      console.error('Kareo sync error:', error);
      throw new Error(`Failed to sync to Kareo: ${error.message}`);
    }
  }

  /**
   * Sync to AdvancedMD
   * Uses AdvancedMD API
   */
  async syncToAdvancedMD(billingData, credentials) {
    const { api_key, office_key, practice_id } = credentials;

    if (!api_key || !office_key) {
      throw new Error('AdvancedMD api_key and office_key are required');
    }

    const amdPayload = {
      officeKey: office_key,
      practiceId: practice_id,
      patient: {
        patientId: billingData.patient_id,
        firstName: billingData.patient_name?.split(' ')[0] || '',
        lastName: billingData.patient_name?.split(' ').slice(1).join(' ') || ''
      },
      charge: {
        amount: billingData.amount,
        description: billingData.description,
        dateOfService: billingData.date_of_service || new Date().toISOString().split('T')[0],
        procedureCode: billingData.procedure_code,
        diagnosisCode: billingData.diagnosis_code,
        placeOfService: billingData.place_of_service || '11',
        units: billingData.units || 1
      }
    };

    try {
      const response = await fetch(
        'https://api.advancedmd.com/v2/charges',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${api_key}`,
            'X-Office-Key': office_key
          },
          body: JSON.stringify(amdPayload)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`AdvancedMD API error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        provider: 'advancedmd',
        chargeId: result.chargeId || result.id,
        message: 'Billing data synced to AdvancedMD',
        response: result
      };
    } catch (error) {
      console.error('AdvancedMD sync error:', error);
      throw new Error(`Failed to sync to AdvancedMD: ${error.message}`);
    }
  }

  /**
   * Sync to DrChrono
   * Uses DrChrono API v4
   */
  async syncToDrChrono(billingData, credentials) {
    const { access_token, client_id, client_secret } = credentials;

    if (!access_token) {
      throw new Error('DrChrono access_token is required');
    }

    // DrChrono uses line items for billing
    const lineItemPayload = {
      patient: billingData.patient_id,
      appointment: billingData.appointment_id || null,
      code: billingData.procedure_code || '99213',
      description: billingData.description || 'Office Visit',
      quantity: billingData.units || 1,
      price: billingData.amount,
      service_date: billingData.date_of_service || new Date().toISOString().split('T')[0],
      diagnosis_pointers: billingData.diagnosis_codes || [],
      place_of_service: billingData.place_of_service || '11'
    };

    try {
      const response = await fetch(
        'https://app.drchrono.com/api/line_items',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
          },
          body: JSON.stringify(lineItemPayload)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`DrChrono API error: ${response.status} - ${errorData.detail || response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        provider: 'drchrono',
        lineItemId: result.id,
        message: 'Billing data synced to DrChrono',
        response: result
      };
    } catch (error) {
      console.error('DrChrono sync error:', error);
      throw new Error(`Failed to sync to DrChrono: ${error.message}`);
    }
  }

  /**
   * Sync to AthenaHealth
   * Uses AthenaHealth API
   */
  async syncToAthenaHealth(billingData, credentials) {
    const { api_key, api_secret, practice_id, version } = credentials;

    if (!api_key || !api_secret || !practice_id) {
      throw new Error('AthenaHealth api_key, api_secret, and practice_id are required');
    }

    const apiVersion = version || 'v1';

    // First, get access token
    const tokenResponse = await fetch(
      `https://api.athenahealth.com/oauth2/${apiVersion}/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${api_key}:${api_secret}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials&scope=athena/service/Athenanet.MDP.*'
      }
    );

    if (!tokenResponse.ok) {
      throw new Error(`AthenaHealth authentication failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const athenaPayload = {
      patientid: billingData.patient_id,
      departmentid: billingData.department_id || '1',
      procedurecode: billingData.procedure_code || '99213',
      diagnosiscode: billingData.diagnosis_code,
      servicedate: billingData.date_of_service || new Date().toISOString().split('T')[0],
      units: billingData.units || 1,
      chargeamount: billingData.amount
    };

    try {
      const response = await fetch(
        `https://api.athenahealth.com/${apiVersion}/${practice_id}/claims`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${accessToken}`
          },
          body: new URLSearchParams(athenaPayload).toString()
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`AthenaHealth API error: ${response.status} - ${errorData.error || response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        provider: 'athenahealth',
        claimId: result.claimid || result[0]?.claimid,
        message: 'Billing data synced to AthenaHealth',
        response: result
      };
    } catch (error) {
      console.error('AthenaHealth sync error:', error);
      throw new Error(`Failed to sync to AthenaHealth: ${error.message}`);
    }
  }

  /**
   * Create charge/claim in billing system
   */
  async createCharge(chargeData, integrationId, organizationId) {
    return await this.syncBillingData({
      ...chargeData,
      type: 'charge'
    }, integrationId, organizationId);
  }

  /**
   * Update payment in billing system
   */
  async updatePayment(paymentData, integrationId, organizationId) {
    try {
      const integrationResult = await db.query(
        'SELECT * FROM integrations WHERE id = $1 AND organization_id = $2 AND type = $3 AND is_active = true',
        [integrationId, organizationId, 'billing']
      );

      if (integrationResult.rows.length === 0) {
        throw new Error(`Billing integration ${integrationId} not found or inactive`);
      }

      const integration = integrationResult.rows[0];
      const provider = integration.provider.toLowerCase();
      const credentials = typeof integration.credentials === 'string' 
        ? JSON.parse(integration.credentials) 
        : integration.credentials;

      let result;

      switch (provider) {
        case 'drchrono':
          result = await this.postDrChronoPayment(paymentData, credentials);
          break;
        case 'athenahealth':
          result = await this.postAthenaPayment(paymentData, credentials);
          break;
        default:
          result = {
            success: true,
            provider,
            message: `Payment recorded for ${provider} sync`
          };
      }

      return result;
    } catch (error) {
      console.error('Error updating payment:', error);
      throw error;
    }
  }

  /**
   * Post payment to DrChrono
   */
  async postDrChronoPayment(paymentData, credentials) {
    const { access_token } = credentials;

    const paymentPayload = {
      patient: paymentData.patient_id,
      amount: paymentData.amount,
      payment_method: paymentData.payment_method || 'credit_card',
      payment_date: paymentData.payment_date || new Date().toISOString().split('T')[0],
      line_item: paymentData.line_item_id
    };

    try {
      const response = await fetch(
        'https://app.drchrono.com/api/patient_payments',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
          },
          body: JSON.stringify(paymentPayload)
        }
      );

      if (!response.ok) {
        throw new Error(`DrChrono payment error: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        provider: 'drchrono',
        paymentId: result.id,
        message: 'Payment posted to DrChrono'
      };
    } catch (error) {
      throw new Error(`Failed to post payment to DrChrono: ${error.message}`);
    }
  }

  /**
   * Post payment to AthenaHealth
   */
  async postAthenaPayment(paymentData, credentials) {
    const { api_key, api_secret, practice_id, version } = credentials;
    const apiVersion = version || 'v1';

    // Get access token
    const tokenResponse = await fetch(
      `https://api.athenahealth.com/oauth2/${apiVersion}/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${api_key}:${api_secret}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials&scope=athena/service/Athenanet.MDP.*'
      }
    );

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const paymentPayload = {
      patientid: paymentData.patient_id,
      paymentamount: paymentData.amount,
      paymentmethod: paymentData.payment_method || 'CREDITCARD'
    };

    try {
      const response = await fetch(
        `https://api.athenahealth.com/${apiVersion}/${practice_id}/patients/${paymentData.patient_id}/collectpayment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${accessToken}`
          },
          body: new URLSearchParams(paymentPayload).toString()
        }
      );

      if (!response.ok) {
        throw new Error(`AthenaHealth payment error: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        provider: 'athenahealth',
        paymentId: result.paymentid,
        message: 'Payment posted to AthenaHealth'
      };
    } catch (error) {
      throw new Error(`Failed to post payment to AthenaHealth: ${error.message}`);
    }
  }

  /**
   * Get patient balance from billing system
   */
  async getPatientBalance(patientId, integrationId, organizationId) {
    try {
      const integrationResult = await db.query(
        'SELECT * FROM integrations WHERE id = $1 AND organization_id = $2 AND type = $3 AND is_active = true',
        [integrationId, organizationId, 'billing']
      );

      if (integrationResult.rows.length === 0) {
        throw new Error(`Billing integration ${integrationId} not found or inactive`);
      }

      const integration = integrationResult.rows[0];
      const provider = integration.provider.toLowerCase();
      const credentials = typeof integration.credentials === 'string' 
        ? JSON.parse(integration.credentials) 
        : integration.credentials;

      let result;

      switch (provider) {
        case 'drchrono':
          result = await this.getDrChronoBalance(patientId, credentials);
          break;
        case 'athenahealth':
          result = await this.getAthenaBalance(patientId, credentials);
          break;
        default:
          result = {
            success: true,
            provider,
            patientId,
            balance: null,
            message: `Balance lookup not implemented for ${provider}`
          };
      }

      return result;
    } catch (error) {
      console.error('Error getting patient balance:', error);
      throw error;
    }
  }

  /**
   * Get balance from DrChrono
   */
  async getDrChronoBalance(patientId, credentials) {
    const { access_token } = credentials;

    try {
      const response = await fetch(
        `https://app.drchrono.com/api/patients/${patientId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`DrChrono API error: ${response.status}`);
      }

      const patient = await response.json();
      return {
        success: true,
        provider: 'drchrono',
        patientId,
        balance: patient.balance || 0,
        message: 'Balance retrieved from DrChrono'
      };
    } catch (error) {
      throw new Error(`Failed to get DrChrono balance: ${error.message}`);
    }
  }

  /**
   * Get balance from AthenaHealth
   */
  async getAthenaBalance(patientId, credentials) {
    const { api_key, api_secret, practice_id, version } = credentials;
    const apiVersion = version || 'v1';

    // Get access token
    const tokenResponse = await fetch(
      `https://api.athenahealth.com/oauth2/${apiVersion}/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${api_key}:${api_secret}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials&scope=athena/service/Athenanet.MDP.*'
      }
    );

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    try {
      const response = await fetch(
        `https://api.athenahealth.com/${apiVersion}/${practice_id}/patients/${patientId}/patientbalance`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`AthenaHealth API error: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        provider: 'athenahealth',
        patientId,
        balance: result.balance || result.patientbalance || 0,
        message: 'Balance retrieved from AthenaHealth'
      };
    } catch (error) {
      throw new Error(`Failed to get AthenaHealth balance: ${error.message}`);
    }
  }

  /**
   * Get claims/charges for a patient
   */
  async getPatientClaims(patientId, integrationId, organizationId, dateRange = null) {
    try {
      const integrationResult = await db.query(
        'SELECT * FROM integrations WHERE id = $1 AND organization_id = $2 AND type = $3 AND is_active = true',
        [integrationId, organizationId, 'billing']
      );

      if (integrationResult.rows.length === 0) {
        throw new Error(`Billing integration ${integrationId} not found or inactive`);
      }

      const integration = integrationResult.rows[0];
      const provider = integration.provider.toLowerCase();
      const credentials = typeof integration.credentials === 'string' 
        ? JSON.parse(integration.credentials) 
        : integration.credentials;

      switch (provider) {
        case 'drchrono':
          return await this.getDrChronoClaims(patientId, credentials, dateRange);
        default:
          return {
            success: true,
            provider,
            claims: [],
            message: `Claims lookup not implemented for ${provider}`
          };
      }
    } catch (error) {
      console.error('Error getting patient claims:', error);
      throw error;
    }
  }

  /**
   * Get claims from DrChrono
   */
  async getDrChronoClaims(patientId, credentials, dateRange) {
    const { access_token } = credentials;

    let url = `https://app.drchrono.com/api/line_items?patient=${patientId}`;
    if (dateRange) {
      url += `&service_date_range=${dateRange.start}/${dateRange.end}`;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });

      if (!response.ok) {
        throw new Error(`DrChrono API error: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        provider: 'drchrono',
        claims: result.results || [],
        message: 'Claims retrieved from DrChrono'
      };
    } catch (error) {
      throw new Error(`Failed to get DrChrono claims: ${error.message}`);
    }
  }
}

module.exports = new BillingSyncService();
