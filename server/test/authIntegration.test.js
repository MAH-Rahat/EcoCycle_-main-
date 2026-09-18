import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import authRoutes from '../routes/authRoutes.js';
import { secureErrorHandler } from '../middleware/errorHandling.js';

describe('Authentication Integration Tests', () => {
    let app;

    beforeAll(async () => {
        // Create test app
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        app.use(secureErrorHandler);

        // Connect to test database
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    afterEach(async () => {
        await User.deleteMany({});
    });

    describe('User Registration', () => {
        test('should register a new citizen successfully', async () => {
            const userData = {
                name: 'John Doe',
                email: 'john@example.com',
                username: 'johndoe',
                password: 'password123',
                role: 'citizen'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.email).toBe(userData.email);
            expect(response.body.data.role).toBe(userData.role);
            expect(response.body.data.token).toBeDefined();
            expect(response.body.data.token).not.toBe('JWT_SKIPPED_FOR_TESTING');

            // Verify user was created in database
            const user = await User.findOne({ email: userData.email });
            expect(user).toBeTruthy();
            expect(user.password).not.toBe(userData.password); // Should be hashed
        });

        test('should register a new collector successfully', async () => {
            const userData = {
                name: 'Jane Smith',
                email: 'jane@example.com',
                username: 'janesmith',
                password: 'password123',
                role: 'collector'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.role).toBe('collector');
        });

        test('should prevent duplicate email registration', async () => {
            const userData = {
                name: 'John Doe',
                email: 'john@example.com',
                username: 'johndoe',
                password: 'password123',
                role: 'citizen'
            };

            // Register first user
            await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            // Try to register with same email
            const duplicateData = {
                ...userData,
                username: 'johndoe2'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(duplicateData)
                .expect(400);

            expect(response.body.error).toBeDefined();
            expect(response.body.error.code).toBe('DUPLICATE_USER');
        });
    });

    describe('User Login', () => {
        beforeEach(async () => {
            // Create a test user
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
                role: 'citizen'
            };

            await request(app)
                .post('/api/auth/register')
                .send(userData);
        });

        test('should login with valid credentials', async () => {
            const loginData = {
                email: 'test@example.com',
                password: 'password123'
            };

            const response = await request(app)
                .post('/api/auth/login')
                .send(loginData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.email).toBe(loginData.email);
            expect(response.body.data.token).toBeDefined();
            expect(response.body.data.token).not.toBe('JWT_SKIPPED_FOR_TESTING');
        });

        test('should reject invalid email', async () => {
            const loginData = {
                email: 'wrong@example.com',
                password: 'password123'
            };

            const response = await request(app)
                .post('/api/auth/login')
                .send(loginData)
                .expect(401);

            expect(response.body.error).toBeDefined();
            expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
        });

        test('should reject invalid password', async () => {
            const loginData = {
                email: 'test@example.com',
                password: 'wrongpassword'
            };

            const response = await request(app)
                .post('/api/auth/login')
                .send(loginData)
                .expect(401);

            expect(response.body.error).toBeDefined();
            expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
        });
    });

    describe('Password Security', () => {
        test('should hash passwords with bcrypt', async () => {
            const userData = {
                name: 'Security Test',
                email: 'security@example.com',
                username: 'securitytest',
                password: 'testpassword123',
                role: 'citizen'
            };

            await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            const user = await User.findOne({ email: userData.email });
            
            // Password should be hashed
            expect(user.password).not.toBe(userData.password);
            expect(user.password).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/); // bcrypt format
            
            // Should be able to verify password
            const isMatch = await user.matchPassword(userData.password);
            expect(isMatch).toBe(true);
        });
    });

    describe('JWT Token Generation', () => {
        test('should generate valid JWT tokens on login', async () => {
            const userData = {
                name: 'JWT Test',
                email: 'jwt@example.com',
                username: 'jwttest',
                password: 'password123',
                role: 'citizen'
            };

            // Register user
            await request(app)
                .post('/api/auth/register')
                .send(userData);

            // Login and get token
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({ email: userData.email, password: userData.password })
                .expect(200);

            const token = loginResponse.body.data.token;
            
            // Token should be a valid JWT format (3 parts separated by dots)
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3);
        });
    });
});