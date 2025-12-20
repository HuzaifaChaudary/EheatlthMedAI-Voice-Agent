/**
 * Security Incident Service
 * Handles creation, tracking, and management of security incidents
 */

const db = require('../config/database');

const INCIDENT_TYPES = {
    BRUTE_FORCE: 'brute_force',
    UNAUTHORIZED_ACCESS: 'unauthorized_access',
    DATA_BREACH: 'data_breach',
    SUSPICIOUS_ACTIVITY: 'suspicious_activity',
    RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
    INVALID_API_KEY: 'invalid_api_key',
    POLICY_VIOLATION: 'policy_violation'
};

const SEVERITY_LEVELS = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

const INCIDENT_STATUS = {
    OPEN: 'open',
    INVESTIGATING: 'investigating',
    RESOLVED: 'resolved',
    CLOSED: 'closed'
};

/**
 * Create a new security incident
 * @param {Object} incident - Incident details
 * @returns {Promise<Object>} Created incident
 */
const createIncident = async ({
    organizationId = null,
    incidentType,
    severity,
    sourceIp = null,
    userId = null,
    resourceType = null,
    resourceId = null,
    description,
    details = {}
}) => {
    const result = await db.query(
        `INSERT INTO security_incidents 
     (organization_id, incident_type, severity, source_ip, user_id, resource_type, resource_id, description, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
        [organizationId, incidentType, severity, sourceIp, userId, resourceType, resourceId, description, JSON.stringify(details)]
    );

    const incident = result.rows[0];

    // Auto-create initial response action for critical incidents
    if (severity === SEVERITY_LEVELS.CRITICAL) {
        await addIncidentResponse(incident.id, 'escalate', null, 'Auto-escalated due to critical severity');
    }

    return incident;
};

/**
 * Get incidents with filtering
 * @param {Object} filters - Filter options
 * @returns {Promise<Object[]>} List of incidents
 */
const getIncidents = async ({
    organizationId = null,
    incidentType = null,
    severity = null,
    status = null,
    startDate = null,
    endDate = null,
    limit = 50,
    offset = 0
} = {}) => {
    let query = `
    SELECT si.*, u.email as user_email
    FROM security_incidents si
    LEFT JOIN users u ON si.user_id = u.id
    WHERE 1=1
  `;
    const params = [];
    let paramIndex = 1;

    if (organizationId) {
        query += ` AND si.organization_id = $${paramIndex++}`;
        params.push(organizationId);
    }

    if (incidentType) {
        query += ` AND si.incident_type = $${paramIndex++}`;
        params.push(incidentType);
    }

    if (severity) {
        query += ` AND si.severity = $${paramIndex++}`;
        params.push(severity);
    }

    if (status) {
        query += ` AND si.status = $${paramIndex++}`;
        params.push(status);
    }

    if (startDate) {
        query += ` AND si.detected_at >= $${paramIndex++}`;
        params.push(startDate);
    }

    if (endDate) {
        query += ` AND si.detected_at <= $${paramIndex++}`;
        params.push(endDate);
    }

    query += ` ORDER BY si.detected_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
};

/**
 * Get a single incident by ID
 * @param {number} incidentId - Incident ID
 * @param {number} organizationId - Organization ID for verification
 * @returns {Promise<Object|null>} Incident with responses
 */
const getIncident = async (incidentId, organizationId = null) => {
    let query = `
    SELECT si.*, u.email as user_email, ru.email as resolved_by_email
    FROM security_incidents si
    LEFT JOIN users u ON si.user_id = u.id
    LEFT JOIN users ru ON si.resolved_by = ru.id
    WHERE si.id = $1
  `;
    const params = [incidentId];

    if (organizationId) {
        query += ' AND si.organization_id = $2';
        params.push(organizationId);
    }

    const incidentResult = await db.query(query, params);

    if (incidentResult.rows.length === 0) {
        return null;
    }

    // Get responses
    const responsesResult = await db.query(
        `SELECT ir.*, u.email as performed_by_email
     FROM incident_responses ir
     LEFT JOIN users u ON ir.performed_by = u.id
     WHERE ir.incident_id = $1
     ORDER BY ir.created_at ASC`,
        [incidentId]
    );

    return {
        ...incidentResult.rows[0],
        responses: responsesResult.rows
    };
};

/**
 * Update incident status
 * @param {number} incidentId - Incident ID
 * @param {string} status - New status
 * @param {number} updatedBy - User ID performing update
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Updated incident
 */
const updateIncidentStatus = async (incidentId, status, updatedBy = null, notes = null) => {
    const updates = { status, updated_at: 'CURRENT_TIMESTAMP' };

    if (status === INCIDENT_STATUS.RESOLVED || status === INCIDENT_STATUS.CLOSED) {
        updates.resolved_at = 'CURRENT_TIMESTAMP';
        updates.resolved_by = updatedBy;
        if (notes) {
            updates.resolution_notes = notes;
        }
    }

    const result = await db.query(
        `UPDATE security_incidents 
     SET status = $1, 
         resolved_at = ${status === INCIDENT_STATUS.RESOLVED || status === INCIDENT_STATUS.CLOSED ? 'CURRENT_TIMESTAMP' : 'resolved_at'},
         resolved_by = $2,
         resolution_notes = COALESCE($3, resolution_notes),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
        [status, updatedBy, notes, incidentId]
    );

    if (result.rows.length > 0) {
        await addIncidentResponse(incidentId, `status_change_${status}`, updatedBy, notes);
    }

    return result.rows[0];
};

/**
 * Add a response action to an incident
 * @param {number} incidentId - Incident ID
 * @param {string} actionType - Type of action
 * @param {number} performedBy - User ID
 * @param {string} notes - Action notes
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Created response
 */
const addIncidentResponse = async (incidentId, actionType, performedBy = null, notes = null, metadata = {}) => {
    const result = await db.query(
        `INSERT INTO incident_responses (incident_id, action_type, performed_by, notes, metadata, action_status)
     VALUES ($1, $2, $3, $4, $5, 'completed')
     RETURNING *`,
        [incidentId, actionType, performedBy, notes, JSON.stringify(metadata)]
    );

    return result.rows[0];
};

/**
 * Get incident statistics
 * @param {number} organizationId - Organization ID
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Statistics
 */
const getIncidentStats = async (organizationId = null, days = 30) => {
    let baseQuery = `
    FROM security_incidents
    WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
  `;

    if (organizationId) {
        baseQuery += ` AND organization_id = $1`;
    }

    const params = organizationId ? [organizationId] : [];

    const [totalResult, byTypeResult, bySeverityResult, byStatusResult] = await Promise.all([
        db.query(`SELECT COUNT(*) as total ${baseQuery}`, params),
        db.query(`SELECT incident_type, COUNT(*) as count ${baseQuery} GROUP BY incident_type`, params),
        db.query(`SELECT severity, COUNT(*) as count ${baseQuery} GROUP BY severity`, params),
        db.query(`SELECT status, COUNT(*) as count ${baseQuery} GROUP BY status`, params)
    ]);

    return {
        total: parseInt(totalResult.rows[0].total),
        byType: byTypeResult.rows.reduce((acc, row) => ({ ...acc, [row.incident_type]: parseInt(row.count) }), {}),
        bySeverity: bySeverityResult.rows.reduce((acc, row) => ({ ...acc, [row.severity]: parseInt(row.count) }), {}),
        byStatus: byStatusResult.rows.reduce((acc, row) => ({ ...acc, [row.status]: parseInt(row.count) }), {}),
        period: `${days} days`
    };
};

module.exports = {
    INCIDENT_TYPES,
    SEVERITY_LEVELS,
    INCIDENT_STATUS,
    createIncident,
    getIncidents,
    getIncident,
    updateIncidentStatus,
    addIncidentResponse,
    getIncidentStats
};
