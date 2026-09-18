import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { SecurityLogger } from './errorHandling.js';

/**
 * Authentication Middleware
 * Validates JWT tokens and loads user information
 * Validates: Requirements 1.2, 16.2 - JWT authentication and access logging
 */
export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from the token
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                SecurityLogger.logDataAccess(req, 'USER', decoded.id, false, {
                    action: 'READ',
                    purpose: 'TOKEN_VERIFICATION',
                    reason: 'USER_NOT_FOUND'
                });
                
                return res.status(401).json({
                    error: {
                        code: 'USER_NOT_FOUND',
                        message: 'User not found',
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }

            // Check if user account is active
            if (!req.user.isActive) {
                SecurityLogger.logDataAccess(req, 'USER', req.user._id, false, {
                    action: 'READ',
                    purpose: 'TOKEN_VERIFICATION',
                    reason: 'ACCOUNT_DISABLED'
                });
                
                return res.status(401).json({
                    error: {
                        code: 'ACCOUNT_DISABLED',
                        message: 'Account has been disabled',
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }

            // Log successful authentication
            SecurityLogger.logDataAccess(req, 'USER', req.user._id, true, {
                action: 'READ',
                purpose: 'TOKEN_VERIFICATION',
                role: req.user.role
            });

            next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            
            SecurityLogger.logDataAccess(req, 'USER', 'unknown', false, {
                action: 'READ',
                purpose: 'TOKEN_VERIFICATION',
                reason: 'TOKEN_INVALID',
                error: error.message
            });
            
            return res.status(401).json({
                error: {
                    code: 'TOKEN_INVALID',
                    message: 'Not authorized, token failed',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }
    }

    if (!token) {
        SecurityLogger.logDataAccess(req, 'USER', 'unknown', false, {
            action: 'READ',
            purpose: 'TOKEN_VERIFICATION',
            reason: 'NO_TOKEN'
        });
        
        return res.status(401).json({
            error: {
                code: 'NO_TOKEN',
                message: 'Not authorized, no token',
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
};

/**
 * Role-Based Authorization Middleware
 * Validates user roles for route access
 * Validates: Requirements 12.4, 12.5, 16.3 - Role-based access control
 */
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            SecurityLogger.logDataAccess(req, 'AUTHORIZATION', 'unknown', false, {
                action: 'AUTHORIZE',
                reason: 'NO_USER_CONTEXT',
                requiredRoles: roles
            });
            
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required for this resource',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }

        if (!roles.includes(req.user.role)) {
            SecurityLogger.logDataAccess(req, 'AUTHORIZATION', req.user._id, false, {
                action: 'AUTHORIZE',
                reason: 'INSUFFICIENT_ROLE',
                userRole: req.user.role,
                requiredRoles: roles,
                resource: req.path
            });
            
            return res.status(403).json({
                error: {
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: `User role '${req.user.role}' is not authorized to access this resource`,
                    details: {
                        userRole: req.user.role,
                        requiredRoles: roles,
                        resource: req.path
                    },
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }

        // Log successful authorization
        SecurityLogger.logDataAccess(req, 'AUTHORIZATION', req.user._id, true, {
            action: 'AUTHORIZE',
            userRole: req.user.role,
            requiredRoles: roles,
            resource: req.path
        });

        next();
    };
};

/**
 * Permission-Based Authorization Middleware
 * Validates specific permissions for granular access control
 * Validates: Requirements 16.3 - Role-based access control for all data operations
 */
export const requirePermission = (permission, resource = null) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required for this resource',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }

        const userPermissions = getUserPermissions(req.user.role);
        const hasPermission = checkPermission(userPermissions, permission, resource, req.user, req);

        if (!hasPermission) {
            SecurityLogger.logDataAccess(req, 'PERMISSION', req.user._id, false, {
                action: 'CHECK_PERMISSION',
                reason: 'PERMISSION_DENIED',
                userRole: req.user.role,
                requiredPermission: permission,
                resource: resource || req.path
            });
            
            return res.status(403).json({
                error: {
                    code: 'PERMISSION_DENIED',
                    message: `Permission '${permission}' is required for this operation`,
                    details: {
                        userRole: req.user.role,
                        requiredPermission: permission,
                        resource: resource || req.path
                    },
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }

        // Log successful permission check
        SecurityLogger.logDataAccess(req, 'PERMISSION', req.user._id, true, {
            action: 'CHECK_PERMISSION',
            userRole: req.user.role,
            requiredPermission: permission,
            resource: resource || req.path
        });

        next();
    };
};

/**
 * Resource Ownership Middleware
 * Validates that users can only access their own resources
 * Validates: Requirements 16.3 - Role-based access control for all data operations
 */
export const requireOwnership = (resourceIdParam = 'id', allowedRoles = ['admin']) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required for this resource',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }

        // Admin and other allowed roles can access any resource
        if (allowedRoles.includes(req.user.role)) {
            SecurityLogger.logDataAccess(req, 'OWNERSHIP', req.user._id, true, {
                action: 'CHECK_OWNERSHIP',
                reason: 'PRIVILEGED_ROLE',
                userRole: req.user.role,
                resourceId: req.params[resourceIdParam]
            });
            return next();
        }

        const resourceId = req.params[resourceIdParam];
        const userId = req.user._id.toString();

        // For user-specific resources, check ownership
        if (resourceId && resourceId !== userId) {
            SecurityLogger.logDataAccess(req, 'OWNERSHIP', req.user._id, false, {
                action: 'CHECK_OWNERSHIP',
                reason: 'NOT_OWNER',
                userRole: req.user.role,
                resourceId: resourceId,
                userId: userId
            });
            
            return res.status(403).json({
                error: {
                    code: 'RESOURCE_ACCESS_DENIED',
                    message: 'You can only access your own resources',
                    details: {
                        resourceId: resourceId,
                        userId: userId
                    },
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }

        // Log successful ownership check
        SecurityLogger.logDataAccess(req, 'OWNERSHIP', req.user._id, true, {
            action: 'CHECK_OWNERSHIP',
            userRole: req.user.role,
            resourceId: resourceId,
            userId: userId
        });

        next();
    };
};

/**
 * Admin-Specific Access Control Middleware
 * Enhanced authorization for admin operations with audit logging
 * Validates: Requirements 12.4, 12.5 - Admin authorization and access controls
 */
export const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: {
                code: 'AUTHENTICATION_REQUIRED',
                message: 'Authentication required for admin operations',
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }

    if (req.user.role !== 'admin') {
        SecurityLogger.logDataAccess(req, 'ADMIN_ACCESS', req.user._id, false, {
            action: 'ADMIN_OPERATION_ATTEMPT',
            reason: 'NOT_ADMIN',
            userRole: req.user.role,
            operation: req.path,
            method: req.method
        });
        
        return res.status(403).json({
            error: {
                code: 'ADMIN_ACCESS_REQUIRED',
                message: 'Administrator privileges required for this operation',
                details: {
                    userRole: req.user.role,
                    operation: req.path,
                    method: req.method
                },
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }

    // Log admin operation access
    SecurityLogger.logDataAccess(req, 'ADMIN_ACCESS', req.user._id, true, {
        action: 'ADMIN_OPERATION_ACCESS',
        userRole: req.user.role,
        operation: req.path,
        method: req.method,
        adminId: req.user._id
    });

    next();
};

/**
 * Get user permissions based on role
 * Defines the permission matrix for different user roles
 */
function getUserPermissions(role) {
    const permissions = {
        citizen: [
            'waste:create',
            'waste:read:own',
            'waste:update:own',
            'pickup:create',
            'pickup:read:own',
            'pickup:update:own',
            'profile:read:own',
            'profile:update:own',
            'ecopoints:read:own',
            'rewards:read',
            'rewards:redeem',
            'impact:read:own',
            'challenges:read',
            'challenges:participate',
            'leaderboard:read'
        ],
        collector: [
            'waste:read:assigned',
            'pickup:read:assigned',
            'pickup:update:assigned',
            'pickup:complete',
            'qr:verify',
            'profile:read:own',
            'profile:update:own',
            'tracking:update',
            'collection:create'
        ],
        admin: [
            'waste:*',
            'pickup:*',
            'user:*',
            'profile:*',
            'ecopoints:*',
            'rewards:*',
            'impact:*',
            'challenges:*',
            'leaderboard:*',
            'analytics:*',
            'campaigns:*',
            'admin:*',
            'system:*'
        ]
    };

    return permissions[role] || [];
}

/**
 * Check if user has specific permission
 * Implements permission checking logic with wildcard support
 */
function checkPermission(userPermissions, requiredPermission, resource, user, req) {
    // Admin wildcard check
    if (userPermissions.includes('*') || userPermissions.includes(`${requiredPermission.split(':')[0]}:*`)) {
        return true;
    }

    // Exact permission match
    if (userPermissions.includes(requiredPermission)) {
        return true;
    }

    // Check ownership-based permissions
    if (requiredPermission.endsWith(':own')) {
        const basePermission = requiredPermission.replace(':own', '');
        if (userPermissions.includes(basePermission + ':own')) {
            // Additional ownership validation can be added here
            return true;
        }
    }

    // Check assignment-based permissions for collectors
    if (requiredPermission.endsWith(':assigned') && user.role === 'collector') {
        const basePermission = requiredPermission.replace(':assigned', '');
        if (userPermissions.includes(basePermission + ':assigned')) {
            // Additional assignment validation can be added here
            return true;
        }
    }

    return false;
}

/**
 * Conditional Authorization Middleware
 * Applies different authorization rules based on conditions
 */
export const conditionalAuth = (conditions) => {
    return (req, res, next) => {
        for (const condition of conditions) {
            if (condition.when(req)) {
                return condition.middleware(req, res, next);
            }
        }
        
        // Default: require authentication
        return protect(req, res, next);
    };
};

/**
 * Rate Limiting by Role Middleware
 * Applies different rate limits based on user role
 */
export const roleBasedRateLimit = (limits) => {
    return (req, res, next) => {
        if (!req.user) {
            return next();
        }

        const userRole = req.user.role;
        const limit = limits[userRole] || limits.default;

        if (limit) {
            return limit(req, res, next);
        }

        next();
    };
};