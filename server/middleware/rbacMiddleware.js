/**
 * Advanced RBAC Middleware Functions
 * Provides specialized middleware for complex authorization scenarios
 * Validates: Requirements 12.4, 12.5, 16.3 - Advanced RBAC implementation
 */

import { 
    PERMISSIONS, 
    ROLE_PERMISSIONS, 
    RESOURCE_RULES, 
    ADMIN_OPERATIONS,
    ROUTE_PROTECTIONS,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessResource,
    canPerformAdminOperation
} from './rbacConfig.js';
import { SecurityLogger } from './errorHandling.js';

/**
 * Dynamic Permission Middleware
 * Checks permissions dynamically based on request context
 */
export const checkPermissions = (permissionCheck) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }

        let hasAccess = false;
        let requiredPermissions = [];

        // Handle different permission check types
        if (typeof permissionCheck === 'string') {
            // Single permission
            requiredPermissions = [permissionCheck];
            hasAccess = hasPermission(req.user, permissionCheck);
        } else if (Array.isArray(permissionCheck)) {
            // Array of permissions (user needs ALL)
            requiredPermissions = permissionCheck;
            hasAccess = hasAllPermissions(req.user, permissionCheck);
        } else if (typeof permissionCheck === 'function') {
            // Dynamic permission check function
            const result = permissionCheck(req.user, req);
            hasAccess = result.allowed;
            requiredPermissions = result.permissions || [];
        } else if (permissionCheck.any) {
            // User needs ANY of the permissions
            requiredPermissions = permissionCheck.any;
            hasAccess = hasAnyPermission(req.user, permissionCheck.any);
        } else if (permissionCheck.all) {
            // User needs ALL of the permissions
            requiredPermissions = permissionCheck.all;
            hasAccess = hasAllPermissions(req.user, permissionCheck.all);
        }

        if (!hasAccess) {
            SecurityLogger.logDataAccess(req, 'PERMISSION_CHECK', req.user._id, false, {
                action: 'DYNAMIC_PERMISSION_CHECK',
                reason: 'INSUFFICIENT_PERMISSIONS',
                userRole: req.user.role,
                requiredPermissions: requiredPermissions,
                resource: req.path
            });

            return res.status(403).json({
                error: {
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: 'Insufficient permissions for this operation',
                    details: {
                        userRole: req.user.role,
                        requiredPermissions: requiredPermissions,
                        resource: req.path
                    },
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }

        SecurityLogger.logDataAccess(req, 'PERMISSION_CHECK', req.user._id, true, {
            action: 'DYNAMIC_PERMISSION_CHECK',
            userRole: req.user.role,
            requiredPermissions: requiredPermissions,
            resource: req.path
        });

        next();
    };
};

/**
 * Resource-Based Access Control Middleware
 * Checks access based on resource ownership and type
 */
export const checkResourceAccess = (resourceType, operation, resourceLoader) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }

        try {
            // Load the resource
            let resource;
            if (typeof resourceLoader === 'function') {
                resource = await resourceLoader(req);
            } else if (typeof resourceLoader === 'string') {
                // Use parameter name to get resource ID
                const resourceId = req.params[resourceLoader];
                resource = { id: resourceId };
            } else {
                resource = resourceLoader;
            }

            if (!resource) {
                return res.status(404).json({
                    error: {
                        code: 'RESOURCE_NOT_FOUND',
                        message: 'Resource not found',
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }

            // Check access
            const hasAccess = canAccessResource(req.user, resourceType, operation, resource);

            if (!hasAccess) {
                SecurityLogger.logDataAccess(req, 'RESOURCE_ACCESS', req.user._id, false, {
                    action: 'RESOURCE_ACCESS_CHECK',
                    reason: 'ACCESS_DENIED',
                    userRole: req.user.role,
                    resourceType: resourceType,
                    operation: operation,
                    resourceId: resource.id || resource._id
                });

                return res.status(403).json({
                    error: {
                        code: 'RESOURCE_ACCESS_DENIED',
                        message: `Access denied for ${operation} operation on ${resourceType}`,
                        details: {
                            userRole: req.user.role,
                            resourceType: resourceType,
                            operation: operation
                        },
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }

            SecurityLogger.logDataAccess(req, 'RESOURCE_ACCESS', req.user._id, true, {
                action: 'RESOURCE_ACCESS_CHECK',
                userRole: req.user.role,
                resourceType: resourceType,
                operation: operation,
                resourceId: resource.id || resource._id
            });

            // Attach resource to request for use in controller
            req.resource = resource;
            next();
        } catch (error) {
            console.error('Resource access check error:', error);
            return res.status(500).json({
                error: {
                    code: 'RESOURCE_ACCESS_ERROR',
                    message: 'Error checking resource access',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }
    };
};

/**
 * Admin Operation Middleware
 * Checks access for specific admin operation categories
 */
export const checkAdminOperation = (operationCategory) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }

        if (!canPerformAdminOperation(req.user, operationCategory)) {
            SecurityLogger.logDataAccess(req, 'ADMIN_OPERATION', req.user._id, false, {
                action: 'ADMIN_OPERATION_CHECK',
                reason: 'INSUFFICIENT_ADMIN_PERMISSIONS',
                userRole: req.user.role,
                operationCategory: operationCategory,
                resource: req.path
            });

            return res.status(403).json({
                error: {
                    code: 'INSUFFICIENT_ADMIN_PERMISSIONS',
                    message: `Insufficient permissions for ${operationCategory} operations`,
                    details: {
                        userRole: req.user.role,
                        operationCategory: operationCategory,
                        requiredRole: 'admin'
                    },
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }

        SecurityLogger.logDataAccess(req, 'ADMIN_OPERATION', req.user._id, true, {
            action: 'ADMIN_OPERATION_CHECK',
            userRole: req.user.role,
            operationCategory: operationCategory,
            resource: req.path
        });

        next();
    };
};

/**
 * Route Protection Middleware Factory
 * Creates middleware based on predefined protection configurations
 */
export const protectRoute = (protectionType, customConfig = {}) => {
    return (req, res, next) => {
        const config = { ...ROUTE_PROTECTIONS[protectionType], ...customConfig };

        // Check authentication requirement
        if (config.auth && !req.user) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }

        // Check role requirements
        if (config.roles && config.roles.length > 0 && req.user) {
            if (!config.roles.includes(req.user.role)) {
                SecurityLogger.logDataAccess(req, 'ROUTE_PROTECTION', req.user._id, false, {
                    action: 'ROUTE_ACCESS_CHECK',
                    reason: 'INSUFFICIENT_ROLE',
                    userRole: req.user.role,
                    requiredRoles: config.roles,
                    protectionType: protectionType
                });

                return res.status(403).json({
                    error: {
                        code: 'INSUFFICIENT_ROLE',
                        message: 'Insufficient role for this route',
                        details: {
                            userRole: req.user.role,
                            requiredRoles: config.roles
                        },
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }
        }

        // Check permission requirements
        if (config.permissions && config.permissions.length > 0 && req.user) {
            const hasRequiredPermissions = hasAllPermissions(req.user, config.permissions);
            if (!hasRequiredPermissions) {
                SecurityLogger.logDataAccess(req, 'ROUTE_PROTECTION', req.user._id, false, {
                    action: 'ROUTE_ACCESS_CHECK',
                    reason: 'INSUFFICIENT_PERMISSIONS',
                    userRole: req.user.role,
                    requiredPermissions: config.permissions,
                    protectionType: protectionType
                });

                return res.status(403).json({
                    error: {
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: 'Insufficient permissions for this route',
                        details: {
                            userRole: req.user.role,
                            requiredPermissions: config.permissions
                        },
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }
        }

        // Log successful route access
        if (req.user) {
            SecurityLogger.logDataAccess(req, 'ROUTE_PROTECTION', req.user._id, true, {
                action: 'ROUTE_ACCESS_CHECK',
                userRole: req.user.role,
                protectionType: protectionType,
                resource: req.path
            });
        }

        next();
    };
};

/**
 * Context-Aware Authorization Middleware
 * Makes authorization decisions based on request context
 */
export const contextualAuth = (authConfig) => {
    return async (req, res, next) => {
        try {
            // Evaluate context conditions
            for (const condition of authConfig.conditions || []) {
                if (await condition.when(req)) {
                    return condition.middleware(req, res, next);
                }
            }

            // Default authorization
            if (authConfig.default) {
                return authConfig.default(req, res, next);
            }

            // No matching condition and no default
            return res.status(403).json({
                error: {
                    code: 'AUTHORIZATION_FAILED',
                    message: 'No matching authorization condition',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        } catch (error) {
            console.error('Contextual authorization error:', error);
            return res.status(500).json({
                error: {
                    code: 'AUTHORIZATION_ERROR',
                    message: 'Error in authorization process',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }
    };
};

/**
 * Time-Based Access Control Middleware
 * Restricts access based on time conditions
 */
export const timeBasedAccess = (timeConfig) => {
    return (req, res, next) => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Check allowed hours
        if (timeConfig.allowedHours) {
            const { start, end } = timeConfig.allowedHours;
            if (currentHour < start || currentHour >= end) {
                SecurityLogger.logDataAccess(req, 'TIME_ACCESS', req.user?._id || 'anonymous', false, {
                    action: 'TIME_BASED_ACCESS_CHECK',
                    reason: 'OUTSIDE_ALLOWED_HOURS',
                    currentHour: currentHour,
                    allowedHours: timeConfig.allowedHours
                });

                return res.status(403).json({
                    error: {
                        code: 'ACCESS_TIME_RESTRICTED',
                        message: 'Access is restricted during these hours',
                        details: {
                            currentHour: currentHour,
                            allowedHours: timeConfig.allowedHours
                        },
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }
        }

        // Check allowed days
        if (timeConfig.allowedDays) {
            if (!timeConfig.allowedDays.includes(currentDay)) {
                SecurityLogger.logDataAccess(req, 'TIME_ACCESS', req.user?._id || 'anonymous', false, {
                    action: 'TIME_BASED_ACCESS_CHECK',
                    reason: 'OUTSIDE_ALLOWED_DAYS',
                    currentDay: currentDay,
                    allowedDays: timeConfig.allowedDays
                });

                return res.status(403).json({
                    error: {
                        code: 'ACCESS_DAY_RESTRICTED',
                        message: 'Access is restricted on this day',
                        details: {
                            currentDay: currentDay,
                            allowedDays: timeConfig.allowedDays
                        },
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }
        }

        next();
    };
};

/**
 * IP-Based Access Control Middleware
 * Restricts access based on IP address
 */
export const ipBasedAccess = (ipConfig) => {
    return (req, res, next) => {
        const clientIP = req.ip || req.connection.remoteAddress;

        // Check allowed IPs
        if (ipConfig.allowedIPs && ipConfig.allowedIPs.length > 0) {
            if (!ipConfig.allowedIPs.includes(clientIP)) {
                SecurityLogger.logDataAccess(req, 'IP_ACCESS', req.user?._id || 'anonymous', false, {
                    action: 'IP_BASED_ACCESS_CHECK',
                    reason: 'IP_NOT_ALLOWED',
                    clientIP: clientIP,
                    allowedIPs: ipConfig.allowedIPs
                });

                return res.status(403).json({
                    error: {
                        code: 'IP_ACCESS_DENIED',
                        message: 'Access denied from this IP address',
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }
        }

        // Check blocked IPs
        if (ipConfig.blockedIPs && ipConfig.blockedIPs.includes(clientIP)) {
            SecurityLogger.logDataAccess(req, 'IP_ACCESS', req.user?._id || 'anonymous', false, {
                action: 'IP_BASED_ACCESS_CHECK',
                reason: 'IP_BLOCKED',
                clientIP: clientIP
            });

            return res.status(403).json({
                error: {
                    code: 'IP_BLOCKED',
                    message: 'Access denied - IP address is blocked',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }

        next();
    };
};

/**
 * Audit Logging Middleware
 * Logs all access attempts for audit purposes
 */
export const auditLogger = (auditConfig = {}) => {
    return (req, res, next) => {
        const startTime = Date.now();

        // Override res.json to capture response
        const originalJson = res.json;
        res.json = function(data) {
            const duration = Date.now() - startTime;
            
            // Log audit information
            SecurityLogger.logDataAccess(req, 'AUDIT', req.user?._id || 'anonymous', res.statusCode < 400, {
                action: 'AUDIT_LOG',
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration: duration,
                userRole: req.user?.role,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                ...auditConfig.additionalData
            });

            return originalJson.call(this, data);
        };

        next();
    };
};