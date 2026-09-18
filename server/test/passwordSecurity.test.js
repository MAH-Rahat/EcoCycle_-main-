import fc from 'fast-check';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import mongoose from 'mongoose';

// Feature: ecocycle-platform, Property 1: Password Security
describe('Password Security Property-Based Tests', () => {
    beforeAll(async () => {
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

    describe('Property 1: Password Security', () => {
        test('For any user registration, the stored password should be bcrypt hashed and never stored in plain text', async () => {
            await fc.assert(fc.asyncProperty(
                fc.record({
                    name: fc.string({ minLength: 1, maxLength: 50 }),
                    email: fc.emailAddress(),
                    username: fc.string({ minLength: 3, maxLength: 30 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
                    password: fc.string({ minLength: 6, maxLength: 100 }),
                    role: fc.constantFrom('citizen', 'collector')
                }),
                async (userData) => {
                    // Hash password manually as done in authRoutes.js
                    const salt = await bcrypt.genSalt(10);
                    const hashedPassword = await bcrypt.hash(userData.password, salt);

                    const user = await User.create({
                        ...userData,
                        password: hashedPassword,
                        points: 100
                    });

                    // Property: Password should never be stored in plain text
                    expect(user.password).not.toBe(userData.password);
                    
                    // Property: Stored password should be a valid bcrypt hash
                    expect(user.password).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
                    
                    // Property: bcrypt.compare should work with original password
                    const isMatch = await bcrypt.compare(userData.password, user.password);
                    expect(isMatch).toBe(true);
                    
                    // Property: bcrypt.compare should fail with wrong password
                    const wrongPassword = userData.password + 'wrong';
                    const isWrongMatch = await bcrypt.compare(wrongPassword, user.password);
                    expect(isWrongMatch).toBe(false);
                    
                    // Property: User.matchPassword method should work correctly
                    const methodMatch = await user.matchPassword(userData.password);
                    expect(methodMatch).toBe(true);
                    
                    const methodWrongMatch = await user.matchPassword(wrongPassword);
                    expect(methodWrongMatch).toBe(false);
                }
            ), { numRuns: 12 });
        });

        test('For any password, bcrypt hashing should be deterministic for verification but unique for each hash', async () => {
            await fc.assert(fc.asyncProperty(
                fc.string({ minLength: 6, maxLength: 100 }),
                async (password) => {
                    // Generate two separate hashes of the same password
                    const salt1 = await bcrypt.genSalt(10);
                    const hash1 = await bcrypt.hash(password, salt1);
                    
                    const salt2 = await bcrypt.genSalt(10);
                    const hash2 = await bcrypt.hash(password, salt2);
                    
                    // Property: Different salts should produce different hashes
                    expect(hash1).not.toBe(hash2);
                    
                    // Property: Both hashes should verify the same password
                    expect(await bcrypt.compare(password, hash1)).toBe(true);
                    expect(await bcrypt.compare(password, hash2)).toBe(true);
                    
                    // Property: Both hashes should be valid bcrypt format
                    expect(hash1).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
                    expect(hash2).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
                }
            ), { numRuns: 7 });
        });

        test('For any invalid password format, verification should fail securely', async () => {
            await fc.assert(fc.asyncProperty(
                fc.record({
                    validPassword: fc.string({ minLength: 6, maxLength: 100 }),
                    invalidInput: fc.oneof(
                        fc.constant(''),
                        fc.constant(null),
                        fc.constant(undefined),
                        fc.string({ maxLength: 5 }), // Too short
                        fc.string({ minLength: 101 }) // Too long
                    )
                }),
                async ({ validPassword, invalidInput }) => {
                    const salt = await bcrypt.genSalt(10);
                    const validHash = await bcrypt.hash(validPassword, salt);
                    
                    // Property: Invalid inputs should not match valid hash
                    if (invalidInput !== null && invalidInput !== undefined) {
                        const result = await bcrypt.compare(String(invalidInput), validHash);
                        expect(result).toBe(false);
                    }
                    
                    // Property: Valid password should still work
                    const validResult = await bcrypt.compare(validPassword, validHash);
                    expect(validResult).toBe(true);
                }
            ), { numRuns: 7 });
        });
    });
});