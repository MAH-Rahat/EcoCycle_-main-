/**
 * RBAC Middleware Test Suite
 * Tests role-based access control middleware functionality
 * Validates: Requirements 12.4, 12.5, 16.3 - RBAC implementation
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import User from '../models/User.js';
import { 
    protect, 
    authorize, 
    requirePermission, 
    requireOwnership, 
    requireAdmin 
} from '../middleware/authMiddleware.js';
import {
    checkPermissions,
    checkResourceAccess,
    checkAdminOperation,
    protectRoute
} from '../middleware/rbacMiddleware.js';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../middleware/rbacConfig.js';

// Mock users for testing
const mockUsers = {
    citizen: {
        _id: '507f1f77bcf86cd799439011',
        email: 'citizen@test.com',
        role: 'citizen',
        isActive: true
    },
    collector: {
        _id: '507f1f77bcf86cd799439012',
        email: 'collector@test.com',
        role: 'collector',
        isActive: true
    },
    admin: {
        _id: '507f1f77bcf86cd799439013',
        email: 'admin@test.com',
        role: 'admin',
        isActive: true
    },
    inactiveUser: {
        _id: '507f1f77bcf86cd799439014',
        email: 'inactive@test.com',
        role: 'citizen',
        isActive: false
    }
};

// Helper function to generate JWT token
const generateToken = (user) => {
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret', {
        expiresIn: '1h'
    });
};

// Mock User.findById
jest.mock('../models/User.js');

describe('RBAC Middleware Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup User.findById mock
        User.findById.mockImplementation((id) => {
            const user = Object.values(mockUsers).find(u => u._id === id);
            if (user) {
                return {
                    select: jest.fn().mockResolvedValue(user)
                };
            }
            return {
                select: jest.fn().mockResolvedValue(null)
            };
        });
    });

    describe('Authentication Middleware (protect)', () => {
        let req, res, next;

        beforeEach(() => {
            req = {
                headers: {},
                requestId: 'test-request-id'
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            next = jest.fn();
        });

        test('should authenticate valid token', async () => {
            const token = generateToken(mockUsers.citizen);
            req.headers.authorization = `Bearer ${token}`;

            await protect(req, res, next);

            expect(req.user).toBeDefined();
            expect(req.user.email).toBe('citizen@test.com');
            expect(next).toHaveBeenCalled();
        });

        test('should reject request without token', async () => {
            await protect(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: 'NO_TOKEN'
                    })
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        test('should reject invalid token', async () => {
            req.headers.authorization = 'Bearer invalid-token';

            await protect(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: 'TOKEN_INVALID'
                    })
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        test('should reject token for non-existent user', async () => {
            const token = jwt.sign({ id: 'nonexistent' }, process.env.JWT_SECRET || 'test-secret');
            req.headers.authorization = `Bearer ${token}`;

            await protect(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: 'USER_NOT_FOUND'
                    })
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        test('should reject token for inactive user', async () => {
            const token = generateToken(mockUsers.inactiveUser);
            req.headers.authorization = `Bearer ${token}`;

            await protect(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: 'ACCOUNT_DISABLED'
                    })
                })
            );
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('Role Authorization Middleware (authorize)', () => {
        let req, res, next;

        beforeEach(() => {
            req = {
                path: '/test-path',
                requestId: 'test-request-id'
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            next = jest.fn();
        });

        test('should allow access for authorized role', () => {
            req.user = mockUsers.admin;
            const middleware = authorize('admin', 'collector');

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should deny access for unauthorized role', () => {
            req.user = mockUsers.citizen;
            const middleware = authorize('admin', 'collector');

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: 'INSUFFICIENT_PERMISSIONS'
                    })
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        test('should deny access without user context', () => {
            const middleware = authorize('admin');

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: 'AUTHENTICATION_REQUIRED'
                    })
                })
            );
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('Permission-Based Authorization (requirePermission)', () => {
        let req, res, next;

        beforeEach(() => {
            req = {
                path: '/test-path',
                requestId: 'test-request-id'
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            next = jest.fn();
        });

        test('should allow access with required permission', () => {
            req.user = mockUsers.citizen;
            const middleware = requirePermission(PERMISSIONS.WASTE_CREATE);

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should deny access without required permission', () => {
            req.user = mockUsers.citizen;
            const middleware = requirePermission(PERMISSIONS.ADMIN_USERS);

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: 'PERMISSION_DENIED'
                    })
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        test('should allow admin access to all permissions', () => {
            req.user = mockUsers.admin;
            const middleware = requirePermission(PERMISSIONS.WASTE_CREATE);

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });

    describe('Resource Ownership Middleware (requireOwnership)', () => {
        let req, res, next;

        beforeEach(() => {
            req = {
                params: { id: '507f1f77bcf86cd799439011' },
                requestId: 'test-request-id'
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            next = jest.fn();
        });

        test('should allow access to own resource', () => {
            req.user = mockUsers.citizen;
            const middleware = requireOwnership('id');

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should deny access to other user resource', () => {
            req.user = mockUsers.collector;
            const middleware = requireOwnership('id');

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: 'RESOURCE_ACCESS_DENIED'
                    })
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        test('should allow admin access to any resource', () => {
            req.user = mockUsers.admin;
            const middleware = requireOwnership('id');

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });

    describe('Admin Access Control (requireAdmin)', () => {
        let req, res, next;

        beforeEach(() => {
            req = {
                path: '/admin/test',
                method: 'GET',
                requestId: 'test-request-id'
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            next = jest.fn();
        });

        test('should allow admin access', () => {
            req.user = mockUsers.admin;

            requireAdmin(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should deny non-admin access', () => {
            req.user = mockUsers.citizen;

            requireAdmin(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: 'ADMIN_ACCESS_REQUIRED'
                    })
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        test('should deny access without authentication', () => {
            requireAdmin(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: 'AUTHENTICATION_REQUIRED'
                    })
                })
            );
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('Dynamic Permission Checking (checkPermissions)', () => {
        let req, res, next;

        beforeEach(() => {
            req = {
                path: '/test-path',
                requestId: 'test-request-id'
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            next = jest.fn();
        });

        test('should handle single permission check', () => {
            req.user = mockUsers.citizen;
            const middleware = checkPermissions(PERMISSIONS.WASTE_CREATE);

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should handle array of permissions (ALL required)', () => {
            req.user = mockUsers.citizen;
            const middleware = checkPermissions([PERMISSIONS.WASTE_CREATE, PERMISSIONS.WASTE_READ_OWN]);

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should handle ANY permission check', () => {
            req.user = mockUsers.citizen;
            const middleware = checkPermissions({
                any: [PERMISSIONS.WASTE_CREATE, PERMISSIONS.ADMIN_USERS]
            });

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should handle dynamic permission function', () => {
            req.user = mockUsers.citizen;
            const middleware = checkPermissions((user, req) => ({
                allowed: user.role === 'citizen',
                permissions: ['dynamic:permission']
            }));

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should deny access for insufficient permissions', () => {
            req.user = mockUsers.citizen;
            const middleware = checkPermissions(PERMISSIONS.ADMIN_USERS);

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: 'INSUFFICIENT_PERMISSIONS'
                    })
                })
            );
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('Route Protection (protectRoute)', () => {
        let req, res, next;

        beforeEach(() => {
            req = {
                path: '/test-path',
                requestId: 'test-request-id'
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            next = jest.fn();
        });

        test('should allow access for AUTHENTICATED protection', () => {
            req.user = mockUsers.citizen;
            const middleware = protectRoute('AUTHENTICATED');

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should allow access for ADMIN_ONLY protection with admin user', () => {
            req.user = mockUsers.admin;
            const middleware = protectRoute('ADMIN_ONLY');

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should deny access for ADMIN_ONLY protection with non-admin user', () => {
            req.user = mockUsers.citizen;
            const middleware = protectRoute('ADMIN_ONLY');

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: 'INSUFFICIENT_ROLE'
                    })
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        test('should allow PUBLIC access without authentication', () => {
            const middleware = protectRoute('PUBLIC');

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });

    describe('Admin Operation Checking (checkAdminOperation)', () => {
        let req, res, next;

        beforeEach(() => {
            req = {
                path: '/admin/users',
                requestId: 'test-request-id'
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            next = jest.fn();
        });

        test('should allow admin to perform user management operations', () => {
            req.user = mockUsers.admin;
            const middleware = checkAdminOperation('USER_MANAGEMENT');

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should deny non-admin from performing admin operations', () => {
            req.user = mockUsers.citizen;
            const middleware = checkAdminOperation('USER_MANAGEMENT');

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: 'INSUFFICIENT_ADMIN_PERMISSIONS'
                    })
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        test('should deny access without authentication', () => {
            const middleware = checkAdminOperation('USER_MANAGEMENT');

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: 'AUTHENTICATION_REQUIRED'
                    })
                })
            );
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('Role Permission Matrix Validation', () => {
        test('citizen should have correct permissions', () => {
            const citizenPermissions = ROLE_PERMISSIONS.citizen;
            
            expect(citizenPermissions).toContain(PERMISSIONS.WASTE_CREATE);
            expect(citizenPermissions).toContain(PERMISSIONS.PICKUP_CREATE);
            expect(citizenPermissions).toContain(PERMISSIONS.PROFILE_READ_OWN);
            expect(citizenPermissions).not.toContain(PERMISSIONS.ADMIN_USERS);
            expect(citizenPermissions).not.toContain(PERMISSIONS.QR_VERIFY);
        });

        test('collector should have correct permissions', () => {
            const collectorPermissions = ROLE_PERMISSIONS.collector;
            
            expect(collectorPermissions).toContain(PERMISSIONS.QR_VERIFY);
            expect(collectorPermissions).toContain(PERMISSIONS.PICKUP_COMPLETE);
            expect(collectorPermissions).toContain(PERMISSIONS.COLLECTION_CREATE);
            expect(collectorPermissions).not.toContain(PERMISSIONS.WASTE_CREATE);
            expect(collectorPermissions).not.toContain(PERMISSIONS.ADMIN_USERS);
        });

        test('admin should have all permissions', () => {
            const adminPermissions = ROLE_PERMISSIONS.admin;
            const allPermissions = Object.values(PERMISSIONS);
            
            allPermissions.forEach(permission => {
                expect(adminPermissions).toContain(permission);
            });
        });
    });

    describe('Integration Tests', () => {
        test('should protect admin routes with proper RBAC', async () => {
            const citizenToken = generateToken(mockUsers.citizen);
            
            const response = await request(app)
                .get('/api/users/all')
                .set('Authorization', `Bearer ${citizenToken}`);

            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('ADMIN_ACCESS_REQUIRED');
        });

        test('should allow admin access to admin routes', async () => {
            const adminToken = generateToken(mockUsers.admin);
            
            // Note: This test might fail if the actual route implementation requires database setup
            // In a real scenario, you'd mock the controller functions as well
            const response = await request(app)
                .get('/api/users/all')
                .set('Authorization', `Bearer ${adminToken}`);

            // Should not be 403 (access denied), might be 500 due to missing DB setup
            expect(response.status).not.toBe(403);
        });
    });
});

// Feature: ecocycle-platform, Property 58: Role-Based Access Control
describe('Property-Based Tests: Role-Based Access Control', () => {
    test('Property 58: Role-based access control should be enforced for all data operations', () => {
        // Test that each role can only access operations they're authorized for
        const testCases = [
            {
                role: 'citizen',
                allowedOperations: ['waste:create', 'pickup:create', 'profile:read:own'],
                deniedOperations: ['admin:users', 'qr:verify', 'system:config']
            },
            {
                role: 'collector',
                allowedOperations: ['qr:verify', 'pickup:complete', 'collection:create'],
                deniedOperations: ['waste:create', 'admin:users', 'system:config']
            },
            {
                role: 'admin',
                allowedOperations: ['admin:users', 'system:config', 'waste:create', 'qr:verify'],
                deniedOperations: [] // Admin should have access to everything
            }
        ];

        testCases.forEach(({ role, allowedOperations, deniedOperations }) => {
            const userPermissions = ROLE_PERMISSIONS[role];
            
            // Check allowed operations
            allowedOperations.forEach(operation => {
                const hasPermission = userPermissions.includes(operation) || 
                                    userPermissions.some(p => p.endsWith(':*')) ||
                                    userPermissions.includes('*');
                expect(hasPermission).toBe(true, 
                    `Role ${role} should have permission for ${operation}`);
            });

            // Check denied operations (only for non-admin roles)
            if (role !== 'admin') {
                deniedOperations.forEach(operation => {
                    const hasPermission = userPermissions.includes(operation);
                    expect(hasPermission).toBe(false, 
                        `Role ${role} should NOT have permission for ${operation}`);
                });
            }
        });
    });
});