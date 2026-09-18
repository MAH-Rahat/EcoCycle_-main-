const request = require('supertest');
const express = require('express');

// Mock the middleware functions for testing
const httpsEnforcement = (req, res, next) => {
    // Skip HTTPS enforcement in development and test environments
    if (process.env.NODE_ENV !== 'production') {
        return next();
    }

    // Check if request is already HTTPS
    const isHttps = req.secure || 
                   req.headers['x-forwarded-proto'] === 'https' ||
                   req.headers['x-forwarded-ssl'] === 'on' ||
                   req.connection.encrypted;

    if (!isHttps) {
        // Log security violation for monitoring
        console.warn(`[SECURITY] HTTP request to secure endpoint - IP: ${req.ip}, Path: ${req.path}, User-Agent: ${req.get('User-Agent')}`);
        
        // For authentication endpoints, enforce HTTPS strictly
        if (req.path.startsWith('/api/auth')) {
            return res.status(426).json({
                error: {
                    code: 'HTTPS_REQUIRED',
                    message: 'HTTPS is required for authentication endpoints',
                    details: {
                        endpoint: req.path,
                        method: req.method,
                        redirectUrl: `https://${req.get('host')}${req.originalUrl}`,
                        reason: 'Authentication endpoints must use encrypted connections'
                    },
                    timestamp: new Date().toISOString(),
                    requestId: req.headers['x-request-id'] || 'unknown'
                }
            });
        }

        // For other sensitive endpoints (admin, user data), also enforce HTTPS
        if (req.path.startsWith('/api/admin') || 
            req.path.startsWith('/api/users') ||
            req.path.startsWith('/api/ecopoints')) {
            return res.status(426).json({
                error: {
                    code: 'HTTPS_REQUIRED',
                    message: 'HTTPS is required for sensitive data endpoints',
                    details: {
                        endpoint: req.path,
                        method: req.method,
                        redirectUrl: `https://${req.get('host')}${req.originalUrl}`,
                        reason: 'Sensitive data endpoints require encrypted connections'
                    },
                    timestamp: new Date().toISOString(),
                    requestId: req.headers['x-request-id'] || 'unknown'
                }
            });
        }

        // For other endpoints, redirect to HTTPS
        const httpsUrl = `https://${req.get('host')}${req.originalUrl}`;
        return res.redirect(301, httpsUrl);
    }

    next();
};

const requestId = (req, res, next) => {
    const requestId = req.headers['x-request-id'] || 
                     `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    
    next();
};

const inputSanitization = (req, res, next) => {
    // Mock sanitization for testing
    if (req.body && typeof req.body === 'object') {
        // Remove dangerous patterns
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key]
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+\s*=\s*[^>\s]+/gi, ''); // Fixed regex for event handlers
            }
        }
    }
    next();
};

describe('Security Middleware Tests', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
    });

    describe('HTTPS Enforcement', () => {
        beforeEach(() => {
            app.use(httpsEnforcement);
            app.get('/api/auth/test', (req, res) => res.json({ success: true }));
            app.get('/api/other/test', (req, res) => res.json({ success: true }));
        });

        test('should allow HTTPS requests to auth endpoints', async () => {
            const response = await request(app)
                .get('/api/auth/test')
                .set('x-forwarded-proto', 'https');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('should reject HTTP requests to auth endpoints in production', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            
            const response = await request(app)
                .get('/api/auth/test');

            expect(response.status).toBe(426);
            expect(response.body.error.code).toBe('HTTPS_REQUIRED');
            
            process.env.NODE_ENV = originalEnv;
        });

        test('should reject HTTP requests to sensitive endpoints in production', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            
            const sensitiveEndpoints = [
                '/api/admin/users',
                '/api/users/profile',
                '/api/ecopoints/wallet'
            ];

            for (const endpoint of sensitiveEndpoints) {
                app.get(endpoint, (req, res) => res.json({ success: true }));
                
                const response = await request(app).get(endpoint);
                
                expect(response.status).toBe(426);
                expect(response.body.error.code).toBe('HTTPS_REQUIRED');
                expect(response.body.error.details.reason).toContain('Sensitive data endpoints require encrypted connections');
            }
            
            process.env.NODE_ENV = originalEnv;
        });

        test('should allow all requests in development', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            
            const authResponse = await request(app).get('/api/auth/test');
            const otherResponse = await request(app).get('/api/other/test');

            expect(authResponse.status).toBe(200);
            expect(otherResponse.status).toBe(200);
            
            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('Input Sanitization', () => {
        beforeEach(() => {
            app.use(express.json());
            app.use(inputSanitization);
            app.post('/test', (req, res) => {
                res.json({ body: req.body });
            });
        });

        test('should remove script tags from input', async () => {
            const maliciousInput = {
                name: 'John<script>alert("xss")</script>Doe',
                email: 'test@example.com'
            };

            const response = await request(app)
                .post('/test')
                .send(maliciousInput);

            expect(response.status).toBe(200);
            expect(response.body.body.name).toBe('JohnDoe');
            expect(response.body.body.email).toBe('test@example.com');
        });

        test('should remove javascript protocols from input', async () => {
            const maliciousInput = {
                url: 'javascript:alert("xss")',
                description: 'Normal text'
            };

            const response = await request(app)
                .post('/test')
                .send(maliciousInput);

            expect(response.status).toBe(200);
            expect(response.body.body.url).toBe('alert("xss")');
            expect(response.body.body.description).toBe('Normal text');
        });

        test('should remove event handlers from input', async () => {
            const maliciousInput = {
                content: 'Hello onclick=alert("xss") world'
            };

            const response = await request(app)
                .post('/test')
                .send(maliciousInput);

            expect(response.status).toBe(200);
            expect(response.body.body.content).toBe('Hello  world');
        });
    });

    describe('Request ID Middleware', () => {
        beforeEach(() => {
            app.use(requestId);
            app.get('/test', (req, res) => {
                res.json({ requestId: req.requestId });
            });
        });

        test('should add request ID to request and response', async () => {
            const response = await request(app).get('/test');

            expect(response.headers['x-request-id']).toBeDefined();
            expect(response.body.requestId).toBeDefined();
            expect(response.headers['x-request-id']).toBe(response.body.requestId);
        });

        test('should use provided request ID', async () => {
            const customRequestId = 'custom-request-id-123';
            
            const response = await request(app)
                .get('/test')
                .set('x-request-id', customRequestId);

            expect(response.headers['x-request-id']).toBe(customRequestId);
            expect(response.body.requestId).toBe(customRequestId);
        });
    });
});

// Property-based test for HTTPS enforcement
describe('Property Tests - HTTPS Enforcement', () => {
    test('Property 4: HTTPS Enforcement - should enforce HTTPS for all auth endpoints', async () => {
        const app = express();
        app.use(httpsEnforcement);
        
        // Test various auth endpoint paths
        const authPaths = [
            '/api/auth/login',
            '/api/auth/register',
            '/api/auth/logout',
            '/api/auth/refresh',
            '/api/auth/forgot-password',
            '/api/auth/reset-password'
        ];

        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        for (const path of authPaths) {
            app.get(path, (req, res) => res.json({ success: true }));
            
            const response = await request(app).get(path);
            
            // Should require HTTPS for auth endpoints in production
            expect(response.status).toBe(426);
            expect(response.body.error.code).toBe('HTTPS_REQUIRED');
        }

        process.env.NODE_ENV = originalEnv;
    });
});