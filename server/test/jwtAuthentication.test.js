import fc from 'fast-check';
import jwt from 'jsonwebtoken';
import generateToken from '../utils/generateToken.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// Feature: ecocycle-platform, Property 2: JWT Authentication
describe('JWT Authentication Property-Based Tests', () => {
    const TEST_JWT_SECRET = 'test-jwt-secret-key';
    
    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
        }
        // Set test JWT secret
        process.env.JWT_SECRET = TEST_JWT_SECRET;
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    afterEach(async () => {
        await User.deleteMany({});
    });

    describe('Property 2: JWT Authentication', () => {
        test('For any successful login, a valid JWT token should be issued containing the correct user role and expiration', async () => {
            await fc.assert(fc.asyncProperty(
                fc.record({
                    name: fc.string({ minLength: 1, maxLength: 50 }),
                    email: fc.emailAddress(),
                    username: fc.string({ minLength: 3, maxLength: 30 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
                    password: fc.string({ minLength: 6, maxLength: 100 }),
                    role: fc.constantFrom('citizen', 'collector', 'admin')
                }),
                async (userData) => {
                    // Create user in database
                    const user = await User.create({
                        ...userData,
                        password: 'hashed-password', // Simplified for testing
                        points: 100
                    });

                    // Generate token using the utility
                    const token = generateToken(user._id);
                    
                    // Property: Token should be a valid JWT
                    expect(typeof token).toBe('string');
                    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
                    
                    // Property: Token should be verifiable with the secret
                    const decoded = jwt.verify(token, TEST_JWT_SECRET);
                    expect(decoded).toBeDefined();
                    expect(decoded.id).toBe(user._id.toString());
                    
                    // Property: Token should have expiration
                    expect(decoded.exp).toBeDefined();
                    expect(decoded.iat).toBeDefined();
                    expect(decoded.exp).toBeGreaterThan(decoded.iat);
                    
                    // Property: Token should expire in 30 days (as per generateToken.js)
                    const expectedExpiration = decoded.iat + (30 * 24 * 60 * 60); // 30 days in seconds
                    expect(decoded.exp).toBe(expectedExpiration);
                    
                    // Property: Token should contain user ID that matches database
                    const foundUser = await User.findById(decoded.id);
                    expect(foundUser).toBeDefined();
                    expect(foundUser._id.toString()).toBe(user._id.toString());
                    expect(foundUser.role).toBe(userData.role);
                }
            ), { numRuns: 7 });
        });

        test('For any invalid JWT token, verification should fail securely', async () => {
            await fc.assert(fc.asyncProperty(
                fc.oneof(
                    fc.constant(''), // Empty string
                    fc.constant('invalid-token'), // Invalid format
                    fc.string({ minLength: 1, maxLength: 50 }), // Random string
                    fc.constant('header.payload'), // Missing signature
                    fc.constant('header.payload.signature.extra'), // Too many parts
                    fc.constant(null),
                    fc.constant(undefined)
                ),
                async (invalidToken) => {
                    // Property: Invalid tokens should throw errors when verified
                    if (invalidToken === null || invalidToken === undefined) {
                        expect(() => jwt.verify(invalidToken, TEST_JWT_SECRET)).toThrow();
                    } else {
                        expect(() => jwt.verify(invalidToken, TEST_JWT_SECRET)).toThrow();
                    }
                }
            ), { numRuns: 5 });
        });

        test('For any expired JWT token, verification should fail', async () => {
            await fc.assert(fc.asyncProperty(
                fc.record({
                    userId: fc.hexaString({ minLength: 24, maxLength: 24 }), // MongoDB ObjectId format
                    pastTime: fc.integer({ min: 1, max: 86400 }) // 1 second to 1 day ago
                }),
                async ({ userId, pastTime }) => {
                    // Create an expired token
                    const expiredToken = jwt.sign(
                        { id: userId },
                        TEST_JWT_SECRET,
                        { expiresIn: -pastTime } // Negative expiration = expired
                    );
                    
                    // Property: Expired tokens should be rejected
                    expect(() => jwt.verify(expiredToken, TEST_JWT_SECRET)).toThrow('jwt expired');
                }
            ), { numRuns: 5 });
        });

        test('For any JWT token signed with wrong secret, verification should fail', async () => {
            await fc.assert(fc.asyncProperty(
                fc.record({
                    userId: fc.hexaString({ minLength: 24, maxLength: 24 }),
                    wrongSecret: fc.string({ minLength: 10, maxLength: 100 }).filter(s => s !== TEST_JWT_SECRET)
                }),
                async ({ userId, wrongSecret }) => {
                    // Create token with wrong secret
                    const tokenWithWrongSecret = jwt.sign(
                        { id: userId },
                        wrongSecret,
                        { expiresIn: '1h' }
                    );
                    
                    // Property: Tokens signed with wrong secret should be rejected
                    expect(() => jwt.verify(tokenWithWrongSecret, TEST_JWT_SECRET)).toThrow('invalid signature');
                }
            ), { numRuns: 5 });
        });

        test('For any valid JWT token, it should contain only expected claims', async () => {
            await fc.assert(fc.asyncProperty(
                fc.hexaString({ minLength: 24, maxLength: 24 }), // MongoDB ObjectId format
                async (userId) => {
                    const token = generateToken(userId);
                    const decoded = jwt.verify(token, TEST_JWT_SECRET);
                    
                    // Property: Token should contain only expected claims
                    const expectedClaims = ['id', 'iat', 'exp'];
                    const actualClaims = Object.keys(decoded);
                    
                    expect(actualClaims.sort()).toEqual(expectedClaims.sort());
                    
                    // Property: User ID should be preserved correctly
                    expect(decoded.id).toBe(userId);
                    
                    // Property: Claims should have correct types
                    expect(typeof decoded.id).toBe('string');
                    expect(typeof decoded.iat).toBe('number');
                    expect(typeof decoded.exp).toBe('number');
                }
            ), { numRuns: 7 });
        });

        test('For any token generation, multiple calls should produce different tokens but same payload', async () => {
            await fc.assert(fc.asyncProperty(
                fc.hexaString({ minLength: 24, maxLength: 24 }),
                async (userId) => {
                    // Generate two tokens for the same user at different times
                    const token1 = generateToken(userId);
                    
                    // Small delay to ensure different iat
                    await new Promise(resolve => setTimeout(resolve, 1));
                    
                    const token2 = generateToken(userId);
                    
                    // Property: Tokens should be different (due to different iat)
                    expect(token1).not.toBe(token2);
                    
                    // Property: Both tokens should be valid
                    const decoded1 = jwt.verify(token1, TEST_JWT_SECRET);
                    const decoded2 = jwt.verify(token2, TEST_JWT_SECRET);
                    
                    // Property: User ID should be the same
                    expect(decoded1.id).toBe(decoded2.id);
                    expect(decoded1.id).toBe(userId);
                    
                    // Property: Expiration duration should be the same
                    const duration1 = decoded1.exp - decoded1.iat;
                    const duration2 = decoded2.exp - decoded2.iat;
                    expect(duration1).toBe(duration2);
                    expect(duration1).toBe(30 * 24 * 60 * 60); // 30 days
                }
            ), { numRuns: 5 });
        });
    });
});