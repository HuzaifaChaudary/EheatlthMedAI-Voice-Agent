/**
 * IP Block Check Middleware
 * Checks if incoming request IP is blocked
 */

const intrusionDetectionService = require('../services/intrusionDetectionService');

/**
 * Middleware to check if IP is blocked before processing request
 */
const checkIPBlock = async (req, res, next) => {
    try {
        const ip = req.ip || req.connection?.remoteAddress;

        if (!ip) {
            return next();
        }

        // Check if IP is blocked
        const blockInfo = await intrusionDetectionService.isIPBlocked(ip);

        if (blockInfo) {
            const expiresAt = blockInfo.expires_at ? new Date(blockInfo.expires_at) : null;
            const remainingTime = expiresAt ? Math.ceil((expiresAt - Date.now()) / 1000 / 60) : null;

            return res.status(403).json({
                message: 'Access denied',
                reason: 'Your IP address has been temporarily blocked',
                blocked_reason: blockInfo.reason,
                expires_in_minutes: remainingTime,
                contact: 'Contact support if you believe this is an error'
            });
        }

        next();
    } catch (error) {
        console.error('IP block check error:', error);
        // Don't block on errors - allow request through
        next();
    }
};

/**
 * Middleware to detect and log suspicious activity
 */
const detectSuspiciousRequests = (req, res, next) => {
    try {
        const detection = intrusionDetectionService.detectSuspiciousActivity(req);

        if (detection.isSupicious) {
            // Log but don't block - let other middleware handle that
            console.warn(`Suspicious request from ${req.ip}: ${detection.reasons.join(', ')}`);

            // Attach detection result for potential use by other middleware
            req.suspiciousActivity = detection;
        }

        next();
    } catch (error) {
        console.error('Suspicious activity detection error:', error);
        next();
    }
};

module.exports = {
    checkIPBlock,
    detectSuspiciousRequests
};
