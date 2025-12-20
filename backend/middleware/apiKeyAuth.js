/**
 * API Key Authentication Middleware
 * Authenticates requests using API keys as an alternative to JWT
 */

const apiKeyService = require('../services/apiKeyService');
const intrusionDetectionService = require('../services/intrusionDetectionService');
const securityIncidentService = require('../services/securityIncidentService');

/**
 * Middleware to authenticate requests via API key
 * Checks X-API-Key header or api_key query parameter
 */
const authenticateApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'] || req.query.api_key;
        const ip = req.ip || req.connection?.remoteAddress;

        if (!apiKey) {
            return res.status(401).json({
                message: 'API key required',
                hint: 'Provide API key via X-API-Key header or api_key query parameter'
            });
        }

        // Validate the API key
        const keyData = await apiKeyService.validateApiKey(apiKey);

        if (!keyData) {
            // Track invalid API key attempt
            intrusionDetectionService.addToThreatScore(ip, intrusionDetectionService.CONFIG.INVALID_API_KEY_SCORE);

            // Log incident
            await securityIncidentService.createIncident({
                organizationId: null,
                incidentType: securityIncidentService.INCIDENT_TYPES.INVALID_API_KEY,
                severity: securityIncidentService.SEVERITY_LEVELS.LOW,
                sourceIp: ip,
                description: `Invalid API key attempt from ${ip}`,
                details: {
                    keyPrefix: apiKey.substring(0, 12),
                    userAgent: req.headers['user-agent']
                }
            });

            return res.status(401).json({ message: 'Invalid or expired API key' });
        }

        // Attach API key data and organization context to request
        req.apiKey = keyData;
        req.organizationId = keyData.organization_id;

        // Create a pseudo-user object for compatibility with existing middleware
        req.user = {
            id: null,
            role: 'api_key',
            organization_id: keyData.organization_id,
            permissions: keyData.permissions
        };

        next();
    } catch (error) {
        console.error('API key authentication error:', error);
        res.status(500).json({ message: 'Authentication error' });
    }
};

/**
 * Middleware to check if API key has required permission
 * @param {string} permission - Required permission
 */
const requireApiKeyPermission = (permission) => {
    return (req, res, next) => {
        if (!req.apiKey) {
            return res.status(401).json({ message: 'API key authentication required' });
        }

        const permissions = req.apiKey.permissions || [];

        // Check for wildcard or specific permission
        if (permissions.includes('*') || permissions.includes(permission)) {
            return next();
        }

        // Check for category wildcard (e.g., 'read:*' covers 'read:users')
        const [action] = permission.split(':');
        if (permissions.includes(`${action}:*`)) {
            return next();
        }

        return res.status(403).json({
            message: 'Insufficient permissions',
            required: permission,
            granted: permissions
        });
    };
};

/**
 * Middleware that accepts either JWT or API key authentication
 */
const authenticateJWTorApiKey = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        // Use existing JWT auth middleware
        const { authenticateToken } = require('./auth');
        return authenticateToken(req, res, next);
    }

    if (apiKey) {
        return authenticateApiKey(req, res, next);
    }

    return res.status(401).json({
        message: 'Authentication required',
        hint: 'Provide JWT token in Authorization header or API key in X-API-Key header'
    });
};

module.exports = {
    authenticateApiKey,
    requireApiKeyPermission,
    authenticateJWTorApiKey
};
