import fc from 'fast-check';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../middleware/rbacConfig.js';

// Feature: ecocycle-platform, Property 58: Role-Based Access Control
describe('RBAC Property-Based Tests', () => {
    
    // Custom generators for RBAC testing
    const roleGen = () => fc.constantFrom('citizen', 'collector', 'admin');
    
    const permissionGen = () => fc.constantFrom(...Object.values(PERMISSIONS));
    
    const operationGen = () => fc.record({
        permission: permissionGen(),
        resource: fc.constantFrom('waste', 'pickup', 'profile', 'admin', 'ecopoints', 'rewards'),
        action: fc.constantFrom('create', 'read', 'update', 'delete', 'verify', 'complete')
    });

    const userGen = () => fc.record({
        _id: fc.hexaString({ minLength: 24, maxLength: 24 }),
        role: roleGen(),
        isActive: fc.boolean()
    });

    // Helper function to check if a role has a specific permission
    const hasPermission = (role, permission) => {
        const rolePermissions = ROLE_PERMISSIONS[role] || [];
        
        // Admin has all permissions
        if (role === 'admin') {
            return true;
        }
        
        // Check exact permission match
        if (rolePermissions.includes(permission)) {
            return true;
        }
        
        // Check wildcard permissions
        const permissionParts = permission.split(':');
        for (let i = permissionParts.length - 1; i >= 0; i--) {
            const wildcardPermission = permissionParts.slice(0, i).join(':') + ':*';
            if (rolePermissions.includes(wildcardPermission)) {
                return true;
            }
        }
        
        return false;
    };

    // Property 58: Role-Based Access Control
    describe('Property 58: Role-Based Access Control', () => {
        test('For any role and permission combination, access should be granted only if the role has the required permission', () => {
            return fc.assert(fc.property(
                roleGen(),
                permissionGen(),
                (role, permission) => {
                    const shouldHaveAccess = hasPermission(role, permission);
                    const actualPermissions = ROLE_PERMISSIONS[role] || [];
                    
                    if (role === 'admin') {
                        // Admin should always have access
                        expect(shouldHaveAccess).toBe(true);
                    } else {
                        // Non-admin roles should only have access to their assigned permissions
                        const hasExactPermission = actualPermissions.includes(permission);
                        const hasWildcardPermission = actualPermissions.some(p => {
                            if (typeof p === 'string' && p.endsWith(':*')) {
                                const prefix = p.slice(0, -2);
                                return permission.startsWith(prefix + ':');
                            }
                            return false;
                        });
                        
                        expect(shouldHaveAccess).toBe(hasExactPermission || hasWildcardPermission);
                    }
                }
            ), { numRuns: 25 });
        });

        test('For any citizen role, admin-only permissions should be denied', () => {
            return fc.assert(fc.property(
                fc.constantFrom(...Object.values(PERMISSIONS).filter(p => 
                    p.startsWith('admin:') || 
                    p.startsWith('system:') || 
                    p.includes(':all') ||
                    p === PERMISSIONS.USER_DEACTIVATE ||
                    p === PERMISSIONS.USER_ACTIVATE ||
                    p === PERMISSIONS.ECOPOINTS_AWARD ||
                    p === PERMISSIONS.ECOPOINTS_DEDUCT
                )),
                (adminPermission) => {
                    const citizenHasPermission = hasPermission('citizen', adminPermission);
                    expect(citizenHasPermission).toBe(false);
                }
            ), { numRuns: 12 });
        });

        test('For any collector role, citizen-specific permissions should be appropriately restricted', () => {
            return fc.assert(fc.property(
                fc.constantFrom(
                    PERMISSIONS.WASTE_CREATE,
                    PERMISSIONS.PICKUP_CREATE,
                    PERMISSIONS.REWARDS_REDEEM
                ),
                (citizenPermission) => {
                    const collectorHasPermission = hasPermission('collector', citizenPermission);
                    // Collectors should not have citizen-specific permissions
                    expect(collectorHasPermission).toBe(false);
                }
            ), { numRuns: 7 });
        });

        test('For any admin role, all permissions should be granted', () => {
            return fc.assert(fc.property(
                permissionGen(),
                (permission) => {
                    const adminHasPermission = hasPermission('admin', permission);
                    expect(adminHasPermission).toBe(true);
                }
            ), { numRuns: 25 });
        });

        test('For any role, own resource access should be properly validated', () => {
            return fc.assert(fc.property(
                roleGen(),
                fc.constantFrom(
                    PERMISSIONS.PROFILE_READ_OWN,
                    PERMISSIONS.PROFILE_UPDATE_OWN,
                    PERMISSIONS.WASTE_READ_OWN,
                    PERMISSIONS.PICKUP_READ_OWN
                ),
                (role, ownResourcePermission) => {
                    const hasOwnResourceAccess = hasPermission(role, ownResourcePermission);
                    
                    if (role === 'admin') {
                        // Admin should have access to everything
                        expect(hasOwnResourceAccess).toBe(true);
                    } else {
                        // Non-admin roles should have access to their own resources
                        const rolePermissions = ROLE_PERMISSIONS[role] || [];
                        const shouldHaveAccess = rolePermissions.includes(ownResourcePermission) ||
                                               rolePermissions.includes(ownResourcePermission.replace(':own', ':*'));
                        expect(hasOwnResourceAccess).toBe(shouldHaveAccess);
                    }
                }
            ), { numRuns: 12 });
        });

        test('For any permission hierarchy, wildcard permissions should grant access to specific permissions', () => {
            return fc.assert(fc.property(
                roleGen(),
                fc.record({
                    resource: fc.constantFrom('waste', 'pickup', 'profile', 'ecopoints'),
                    action: fc.constantFrom('create', 'read', 'update', 'delete')
                }),
                (role, { resource, action }) => {
                    const specificPermission = `${resource}:${action}`;
                    const wildcardPermission = `${resource}:*`;
                    
                    const rolePermissions = ROLE_PERMISSIONS[role] || [];
                    const hasWildcard = rolePermissions.includes(wildcardPermission);
                    const hasSpecific = rolePermissions.includes(specificPermission);
                    
                    if (hasWildcard) {
                        // If role has wildcard permission, it should have access to specific permission
                        const calculatedAccess = hasPermission(role, specificPermission);
                        expect(calculatedAccess).toBe(true);
                    }
                    
                    if (hasSpecific) {
                        // If role has specific permission, access should be granted
                        const calculatedAccess = hasPermission(role, specificPermission);
                        expect(calculatedAccess).toBe(true);
                    }
                }
            ), { numRuns: 20 });
        });

        test('For any role combination, permission inheritance should be consistent', () => {
            return fc.assert(fc.property(
                fc.array(roleGen(), { minLength: 1, maxLength: 3 }),
                permissionGen(),
                (roles, permission) => {
                    const accessResults = roles.map(role => ({
                        role,
                        hasAccess: hasPermission(role, permission)
                    }));
                    
                    // Admin should always have the highest access level
                    const adminResult = accessResults.find(r => r.role === 'admin');
                    if (adminResult) {
                        expect(adminResult.hasAccess).toBe(true);
                    }
                    
                    // Results should be deterministic for the same role
                    const uniqueRoles = [...new Set(roles)];
                    uniqueRoles.forEach(role => {
                        const roleResults = accessResults.filter(r => r.role === role);
                        const firstResult = roleResults[0].hasAccess;
                        roleResults.forEach(result => {
                            expect(result.hasAccess).toBe(firstResult);
                        });
                    });
                }
            ), { numRuns: 15 });
        });
    });

    // Property: Permission Matrix Consistency
    describe('Property: Permission Matrix Consistency', () => {
        test('For any role, all assigned permissions should be valid permissions', () => {
            return fc.assert(fc.property(
                roleGen(),
                (role) => {
                    const rolePermissions = ROLE_PERMISSIONS[role] || [];
                    const validPermissions = Object.values(PERMISSIONS);
                    
                    rolePermissions.forEach(permission => {
                        // Skip undefined or null permissions
                        if (!permission || typeof permission !== 'string') {
                            return;
                        }
                        
                        // Check if it's a valid permission or a valid wildcard
                        const isValidPermission = validPermissions.includes(permission);
                        const isValidWildcard = permission.endsWith(':*') && 
                            validPermissions.some(p => p.startsWith(permission.slice(0, -1)));
                        
                        expect(isValidPermission || isValidWildcard).toBe(true);
                    });
                }
            ), { numRuns: 7 });
        });

        test('For any permission, it should belong to at least one role or be admin-only', () => {
            return fc.assert(fc.property(
                permissionGen(),
                (permission) => {
                    const roles = Object.keys(ROLE_PERMISSIONS);
                    const assignedToRole = roles.some(role => 
                        hasPermission(role, permission)
                    );
                    
                    // Every permission should be assigned to at least one role
                    expect(assignedToRole).toBe(true);
                }
            ), { numRuns: 25 });
        });
    });

    // Property: Role Hierarchy Validation
    describe('Property: Role Hierarchy Validation', () => {
        test('For any operation, admin role should have equal or greater access than other roles', () => {
            return fc.assert(fc.property(
                permissionGen(),
                fc.constantFrom('citizen', 'collector'),
                (permission, nonAdminRole) => {
                    const adminAccess = hasPermission('admin', permission);
                    const roleAccess = hasPermission(nonAdminRole, permission);
                    
                    // If a non-admin role has access, admin should also have access
                    if (roleAccess) {
                        expect(adminAccess).toBe(true);
                    }
                    
                    // Admin should always have access (this is a stronger assertion)
                    expect(adminAccess).toBe(true);
                }
            ), { numRuns: 20 });
        });

        test('For any resource operation, role permissions should not conflict', () => {
            return fc.assert(fc.property(
                fc.record({
                    resource: fc.constantFrom('waste', 'pickup', 'profile'),
                    action: fc.constantFrom('create', 'read', 'update', 'delete'),
                    scope: fc.constantFrom('own', 'all')
                }),
                ({ resource, action, scope }) => {
                    const permission = `${resource}:${action}:${scope}`;
                    const roles = ['citizen', 'collector', 'admin'];
                    
                    const accessMap = roles.map(role => ({
                        role,
                        hasAccess: hasPermission(role, permission)
                    }));
                    
                    // Validate logical consistency
                    const citizenAccess = accessMap.find(r => r.role === 'citizen')?.hasAccess;
                    const collectorAccess = accessMap.find(r => r.role === 'collector')?.hasAccess;
                    const adminAccess = accessMap.find(r => r.role === 'admin')?.hasAccess;
                    
                    // Admin should always have access
                    expect(adminAccess).toBe(true);
                    
                    // If it's an 'all' scope permission, it should be more restricted
                    if (scope === 'all') {
                        // Only admin should typically have 'all' scope permissions
                        if (citizenAccess || collectorAccess) {
                            // If non-admin has 'all' access, it should be explicitly granted
                            const rolePermissions = ROLE_PERMISSIONS[citizenAccess ? 'citizen' : 'collector'];
                            const hasExplicitPermission = rolePermissions.includes(permission) ||
                                                         rolePermissions.includes(`${resource}:*`);
                            expect(hasExplicitPermission).toBe(true);
                        }
                    }
                }
            ), { numRuns: 12 });
        });
    });
});