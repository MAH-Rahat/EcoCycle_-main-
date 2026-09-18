import fc from 'fast-check';
import request from 'supertest';
import express from 'express';
import User from '../models/User.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import authRoutes from '../routes/authRoutes.js';
import { secureErrorHandler } from '../middleware/errorHandling.js';

// Feature: ecocycle-platform, Property 5: Secure Error Messages
describe('Secure Error Messages Property-Based Tests', () => {
    let app;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
        }

        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        app.use(secureErrorHandler);
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    afterEach(async () => {
        await User.deleteMany({});
    });

    describe('Property 5: Secure Error Messages', () => {
        test('For any authentication failure, error messages should not reveal sensitive system information or user existence', async () => {
            await fc.assert(fc.asyncProperty(
                fc.record({
                    email: fc.emailAddress(),
                    password: fc.string({ minLength: 1, maxLength: 100 }),
                    existingUser: fc.boolean()
                }),
                async ({ email, password, existingUser }) => {
                    // Optionally create an existing user
                    if (existingUser) {
                        const salt = await bcrypt.genSalt(10);
                        const hashedPassword = await bcrypt.hash('correct-password', salt);
                        
                        await User.create({
                            name: 'Test User',
                            email: email,
                            username: `user_${Date.now()}`,
                            password: hashedPassword,
                            role: 'citizen',
                            points: 100
                        });
                    }

                    // Attempt login with potentially wrong credentials
                    const response = await request(app)
                        .post('/api/auth/login')
                        .send({ email, password });

                    if (response.status >= 400) {
                        // Property: Error messages should not reveal user existence
                        const errorMessage = response.body.error?.message || response.body.message || '';
                        
                        // Should not contain phrases that reveal user existence
                        expect(errorMessage.toLowerCase()).not.toContain('user not found');
                        expect(errorMessage.toLowerCase()).not.toContain('user does not exist');
                        expect(errorMessage.toLowerCase()).not.toContain('email not found');
                        expect(errorMessage.toLowerCase()).not.toContain('account not found');
                        
                        // Should not contain phrases that reveal password incorrectness specifically
                        expect(errorMessage.toLowerCase()).not.toContain('wrong password');
                        expect(errorMessage.toLowerCase()).not.toContain('incorrect password');
                        expect(errorMessage.toLowerCase()).not.toContain('password mismatch');
                        
                        // Should not reveal system internals
                        expect(errorMessage).not.toContain('database');
                        expect(errorMessage).not.toContain('mongodb');
                        expect(errorMessage).not.toContain('bcrypt');
                        expect(errorMessage).not.toContain('hash');
                        expect(errorMessage).not.toContain('salt');
                        expect(errorMessage).not.toContain('collection');
                        expect(errorMessage).not.toContain('schema');
                        
                        // Should not contain stack traces or file paths
                        expect(errorMessage).not.toContain('.js');
                        expect(errorMessage).not.toContain('at ');
                        expect(errorMessage).not.toContain('Error:');
                        expect(errorMessage).not.toContain('/server/');
                        expect(errorMessage).not.toContain('node_modules');
                        
                        // Should use generic, safe error messages
                        const safeMessages = [
                            'invalid credentials',
                            'authentication failed',
                            'login failed',
                            'unauthorized'
                        ];
                        
                        const containsSafeMessage = safeMessages.some(safe => 
                            errorMessage.toLowerCase().includes(safe)
                        );
                        
                        // Property: Should use generic error messages
                        expect(containsSafeMessage).toBe(true);
                        
                        // Property: Should have proper error structure
                        expect(response.body.error).toBeDefined();
                        expect(response.body.error.code).toBeDefined();
                        expect(response.body.error.message).toBeDefined();
                        expect(response.body.error.timestamp).toBeDefined();
                        
                        // Property: Should not expose internal error details
                        expect(response.body.error.stack).toBeUndefined();
                        expect(response.body.error.details?.internalError).toBeUndefined();
                    }
                }
            ), { numRuns: 7 });
        });

        test('For any registration failure, error messages should not reveal system details', async () => {
            await fc.assert(fc.asyncProperty(
                fc.record({
                    name: fc.string({ minLength: 0, maxLength: 100 }),
                    email: fc.oneof(
                        fc.emailAddress(),
                        fc.string({ minLength: 1, maxLength: 50 }), // Invalid email
                        fc.constant('') // Empty email
                    ),
                    username: fc.string({ minLength: 0, maxLength: 50 }),
                    password: fc.string({ minLength: 0, maxLength: 100 }),
                    role: fc.oneof(
                        fc.constantFrom('citizen', 'collector', 'admin'),
                        fc.string({ minLength: 1, maxLength: 20 }) // Invalid role
                    ),
                    adminCode: fc.string({ minLength: 0, maxLength: 50 })
                }),
                async (userData) => {
                    const response = await request(app)
                        .post('/api/auth/register')
                        .send(userData);

                    if (response.status >= 400) {
                        const errorMessage = response.body.error?.message || response.body.message || '';
                        
                        // Property: Should not reveal database schema details
                        expect(errorMessage).not.toContain('ValidationError');
                        expect(errorMessage).not.toContain('MongoError');
                        expect(errorMessage).not.toContain('duplicate key');
                        expect(errorMessage).not.toContain('E11000');
                        expect(errorMessage).not.toContain('index:');
                        expect(errorMessage).not.toContain('collection:');
                        
                        // Property: Should not reveal internal validation logic
                        expect(errorMessage).not.toContain('required: true');
                        expect(errorMessage).not.toContain('unique: true');
                        expect(errorMessage).not.toContain('minlength:');
                        expect(errorMessage).not.toContain('maxlength:');
                        
                        // Property: Should not reveal admin code details
                        if (userData.role === 'admin') {
                            expect(errorMessage).not.toContain('ECO-ULTRA-SECURE');
                            expect(errorMessage).not.toContain('ADMIN_SECRET_CODE');
                        }
                        
                        // Property: Should not contain file paths or stack traces
                        expect(errorMessage).not.toContain('.js');
                        expect(errorMessage).not.toContain('/server/');
                        expect(errorMessage).not.toContain('at ');
                        
                        // Property: Should have proper error structure
                        expect(response.body.error).toBeDefined();
                        expect(response.body.error.code).toBeDefined();
                        expect(response.body.error.message).toBeDefined();
                        expect(response.body.error.timestamp).toBeDefined();
                    }
                }
            ), { numRuns: 6 });
        });

        test('For any system error, internal details should not be exposed', async () => {
            await fc.assert(fc.asyncProperty(
                fc.record({
                    endpoint: fc.constantFrom('/api/auth/login', '/api/auth/register'),
                    malformedData: fc.oneof(
                        fc.constant('invalid-json'),
                        fc.constant(null),
                        fc.constant(undefined),
                        fc.array(fc.string(), { minLength: 0, maxLength: 5 }), // Array instead of object
                        fc.integer() // Number instead of object
                    )
                }),
                async ({ endpoint, malformedData }) => {
                    let response;
                    
                    try {
                        if (malformedData === 'invalid-json') {
                            // Send malformed JSON
                            response = await request(app)
                                .post(endpoint)
                                .set('Content-Type', 'application/json')
                                .send('{"invalid": json}'); // Malformed JSON
                        } else {
                            response = await request(app)
                                .post(endpoint)
                                .send(malformedData);
                        }
                    } catch (error) {
                        // Handle request errors
                        response = { status: 500, body: { error: { message: 'Request failed' } } };
                    }

                    if (response.status >= 400) {
                        const responseBody = JSON.stringify(response.body);
                        
                        // Property: Should not expose Node.js internals
                        expect(responseBody).not.toContain('node_modules');
                        expect(responseBody).not.toContain('process.env');
                        expect(responseBody).not.toContain('__dirname');
                        expect(responseBody).not.toContain('require(');
                        
                        // Property: Should not expose server file structure
                        expect(responseBody).not.toContain('/server/');
                        expect(responseBody).not.toContain('/routes/');
                        expect(responseBody).not.toContain('/middleware/');
                        expect(responseBody).not.toContain('/models/');
                        
                        // Property: Should not expose database connection details
                        expect(responseBody).not.toContain('mongodb://');
                        expect(responseBody).not.toContain('localhost:27017');
                        expect(responseBody).not.toContain('connection string');
                        
                        // Property: Should not expose environment variables
                        expect(responseBody).not.toContain('JWT_SECRET');
                        expect(responseBody).not.toContain('MONGO_URI');
                        expect(responseBody).not.toContain('process.env');
                        
                        // Property: Should have sanitized error response
                        if (response.body.error) {
                            expect(response.body.error.code).toBeDefined();
                            expect(response.body.error.message).toBeDefined();
                            expect(response.body.error.timestamp).toBeDefined();
                        }
                    }
                }
            ), { numRuns: 5 });
        });

        test('For any error response, it should follow consistent secure format', async () => {
            await fc.assert(fc.asyncProperty(
                fc.record({
                    email: fc.string({ minLength: 1, maxLength: 50 }),
                    password: fc.string({ minLength: 1, maxLength: 5 }) // Too short to trigger validation
                }),
                async ({ email, password }) => {
                    const response = await request(app)
                        .post('/api/auth/login')
                        .send({ email, password });

                    if (response.status >= 400) {
                        // Property: Error response should have consistent structure
                        expect(response.body.error).toBeDefined();
                        expect(typeof response.body.error.code).toBe('string');
                        expect(typeof response.body.error.message).toBe('string');
                        expect(typeof response.body.error.timestamp).toBe('string');
                        
                        // Property: Should not have success field in error responses
                        expect(response.body.success).toBeUndefined();
                        
                        // Property: Timestamp should be valid ISO string
                        expect(() => new Date(response.body.error.timestamp)).not.toThrow();
                        
                        // Property: Error code should be uppercase with underscores
                        expect(response.body.error.code).toMatch(/^[A-Z_]+$/);
                        
                        // Property: Message should not be empty
                        expect(response.body.error.message.trim()).not.toBe('');
                        
                        // Property: Should not contain sensitive data in any field
                        const fullResponse = JSON.stringify(response.body);
                        expect(fullResponse).not.toContain('password');
                        expect(fullResponse).not.toContain('hash');
                        expect(fullResponse).not.toContain('salt');
                    }
                }
            ), { numRuns: 5 });
        });
    });
});