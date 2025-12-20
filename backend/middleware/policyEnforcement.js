/**
 * Policy Enforcement Middleware
 * Evaluates access policies with conditions for fine-grained access control
 */

const db = require('../config/database');

// Policy cache for performance
const policyCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Middleware factory for policy enforcement
 * @param {string} resourceType - Type of resource being accessed
 * @param {string} action - Action being performed (read, write, delete, manage)
 */
const enforcePolicy = (resourceType, action = 'read') => {
    return async (req, res, next) => {
        try {
            // Skip for admin users
            if (req.user?.role === 'admin') {
                return next();
            }

            const userId = req.user?.id;
            const userRole = req.user?.role;
            const organizationId = req.user?.organization_id || req.organizationId;
            const resourceId = req.params.id || null;
            const ip = req.ip || req.connection?.remoteAddress;

            // Get applicable policies
            const policies = await getApplicablePolicies(resourceType, userRole, organizationId, resourceId);

            if (policies.length === 0) {
                // No explicit policy - check if user has basic permissions
                if (req.user?.role) {
                    return next(); // Allow if authenticated
                }
                return res.status(403).json({
                    message: 'Access denied: No access policy found',
                    resource: resourceType
                });
            }

            // Evaluate each policy
            for (const policy of policies) {
                const evaluation = evaluatePolicy(policy, {
                    action,
                    ip,
                    userRole,
                    userId,
                    organizationId,
                    req
                });

                if (evaluation.allowed) {
                    // Log successful policy evaluation
                    await logPolicyDecision(policy.id, userId, resourceType, resourceId, action, true, evaluation.reason);
                    return next();
                }
            }

            // No policy allowed access
            await logPolicyDecision(null, userId, resourceType, resourceId, action, false, 'No matching policy');

            return res.status(403).json({
                message: 'Access denied by policy',
                resource: resourceType,
                action
            });

        } catch (error) {
            console.error('Policy enforcement error:', error);
            res.status(500).json({ message: 'Policy evaluation error' });
        }
    };
};

/**
 * Get applicable policies for a resource
 */
const getApplicablePolicies = async (resourceType, role, organizationId, resourceId = null) => {
    const cacheKey = `${resourceType}:${role}:${organizationId}:${resourceId}`;
    const cached = policyCache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
        return cached.policies;
    }

    const result = await db.query(
        `SELECT * FROM access_policies 
     WHERE resource_type = $1 
     AND (role = $2 OR role IS NULL)
     AND (organization_id = $3 OR organization_id IS NULL)
     AND (resource_id = $4 OR resource_id IS NULL)
     AND is_active = true
     ORDER BY 
       CASE WHEN role IS NOT NULL THEN 1 ELSE 2 END,
       CASE WHEN resource_id IS NOT NULL THEN 1 ELSE 2 END,
       CASE WHEN organization_id IS NOT NULL THEN 1 ELSE 2 END`,
        [resourceType, role, organizationId, resourceId]
    );

    policyCache.set(cacheKey, {
        policies: result.rows,
        expiry: Date.now() + CACHE_TTL_MS
    });

    return result.rows;
};

/**
 * Evaluate a policy against request context
 */
const evaluatePolicy = (policy, context) => {
    const { action, ip, userRole, req } = context;

    // Check if action is allowed
    const permissions = policy.permissions || [];
    if (!permissions.includes(action) && !permissions.includes('*') && !permissions.includes('manage')) {
        return { allowed: false, reason: `Action '${action}' not permitted` };
    }

    // Evaluate conditions
    const conditions = policy.conditions || {};

    // Time-based conditions
    if (conditions.time_restrictions) {
        const timeCheck = evaluateTimeCondition(conditions.time_restrictions);
        if (!timeCheck.allowed) {
            return { allowed: false, reason: timeCheck.reason };
        }
    }

    // IP-based conditions
    if (conditions.ip_whitelist || conditions.ip_blacklist) {
        const ipCheck = evaluateIPCondition(ip, conditions);
        if (!ipCheck.allowed) {
            return { allowed: false, reason: ipCheck.reason };
        }
    }

    // User agent conditions
    if (conditions.allowed_user_agents) {
        const userAgent = req.headers['user-agent'] || '';
        const allowed = conditions.allowed_user_agents.some(ua => userAgent.includes(ua));
        if (!allowed) {
            return { allowed: false, reason: 'User agent not allowed' };
        }
    }

    // Rate limit conditions (per policy)
    if (conditions.rate_limit) {
        // This would need integration with rate limiting middleware
        // For now, just pass through
    }

    return { allowed: true, reason: 'Policy conditions met' };
};

/**
 * Evaluate time-based conditions
 */
const evaluateTimeCondition = (timeRestrictions) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday

    // Check allowed hours
    if (timeRestrictions.allowed_hours) {
        const { start, end } = timeRestrictions.allowed_hours;
        if (currentHour < start || currentHour >= end) {
            return {
                allowed: false,
                reason: `Access only allowed between ${start}:00 and ${end}:00`
            };
        }
    }

    // Check allowed days
    if (timeRestrictions.allowed_days) {
        if (!timeRestrictions.allowed_days.includes(currentDay)) {
            return {
                allowed: false,
                reason: 'Access not allowed on this day of week'
            };
        }
    }

    // Check timezone
    if (timeRestrictions.timezone) {
        // For full timezone support, would need a library like moment-timezone
        // This is a simplified version
    }

    return { allowed: true };
};

/**
 * Evaluate IP-based conditions
 */
const evaluateIPCondition = (ip, conditions) => {
    // Check blacklist first
    if (conditions.ip_blacklist) {
        if (conditions.ip_blacklist.includes(ip)) {
            return { allowed: false, reason: 'IP address is blacklisted' };
        }
    }

    // Check whitelist
    if (conditions.ip_whitelist) {
        if (!conditions.ip_whitelist.includes(ip)) {
            return { allowed: false, reason: 'IP address not in whitelist' };
        }
    }

    return { allowed: true };
};

/**
 * Log policy decision for audit
 */
const logPolicyDecision = async (policyId, userId, resourceType, resourceId, action, allowed, reason) => {
    try {
        await db.query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
            [
                userId,
                allowed ? 'POLICY_ALLOW' : 'POLICY_DENY',
                resourceType,
                resourceId,
                JSON.stringify({ policy_id: policyId, action, allowed, reason })
            ]
        );
    } catch (error) {
        console.error('Failed to log policy decision:', error);
    }
};

/**
 * Clear policy cache
 */
const clearPolicyCache = () => {
    policyCache.clear();
};

/**
 * Check access without middleware (utility function)
 */
const checkAccess = async (userId, userRole, organizationId, resourceType, resourceId, action) => {
    // Admin bypass
    if (userRole === 'admin') {
        return { allowed: true, reason: 'Admin access' };
    }

    const policies = await getApplicablePolicies(resourceType, userRole, organizationId, resourceId);

    if (policies.length === 0) {
        return { allowed: false, reason: 'No access policy found' };
    }

    for (const policy of policies) {
        const evaluation = evaluatePolicy(policy, {
            action,
            ip: null,
            userRole,
            userId,
            organizationId,
            req: { headers: {} }
        });

        if (evaluation.allowed) {
            return { allowed: true, reason: evaluation.reason, policy: policy.name };
        }
    }

    return { allowed: false, reason: 'No matching policy' };
};

module.exports = {
    enforcePolicy,
    checkAccess,
    clearPolicyCache,
    evaluatePolicy,
    getApplicablePolicies
};
