const axios = require('axios');
const db = require('../config/database');

class GHLService {
    constructor() {
        this.baseUrl = 'https://services.leadconnectorhq.com';
        this.clientId = process.env.GHL_CLIENT_ID;
        this.clientSecret = process.env.GHL_CLIENT_SECRET;
        this.redirectUri = process.env.GHL_REDIRECT_URI; // e.g., https://api.ehealthmedai.com/api/integrations/ghl/callback
    }

    /**
     * Get OAuth2 Authorization URL
     */
    getAuthUrl(state) {
        const scopes = [
            'calendars.readonly',
            'calendars/events.write',
            'calendars/events.readonly'
        ].join(' '); // GHL uses space-separated scopes

        return `https://marketplace.leadconnectorhq.com/oauth/chooselocation?response_type=code&redirect_uri=${this.redirectUri}&client_id=${this.clientId}&scope=${scopes}&state=${state}`;
    }

    /**
     * Exchange Authorization Code for Tokens
     */
    async exchangeCodeForToken(code) {
        try {
            const response = await axios.post(`${this.baseUrl}/oauth/token`, {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: this.redirectUri,
                user_type: 'Location'
            }, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            return response.data;
        } catch (error) {
            console.error('GHL Token Exchange Error:', error.response?.data || error.message);
            throw new Error('Failed to exchange GHL code for token');
        }
    }

    /**
     * Refresh Access Token
     */
    async refreshAccessToken(refreshToken) {
        try {
            const response = await axios.post(`${this.baseUrl}/oauth/token`, {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                user_type: 'Location'
            }, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            return response.data;
        } catch (error) {
            console.error('GHL Token Refresh Error:', error.response?.data || error.message);
            throw new Error('Failed to refresh GHL token');
        }
    }

    /**
     * Get Valid Token for Organization
  1. Fetches credentials from DB
     2. Checks if expired, refreshes if needed
     3. Updates DB if refreshed
     */
    async getValidToken(organizationId) {
        const result = await db.query(
            "SELECT id, credentials FROM grm_integrations WHERE organization_id = $1 AND type = 'ghl' AND is_active = TRUE",
            [organizationId]
        );

        if (result.rows.length === 0) {
            throw new Error('No active GHL integration found for this organization');
        }

        let { credentials, id } = result.rows[0];

        // Naive expiry check - GHL tokens last 24h usually, assumes we stored 'expires_at' or 'created_at' + 'expires_in'
        // If credentials (JSON) has expires_in (seconds)
        const now = Date.now();
        const expiryTime = (credentials.created_at_ts || 0) + (credentials.expires_in * 1000);

        // Refresh if expired or expiring in 5 mins
        if (!credentials.access_token || now >= expiryTime - 300000) {
            console.log('Refreshing GHL Token for org:', organizationId);
            const newTokens = await this.refreshAccessToken(credentials.refresh_token);

            // Update DB
            const updatedCredentials = {
                ...newTokens,
                created_at_ts: Date.now()
            };

            await db.query(
                "UPDATE grm_integrations SET credentials = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
                [JSON.stringify(updatedCredentials), id]
            );

            return updatedCredentials.access_token;
        }

        return credentials.access_token;
    }

    /**
     * List Calendars
     */
    async listCalendars(organizationId) {
        const token = await this.getValidToken(organizationId);
        try {
            const response = await axios.get(`${this.baseUrl}/calendars/`, {
                headers: { Authorization: `Bearer ${token}`, Version: '2021-04-15' }
            });
            return response.data.calendars;
        } catch (error) {
            console.error('GHL List Calendars Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Check Availability (Free/Busy)
     * Note: GHL API specifics vary, this is a generalized implementation
     */
    async checkAvailability(organizationId, calendarId, startDate, endDate) {
        const token = await this.getValidToken(organizationId);
        try {
            // GHL often uses a POST to check slots
            const response = await axios.get(`${this.baseUrl}/calendars/${calendarId}/free-slots`, {
                params: { startDate, endDate }, // simplified params
                headers: { Authorization: `Bearer ${token}`, Version: '2021-04-15' }
            });
            return response.data;
        } catch (error) {
            console.error('GHL Check Availability Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Create Appointment
     */
    async createAppointment(organizationId, calendarId, appointmentData) {
        const token = await this.getValidToken(organizationId);
        try {
            const body = {
                calendarId,
                locationId: appointmentData.locationId, // Needed usually
                contactId: appointmentData.ghlContactId, // Prerequisite: Contact must exist in GHL
                startTime: appointmentData.startTime, // ISO string
                title: appointmentData.title,
            };

            const response = await axios.post(`${this.baseUrl}/calendars/events/appointments`, body, {
                headers: { Authorization: `Bearer ${token}`, Version: '2021-04-15' }
            });

            return response.data;
        } catch (error) {
            console.error('GHL Create Appt Error:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = new GHLService();
