/**
 * Role-Based Permission Middleware
 * Comprehensive permission enforcement for RBAC
 */

const db = require('../config/database');

/**
 * Check if user has a specific role
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(' or ')}`,
        required_roles: roles,
        user_role: req.user.role
      });
    }

    next();
  };
};

/**
 * Check if user has permission to perform an action on a resource
 * Queries the permissions and role_permissions tables
 */
const requirePermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Admin role has all permissions
      if (req.user.role === 'admin') {
        return next();
      }

      // Check if user's role has the required permission
      const permissionResult = await db.query(
        `SELECT p.* FROM permissions p
         INNER JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role = $1 AND p.resource = $2 AND p.action = $3`,
        [req.user.role, resource, action]
      );

      if (permissionResult.rows.length === 0) {
        return res.status(403).json({
          message: `Permission denied: ${action} on ${resource}`,
          required_permission: `${resource}:${action}`,
          user_role: req.user.role
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Error checking permissions', error: error.message });
    }
  };
};

/**
 * Check if user has access to organization resource
 * Ensures users can only access resources from their organization
 */
const requireOrganizationAccess = (resourceTable, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Admin can access all organizations
      if (req.user.role === 'admin') {
        return next();
      }

      // Get user's organization_id
      const userResult = await db.query(
        'SELECT organization_id FROM users WHERE id = $1',
        [req.user.id]
      );

      const userOrgId = userResult.rows[0]?.organization_id;

      // Get resource's organization_id
      const resourceId = req.params[resourceIdParam];
      const resourceResult = await db.query(
        `SELECT organization_id FROM ${resourceTable} WHERE id = $1`,
        [resourceId]
      );

      if (resourceResult.rows.length === 0) {
        return res.status(404).json({ message: 'Resource not found' });
      }

      const resourceOrgId = resourceResult.rows[0].organization_id;

      // Check access: user org must match resource org, or both must be null
      if (userOrgId !== resourceOrgId && !(userOrgId === null && resourceOrgId === null)) {
        return res.status(403).json({
          message: 'Access denied. Resource belongs to a different organization.',
          user_organization_id: userOrgId,
          resource_organization_id: resourceOrgId
        });
      }

      next();
    } catch (error) {
      console.error('Organization access check error:', error);
      res.status(500).json({ message: 'Error checking organization access', error: error.message });
    }
  };
};

/**
 * Optional: Check custom access policies
 * Queries the access_policies table for custom rules
 */
/**
 * Optional: Check custom access policies
 * Queries the access_policies table for custom rules
 * Now uses the centralized policy enforcement logic
 */
const checkAccessPolicy = async (req, resourceType, resourceId = null) => {
  try {
    const policyEnforcement = require('./policyEnforcement');

    if (!req.user) {
      return { allowed: false, reason: 'Authentication required' };
    }

    const { allowed, reason, policy } = await policyEnforcement.checkAccess(
      req.user.id,
      req.user.role,
      req.user.organization_id,
      resourceType,
      resourceId,
      req.method === 'GET' ? 'read' : 'write' // Default action based on method
    );

    return { allowed, reason, policy: policy ? { name: policy } : null };
  } catch (error) {
    console.error('Access policy check error:', error);
    return { allowed: false, reason: 'Error checking access policy' };
  }
};

module.exports = {
  requireRole,
  requirePermission,
  requireOrganizationAccess,
  checkAccessPolicy
};

