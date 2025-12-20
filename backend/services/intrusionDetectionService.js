/**
 * Intrusion Detection Service
 * Tracks suspicious activity and implements automatic threat response
 */

const db = require('../config/database');
const securityIncidentService = require('./securityIncidentService');

// Configuration
const CONFIG = {
    // Failed login thresholds
    FAILED_LOGIN_THRESHOLD: 5,           // Max failed attempts before lockout
    FAILED_LOGIN_WINDOW_MINUTES: 15,     // Time window for counting attempts
    LOCKOUT_DURATION_MINUTES: 30,        // How long to lock out

    // Threat scoring
    THREAT_SCORE_THRESHOLD: 50,          // Score at which to auto-block
    FAILED_LOGIN_SCORE: 10,              // Points per failed login
    INVALID_API_KEY_SCORE: 15,           // Points per invalid API key
    RATE_LIMIT_EXCEEDED_SCORE: 5,        // Points per rate limit hit

    // Cleanup
    FAILED_ATTEMPTS_RETENTION_HOURS: 24  // How long to keep failed attempt records
};

// In-memory cache for threat scores (reset on server restart)
const threatScoreCache = new Map();

/**
 * Track a failed login attempt
 * @param {string} ip - Source IP address
 * @param {string} email - Email attempted
 * @param {string} userAgent - User agent string
 * @param {number} organizationId - Organization ID if known
 * @returns {Promise<Object>} Tracking result
 */
const trackFailedLogin = async (ip, email, userAgent = null, organizationId = null) => {
    // Record the attempt
    await db.query(
        `INSERT INTO failed_login_attempts (ip_address, email, user_agent, organization_id)
     VALUES ($1, $2, $3, $4)`,
        [ip, email, userAgent, organizationId]
    );

    // Update threat score
    addToThreatScore(ip, CONFIG.FAILED_LOGIN_SCORE);

    // Check if threshold exceeded
    const thresholdResult = await checkLoginThreshold(ip, email);

    if (thresholdResult.exceeded) {
        // Create security incident
        await securityIncidentService.createIncident({
            organizationId,
            incidentType: securityIncidentService.INCIDENT_TYPES.BRUTE_FORCE,
            severity: securityIncidentService.SEVERITY_LEVELS.HIGH,
            sourceIp: ip,
            description: `Brute force attack detected: ${thresholdResult.attempts} failed login attempts for ${email}`,
            details: {
                email,
                attempts: thresholdResult.attempts,
                userAgent,
                threshold: CONFIG.FAILED_LOGIN_THRESHOLD
            }
        });

        // Auto-block the IP
        await blockIP(ip, CONFIG.LOCKOUT_DURATION_MINUTES, 'Automatic: brute force detected', null, organizationId);
    }

    return thresholdResult;
};

/**
 * Check if login threshold has been exceeded
 * @param {string} ip - Source IP address
 * @param {string} email - Email being attempted
 * @returns {Promise<Object>} Threshold check result
 */
const checkLoginThreshold = async (ip, email = null) => {
    // Count recent failed attempts for this IP
    const result = await db.query(
        `SELECT COUNT(*) as attempts
     FROM failed_login_attempts
     WHERE ip_address = $1
     AND attempted_at >= CURRENT_TIMESTAMP - INTERVAL '${CONFIG.FAILED_LOGIN_WINDOW_MINUTES} minutes'`,
        [ip]
    );

    const attempts = parseInt(result.rows[0].attempts);

    return {
        exceeded: attempts >= CONFIG.FAILED_LOGIN_THRESHOLD,
        attempts,
        threshold: CONFIG.FAILED_LOGIN_THRESHOLD,
        remaining: Math.max(0, CONFIG.FAILED_LOGIN_THRESHOLD - attempts)
    };
};

/**
 * Block an IP address
 * @param {string} ip - IP address to block
 * @param {number} durationMinutes - Block duration (null for permanent)
 * @param {string} reason - Reason for block
 * @param {number} blockedBy - User ID who initiated block
 * @param {number} organizationId - Organization ID
 * @returns {Promise<Object>} Block record
 */
const blockIP = async (ip, durationMinutes = null, reason = null, blockedBy = null, organizationId = null) => {
    const expiresAt = durationMinutes
        ? new Date(Date.now() + durationMinutes * 60 * 1000)
        : null;

    const result = await db.query(
        `INSERT INTO blocked_ips (ip_address, organization_id, reason, blocked_by, expires_at, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (ip_address, organization_id) 
     DO UPDATE SET 
       reason = EXCLUDED.reason,
       blocked_by = EXCLUDED.blocked_by,
       expires_at = EXCLUDED.expires_at,
       is_active = true,
       blocked_at = CURRENT_TIMESTAMP
     RETURNING *`,
        [ip, organizationId, reason, blockedBy, expiresAt]
    );

    return result.rows[0];
};

/**
 * Unblock an IP address
 * @param {string} ip - IP address to unblock
 * @param {number} organizationId - Organization ID
 * @returns {Promise<boolean>} Success status
 */
const unblockIP = async (ip, organizationId = null) => {
    const result = await db.query(
        `UPDATE blocked_ips 
     SET is_active = false 
     WHERE ip_address = $1 AND (organization_id = $2 OR organization_id IS NULL)
     RETURNING id`,
        [ip, organizationId]
    );

    // Clear threat score
    threatScoreCache.delete(ip);

    return result.rows.length > 0;
};

/**
 * Check if an IP is blocked
 * @param {string} ip - IP address to check
 * @param {number} organizationId - Organization ID
 * @returns {Promise<Object|null>} Block record if blocked, null otherwise
 */
const isIPBlocked = async (ip, organizationId = null) => {
    const result = await db.query(
        `SELECT * FROM blocked_ips 
     WHERE ip_address = $1 
     AND is_active = true
     AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     AND (organization_id = $2 OR organization_id IS NULL)
     LIMIT 1`,
        [ip, organizationId]
    );

    return result.rows[0] || null;
};

/**
 * Get list of blocked IPs
 * @param {number} organizationId - Organization ID
 * @param {boolean} activeOnly - Only return active blocks
 * @returns {Promise<Object[]>} List of blocked IPs
 */
const getBlockedIPs = async (organizationId = null, activeOnly = true) => {
    let query = `
    SELECT bi.*, u.email as blocked_by_email
    FROM blocked_ips bi
    LEFT JOIN users u ON bi.blocked_by = u.id
    WHERE 1=1
  `;
    const params = [];
    let paramIndex = 1;

    if (organizationId) {
        query += ` AND (bi.organization_id = $${paramIndex++} OR bi.organization_id IS NULL)`;
        params.push(organizationId);
    }

    if (activeOnly) {
        query += ` AND bi.is_active = true AND (bi.expires_at IS NULL OR bi.expires_at > CURRENT_TIMESTAMP)`;
    }

    query += ' ORDER BY bi.blocked_at DESC';

    const result = await db.query(query, params);
    return result.rows;
};

/**
 * Add to threat score for an IP
 * @param {string} ip - IP address
 * @param {number} points - Points to add
 */
const addToThreatScore = (ip, points) => {
    const current = threatScoreCache.get(ip) || { score: 0, lastUpdate: Date.now() };
    current.score += points;
    current.lastUpdate = Date.now();
    threatScoreCache.set(ip, current);
};

/**
 * Get threat score for an IP
 * @param {string} ip - IP address
 * @returns {Object} Threat score data
 */
const getThreatScore = (ip) => {
    const data = threatScoreCache.get(ip);
    if (!data) {
        return { ip, score: 0, level: 'none' };
    }

    let level = 'none';
    if (data.score >= CONFIG.THREAT_SCORE_THRESHOLD) {
        level = 'critical';
    } else if (data.score >= CONFIG.THREAT_SCORE_THRESHOLD * 0.7) {
        level = 'high';
    } else if (data.score >= CONFIG.THREAT_SCORE_THRESHOLD * 0.4) {
        level = 'medium';
    } else if (data.score > 0) {
        level = 'low';
    }

    return { ip, score: data.score, level, lastUpdate: data.lastUpdate };
};

/**
 * Detect suspicious activity in a request
 * @param {Object} req - Express request object
 * @returns {Object} Detection result
 */
const detectSuspiciousActivity = (req) => {
    const suspicious = {
        isSupicious: false,
        reasons: [],
        score: 0
    };

    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    // Check for missing user agent
    if (!userAgent || userAgent.length < 10) {
        suspicious.reasons.push('Missing or invalid user agent');
        suspicious.score += 5;
    }

    // Check for automated tools
    const automatedPatterns = ['curl', 'wget', 'python-requests', 'go-http-client', 'httpie'];
    if (automatedPatterns.some(p => userAgent.toLowerCase().includes(p))) {
        suspicious.reasons.push('Automated tool detected');
        suspicious.score += 3;
    }

    // Check for SQL injection patterns in query/body
    const sqlPatterns = [/(\-\-|;|'|"|union|select|drop|insert|delete)/i];
    const bodyStr = JSON.stringify(req.body || {});
    const queryStr = JSON.stringify(req.query || {});

    if (sqlPatterns.some(p => p.test(bodyStr) || p.test(queryStr))) {
        suspicious.reasons.push('Potential SQL injection pattern');
        suspicious.score += 20;
    }

    // Check for XSS patterns
    const xssPatterns = [/<script|javascript:|on\w+\s*=/i];
    if (xssPatterns.some(p => p.test(bodyStr) || p.test(queryStr))) {
        suspicious.reasons.push('Potential XSS pattern');
        suspicious.score += 20;
    }

    // Add to threat score
    if (suspicious.score > 0) {
        addToThreatScore(ip, suspicious.score);
        suspicious.isSupicious = true;
    }

    return suspicious;
};

/**
 * Get threat metrics for dashboard
 * @param {number} organizationId - Organization ID
 * @returns {Promise<Object>} Threat metrics
 */
const getThreatMetrics = async (organizationId = null) => {
    const params = organizationId ? [organizationId] : [];
    const orgFilter = organizationId ? 'AND organization_id = $1' : '';

    const [failedLoginsResult, blockedIPsResult, incidentStats] = await Promise.all([
        db.query(
            `SELECT COUNT(*) as count 
       FROM failed_login_attempts 
       WHERE attempted_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours' ${orgFilter}`,
            params
        ),
        db.query(
            `SELECT COUNT(*) as count 
       FROM blocked_ips 
       WHERE is_active = true ${orgFilter}`,
            params
        ),
        securityIncidentService.getIncidentStats(organizationId, 7)
    ]);

    return {
        failedLoginsLast24h: parseInt(failedLoginsResult.rows[0].count),
        activeBlockedIPs: parseInt(blockedIPsResult.rows[0].count),
        incidentsLast7Days: incidentStats.total,
        incidentsBySeverity: incidentStats.bySeverity,
        threatScoreCacheSize: threatScoreCache.size
    };
};

/**
 * Cleanup old records
 * @returns {Promise<Object>} Cleanup results
 */
const cleanup = async () => {
    // Remove old failed login attempts
    const failedLoginsResult = await db.query(
        `DELETE FROM failed_login_attempts 
     WHERE attempted_at < CURRENT_TIMESTAMP - INTERVAL '${CONFIG.FAILED_ATTEMPTS_RETENTION_HOURS} hours'
     RETURNING id`
    );

    // Deactivate expired IP blocks
    const blockedIPsResult = await db.query(
        `UPDATE blocked_ips 
     SET is_active = false 
     WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP AND is_active = true
     RETURNING id`
    );

    // Clear old entries from threat score cache (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let cacheCleared = 0;
    for (const [ip, data] of threatScoreCache) {
        if (data.lastUpdate < oneHourAgo) {
            threatScoreCache.delete(ip);
            cacheCleared++;
        }
    }

    return {
        failedLoginsRemoved: failedLoginsResult.rowCount,
        expiredBlocksCleared: blockedIPsResult.rowCount,
        threatScoreCacheCleared: cacheCleared
    };
};

module.exports = {
    CONFIG,
    trackFailedLogin,
    checkLoginThreshold,
    blockIP,
    unblockIP,
    isIPBlocked,
    getBlockedIPs,
    getThreatScore,
    addToThreatScore,
    detectSuspiciousActivity,
    getThreatMetrics,
    cleanup
};
