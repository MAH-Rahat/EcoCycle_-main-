/**
 * Role-Based Access Control Configuration
 * Centralized permission definitions and access control rules
 * Validates: Requirements 12.4, 12.5, 16.3 - RBAC implementation
 */

/**
 * Permission Definitions
 * Defines all available permissions in the system
 */
export const PERMISSIONS = {
    // Waste Management Permissions
    WASTE_CREATE: 'waste:create',
    WASTE_READ_OWN: 'waste:read:own',
    WASTE_READ_ALL: 'waste:read:all',
    WASTE_UPDATE_OWN: 'waste:update:own',
    WASTE_UPDATE_ALL: 'waste:update:all',
    WASTE_DELETE_OWN: 'waste:delete:own',
    WASTE_DELETE_ALL: 'waste:delete:all',
    WASTE_VERIFY: 'waste:verify',

    // Pickup Management Permissions
    PICKUP_CREATE: 'pickup:create',
    PICKUP_READ_OWN: 'pickup:read:own',
    PICKUP_READ_ASSIGNED: 'pickup:read:assigned',
    PICKUP_READ_ALL: 'pickup:read:all',
    PICKUP_UPDATE_OWN: 'pickup:update:own',
    PICKUP_UPDATE_ASSIGNED: 'pickup:update:assigned',
    PICKUP_UPDATE_ALL: 'pickup:update:all',
    PICKUP_DELETE_OWN: 'pickup:delete:own',
    PICKUP_DELETE_ALL: 'pickup:delete:all',
    PICKUP_ASSIGN: 'pickup:assign',
    PICKUP_COMPLETE: 'pickup:complete',

    // User Management Permissions
    USER_READ_OWN: 'user:read:own',
    USER_READ_ALL: 'user:read:all',
    USER_UPDATE_OWN: 'user:update:own',
    USER_UPDATE_ALL: 'user:update:all',
    USER_DELETE_OWN: 'user:delete:own',
    USER_DELETE_ALL: 'user:delete:all',
    USER_CREATE: 'user:create',
    USER_ACTIVATE: 'user:activate',
    USER_DEACTIVATE: 'user:deactivate',

    // Profile Management Permissions
    PROFILE_READ_OWN: 'profile:read:own',
    PROFILE_READ_ALL: 'profile:read:all',
    PROFILE_UPDATE_OWN: 'profile:update:own',
    PROFILE_UPDATE_ALL: 'profile:update:all',

    // EcoPoints Permissions
    ECOPOINTS_READ_OWN: 'ecopoints:read:own',
    ECOPOINTS_READ_ALL: 'ecopoints:read:all',
    ECOPOINTS_AWARD: 'ecopoints:award',
    ECOPOINTS_DEDUCT: 'ecopoints:deduct',
    ECOPOINTS_TRANSFER: 'ecopoints:transfer',

    // Rewards Permissions
    REWARDS_READ: 'rewards:read',
    REWARDS_REDEEM: 'rewards:redeem',
    REWARDS_CREATE: 'rewards:create',
    REWARDS_UPDATE: 'rewards:update',
    REWARDS_DELETE: 'rewards:delete',
    REWARDS_MANAGE: 'rewards:manage',

    // Impact Dashboard Permissions
    IMPACT_READ_OWN: 'impact:read:own',
    IMPACT_READ_ALL: 'impact:read:all',
    IMPACT_UPDATE_OWN: 'impact:update:own',
    IMPACT_UPDATE_ALL: 'impact:update:all',

    // Challenge Permissions
    CHALLENGES_READ: 'challenges:read',
    CHALLENGES_PARTICIPATE: 'challenges:participate',
    CHALLENGES_CREATE: 'challenges:create',
    CHALLENGES_UPDATE: 'challenges:update',
    CHALLENGES_DELETE: 'challenges:delete',
    CHALLENGES_MANAGE: 'challenges:manage',

    // Leaderboard Permissions
    LEADERBOARD_READ: 'leaderboard:read',
    LEADERBOARD_MANAGE: 'leaderboard:manage',

    // Analytics Permissions
    ANALYTICS_READ: 'analytics:read',
    ANALYTICS_EXPORT: 'analytics:export',
    ANALYTICS_MANAGE: 'analytics:manage',

    // Campaign Permissions
    CAMPAIGNS_READ: 'campaigns:read',
    CAMPAIGNS_CREATE: 'campaigns:create',
    CAMPAIGNS_UPDATE: 'campaigns:update',
    CAMPAIGNS_DELETE: 'campaigns:delete',
    CAMPAIGNS_MANAGE: 'campaigns:manage',

    // QR Verification Permissions
    QR_VERIFY: 'qr:verify',
    QR_GENERATE: 'qr:generate',

    // Tracking Permissions
    TRACKING_READ: 'tracking:read',
    TRACKING_UPDATE: 'tracking:update',

    // Collection Report Permissions
    COLLECTION_CREATE: 'collection:create',
    COLLECTION_READ: 'collection:read',
    COLLECTION_UPDATE: 'collection:update',

    // Admin Permissions
    ADMIN_USERS: 'admin:users',
    ADMIN_SYSTEM: 'admin:system',
    ADMIN_REPORTS: 'admin:reports',
    ADMIN_SETTINGS: 'admin:settings',
    ADMIN_AUDIT: 'admin:audit',

    // System Permissions
    SYSTEM_BACKUP: 'system:backup',
    SYSTEM_RESTORE: 'system:restore',
    SYSTEM_MONITOR: 'system:monitor',
    SYSTEM_CONFIG: 'system:config'
};

/**
 * Role Permission Matrix
 * Defines which permissions each role has
 */
export const ROLE_PERMISSIONS = {
    citizen: [
        // Waste Management
        PERMISSIONS.WASTE_CREATE,
        PERMISSIONS.WASTE_READ_OWN,
        PERMISSIONS.WASTE_UPDATE_OWN,
        PERMISSIONS.WASTE_DELETE_OWN,

        // Pickup Management
        PERMISSIONS.PICKUP_CREATE,
        PERMISSIONS.PICKUP_READ_OWN,
        PERMISSIONS.PICKUP_UPDATE_OWN,
        PERMISSIONS.PICKUP_DELETE_OWN,

        // Profile Management
        PERMISSIONS.PROFILE_READ_OWN,
        PERMISSIONS.PROFILE_UPDATE_OWN,

        // User Management (own account only)
        PERMISSIONS.USER_READ_OWN,
        PERMISSIONS.USER_UPDATE_OWN,

        // EcoPoints
        PERMISSIONS.ECOPOINTS_READ_OWN,

        // Rewards
        PERMISSIONS.REWARDS_READ,
        PERMISSIONS.REWARDS_REDEEM,

        // Impact Dashboard
        PERMISSIONS.IMPACT_READ_OWN,

        // Challenges
        PERMISSIONS.CHALLENGES_READ,
        PERMISSIONS.CHALLENGES_PARTICIPATE,

        // Leaderboard
        PERMISSIONS.LEADERBOARD_READ,

        // Campaigns
        PERMISSIONS.CAMPAIGNS_READ,

        // Tracking (own pickups)
        PERMISSIONS.TRACKING_READ
    ],

    collector: [
        // Waste Management (assigned/verified)
        PERMISSIONS.WASTE_READ_ASSIGNED,
        PERMISSIONS.WASTE_VERIFY,

        // Pickup Management (assigned pickups)
        PERMISSIONS.PICKUP_READ_ASSIGNED,
        PERMISSIONS.PICKUP_UPDATE_ASSIGNED,
        PERMISSIONS.PICKUP_COMPLETE,

        // Profile Management
        PERMISSIONS.PROFILE_READ_OWN,
        PERMISSIONS.PROFILE_UPDATE_OWN,

        // User Management (own account only)
        PERMISSIONS.USER_READ_OWN,
        PERMISSIONS.USER_UPDATE_OWN,

        // QR Verification
        PERMISSIONS.QR_VERIFY,
        PERMISSIONS.QR_GENERATE,

        // Tracking
        PERMISSIONS.TRACKING_READ,
        PERMISSIONS.TRACKING_UPDATE,

        // Collection Reports
        PERMISSIONS.COLLECTION_CREATE,
        PERMISSIONS.COLLECTION_READ,

        // Challenges (read only)
        PERMISSIONS.CHALLENGES_READ,

        // Leaderboard (read only)
        PERMISSIONS.LEADERBOARD_READ
    ],

    admin: [
        // All permissions - admins have full access
        ...Object.values(PERMISSIONS)
    ]
};

/**
 * Resource Access Rules
 * Defines specific rules for accessing different resources
 */
export const RESOURCE_RULES = {
    // Waste logs can be accessed by owner or admin
    wasteLog: {
        read: (user, resourceOwnerId) => {
            return user.role === 'admin' || user._id.toString() === resourceOwnerId.toString();
        },
        update: (user, resourceOwnerId) => {
            return user.role === 'admin' || user._id.toString() === resourceOwnerId.toString();
        },
        delete: (user, resourceOwnerId) => {
            return user.role === 'admin' || user._id.toString() === resourceOwnerId.toString();
        }
    },

    // Pickup requests can be accessed by owner, assigned collector, or admin
    pickupRequest: {
        read: (user, resource) => {
            if (user.role === 'admin') return true;
            if (user._id.toString() === resource.citizenId.toString()) return true;
            if (user.role === 'collector' && resource.assignedCollectorId && 
                user._id.toString() === resource.assignedCollectorId.toString()) return true;
            return false;
        },
        update: (user, resource) => {
            if (user.role === 'admin') return true;
            if (user._id.toString() === resource.citizenId.toString()) return true;
            if (user.role === 'collector' && resource.assignedCollectorId && 
                user._id.toString() === resource.assignedCollectorId.toString()) return true;
            return false;
        }
    },

    // User profiles can be accessed by owner or admin
    userProfile: {
        read: (user, profileUserId) => {
            return user.role === 'admin' || user._id.toString() === profileUserId.toString();
        },
        update: (user, profileUserId) => {
            return user.role === 'admin' || user._id.toString() === profileUserId.toString();
        }
    },

    // EcoPoints wallets can be accessed by owner or admin
    ecoPointsWallet: {
        read: (user, walletUserId) => {
            return user.role === 'admin' || user._id.toString() === walletUserId.toString();
        },
        update: (user, walletUserId) => {
            return user.role === 'admin';
        }
    }
};

/**
 * Admin Operation Categories
 * Defines different categories of admin operations for granular control
 */
export const ADMIN_OPERATIONS = {
    USER_MANAGEMENT: {
        permissions: [
            PERMISSIONS.ADMIN_USERS,
            PERMISSIONS.USER_READ_ALL,
            PERMISSIONS.USER_UPDATE_ALL,
            PERMISSIONS.USER_DELETE_ALL,
            PERMISSIONS.USER_ACTIVATE,
            PERMISSIONS.USER_DEACTIVATE
        ],
        description: 'User account management operations'
    },

    SYSTEM_ADMINISTRATION: {
        permissions: [
            PERMISSIONS.ADMIN_SYSTEM,
            PERMISSIONS.SYSTEM_BACKUP,
            PERMISSIONS.SYSTEM_RESTORE,
            PERMISSIONS.SYSTEM_MONITOR,
            PERMISSIONS.SYSTEM_CONFIG
        ],
        description: 'System administration operations'
    },

    CONTENT_MANAGEMENT: {
        permissions: [
            PERMISSIONS.REWARDS_MANAGE,
            PERMISSIONS.CHALLENGES_MANAGE,
            PERMISSIONS.CAMPAIGNS_MANAGE,
            PERMISSIONS.LEADERBOARD_MANAGE
        ],
        description: 'Content and campaign management operations'
    },

    ANALYTICS_REPORTING: {
        permissions: [
            PERMISSIONS.ADMIN_REPORTS,
            PERMISSIONS.ANALYTICS_READ,
            PERMISSIONS.ANALYTICS_EXPORT,
            PERMISSIONS.ANALYTICS_MANAGE
        ],
        description: 'Analytics and reporting operations'
    },

    AUDIT_SECURITY: {
        permissions: [
            PERMISSIONS.ADMIN_AUDIT,
            PERMISSIONS.USER_READ_ALL,
            PERMISSIONS.PICKUP_READ_ALL,
            PERMISSIONS.WASTE_READ_ALL
        ],
        description: 'Security audit and monitoring operations'
    }
};

/**
 * Route Protection Configurations
 * Pre-defined protection configurations for common route patterns
 */
export const ROUTE_PROTECTIONS = {
    // Public routes (no authentication required)
    PUBLIC: {
        auth: false,
        roles: [],
        permissions: []
    },

    // Authenticated routes (any authenticated user)
    AUTHENTICATED: {
        auth: true,
        roles: ['citizen', 'collector', 'admin'],
        permissions: []
    },

    // Citizen-only routes
    CITIZEN_ONLY: {
        auth: true,
        roles: ['citizen'],
        permissions: []
    },

    // Collector-only routes
    COLLECTOR_ONLY: {
        auth: true,
        roles: ['collector'],
        permissions: []
    },

    // Admin-only routes
    ADMIN_ONLY: {
        auth: true,
        roles: ['admin'],
        permissions: []
    },

    // Citizen and Admin routes
    CITIZEN_ADMIN: {
        auth: true,
        roles: ['citizen', 'admin'],
        permissions: []
    },

    // Collector and Admin routes
    COLLECTOR_ADMIN: {
        auth: true,
        roles: ['collector', 'admin'],
        permissions: []
    },

    // Own resource access (user can access their own resources)
    OWN_RESOURCE: {
        auth: true,
        roles: ['citizen', 'collector', 'admin'],
        ownership: true
    },

    // Admin user management
    ADMIN_USER_MANAGEMENT: {
        auth: true,
        roles: ['admin'],
        permissions: [PERMISSIONS.ADMIN_USERS]
    },

    // Admin system operations
    ADMIN_SYSTEM: {
        auth: true,
        roles: ['admin'],
        permissions: [PERMISSIONS.ADMIN_SYSTEM]
    }
};

/**
 * Helper function to check if user has permission
 */
export function hasPermission(user, permission) {
    if (!user || !user.role) return false;
    
    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    return userPermissions.includes(permission);
}

/**
 * Helper function to check if user has any of the specified permissions
 */
export function hasAnyPermission(user, permissions) {
    if (!user || !user.role) return false;
    
    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    return permissions.some(permission => userPermissions.includes(permission));
}

/**
 * Helper function to check if user has all of the specified permissions
 */
export function hasAllPermissions(user, permissions) {
    if (!user || !user.role) return false;
    
    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    return permissions.every(permission => userPermissions.includes(permission));
}

/**
 * Helper function to get all permissions for a user role
 */
export function getUserPermissions(role) {
    return ROLE_PERMISSIONS[role] || [];
}

/**
 * Helper function to check resource access
 */
export function canAccessResource(user, resourceType, operation, resource) {
    const rules = RESOURCE_RULES[resourceType];
    if (!rules || !rules[operation]) return false;
    
    return rules[operation](user, resource);
}

/**
 * Helper function to check admin operation access
 */
export function canPerformAdminOperation(user, operationCategory) {
    if (user.role !== 'admin') return false;
    
    const operation = ADMIN_OPERATIONS[operationCategory];
    if (!operation) return false;
    
    return hasAnyPermission(user, operation.permissions);
}