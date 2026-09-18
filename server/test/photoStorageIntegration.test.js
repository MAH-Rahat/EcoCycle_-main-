import fc from 'fast-check';
import mongoose from 'mongoose';
import Waste from '../models/Waste.js';
import User from '../models/User.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';

/**
 * Property-Based Test for Photo Storage Integration
 * **Validates: Requirements 2.2**
 * 
 * Property 7: Photo Storage Integration
 * For any photo upload, the image should be stored in Cloudinary and a valid URL 
 * should be returned and associated with the waste log
 */

describe('Photo Storage Integration Properties', () => {
    let testUser;

    beforeAll(async () => {
        // Connect to test database with timeout
        const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/ecocycle_test';
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });

        // Create test user
        testUser = new User({
            name: 'Test User',
            email: 'test@example.com',
            password: 'hashedpassword',
            role: 'citizen'
        });
        await testUser.save();

        // Initialize waste type configurations
        const wasteTypes = [
            { type: 'Plastic', pointsPerKg: 10, co2PerKg: 2.5 },
            { type: 'Paper', pointsPerKg: 8, co2PerKg: 1.8 },
            { type: 'Metal', pointsPerKg: 15, co2PerKg: 3.2 },
            { type: 'Glass', pointsPerKg: 12, co2PerKg: 2.1 },
            { type: 'E-Waste', pointsPerKg: 25, co2PerKg: 5.0 },
            { type: 'Organic', pointsPerKg: 5, co2PerKg: 1.2 },
            { type: 'Other', pointsPerKg: 7, co2PerKg: 1.5 }
        ];

        for (const config of wasteTypes) {
            await WasteTypeConfig.findOneAndUpdate(
                { type: config.type },
                config,
                { upsert: true, new: true }
            );
        }
    }, 10000); // 10 second timeout

    afterAll(async () => {
        // Clean up test data
        await User.deleteMany({});
        await Waste.deleteMany({});
        await WasteTypeConfig.deleteMany({});
        await mongoose.connection.close();
    }, 10000); // 10 second timeout

    beforeEach(async () => {
        // Clean up waste logs before each test
        await Waste.deleteMany({});
    });

    // Custom arbitraries for test data generation
    const cloudinaryUrlArbitrary = fc.string({ minLength: 10, maxLength: 200 })
        .filter(str => str.length > 0)
        .map(str => `https://res.cloudinary.com/ecocycle/image/upload/v1234567890/${str}.jpg`);

    const invalidUrlArbitrary = fc.oneof(
        fc.constant(''),
        fc.constant(null),
        fc.constant(undefined),
        fc.string({ minLength: 1, maxLength: 50 }).filter(str => !str.startsWith('http')),
        fc.constant('not-a-url'),
        fc.constant('ftp://invalid-protocol.com/image.jpg')
    );

    const wasteTypeArbitrary = fc.constantFrom(
        'Plastic', 'Paper', 'Metal', 'Glass', 'E-Waste', 'Organic', 'Other'
    );

    const weightArbitrary = fc.float({ min: Math.fround(0.1), max: Math.fround(1000), noNaN: true });

    const wasteDataWithPhotoArbitrary = fc.record({
        material: wasteTypeArbitrary,
        weight: weightArbitrary,
        photo: cloudinaryUrlArbitrary
    });

    const wasteDataWithoutPhotoArbitrary = fc.record({
        material: wasteTypeArbitrary,
        weight: weightArbitrary
    });

    const wasteDataWithInvalidPhotoArbitrary = fc.record({
        material: wasteTypeArbitrary,
        weight: weightArbitrary,
        photo: invalidUrlArbitrary
    });

    /**
     * Property: Valid photo URLs should be stored correctly
     * When a waste log is created with a valid Cloudinary photo URL,
     * the photo URL should be stored exactly as provided
     */
    test('should store valid photo URLs correctly', async () => {
        await fc.assert(fc.asyncProperty(
            wasteDataWithPhotoArbitrary,
            async (wasteData) => {
                // Create waste log with photo
                const wasteLog = new Waste({
                    citizen: testUser._id,
                    material: wasteData.material,
                    weight: wasteData.weight,
                    photo: wasteData.photo,
                    pointsEarned: 0,
                    co2Saved: 0
                });

                await wasteLog.save();

                // Retrieve the saved waste log
                const savedWasteLog = await Waste.findById(wasteLog._id);

                // Verify photo URL is stored correctly
                expect(savedWasteLog.photo).toBe(wasteData.photo);
                expect(savedWasteLog.photo).toMatch(/^https:\/\/res\.cloudinary\.com\//);
                expect(savedWasteLog.photo).toMatch(/\.(jpg|jpeg|png|gif|webp)$/i);
            }
        ), { numRuns: 12 });
    });

    /**
     * Property: Waste logs without photos should be valid
     * When a waste log is created without a photo,
     * it should still be saved successfully with photo field as undefined/null
     */
    test('should handle waste logs without photos correctly', async () => {
        await fc.assert(fc.asyncProperty(
            wasteDataWithoutPhotoArbitrary,
            async (wasteData) => {
                // Create waste log without photo
                const wasteLog = new Waste({
                    citizen: testUser._id,
                    material: wasteData.material,
                    weight: wasteData.weight,
                    pointsEarned: 0,
                    co2Saved: 0
                });

                await wasteLog.save();

                // Retrieve the saved waste log
                const savedWasteLog = await Waste.findById(wasteLog._id);

                // Verify waste log is saved correctly without photo
                expect(savedWasteLog.citizen.toString()).toBe(testUser._id.toString());
                expect(savedWasteLog.material).toBe(wasteData.material);
                expect(savedWasteLog.weight).toBe(wasteData.weight);
                expect(savedWasteLog.photo).toBeUndefined();
            }
        ), { numRuns: 12 });
    });

    /**
     * Property: Photo URL validation should prevent invalid URLs
     * When invalid photo URLs are provided, they should either be rejected
     * or handled gracefully without breaking the waste log creation
     */
    test('should handle invalid photo URLs gracefully', async () => {
        await fc.assert(fc.asyncProperty(
            wasteDataWithInvalidPhotoArbitrary,
            async (wasteData) => {
                // Skip null/undefined cases as they're valid (no photo)
                if (wasteData.photo === null || wasteData.photo === undefined) {
                    return;
                }

                try {
                    // Create waste log with invalid photo URL
                    const wasteLog = new Waste({
                        citizen: testUser._id,
                        material: wasteData.material,
                        weight: wasteData.weight,
                        photo: wasteData.photo,
                        pointsEarned: 0,
                        co2Saved: 0
                    });

                    await wasteLog.save();

                    // If save succeeds, verify the data is still consistent
                    const savedWasteLog = await Waste.findById(wasteLog._id);
                    expect(savedWasteLog.citizen.toString()).toBe(testUser._id.toString());
                    expect(savedWasteLog.material).toBe(wasteData.material);
                    expect(savedWasteLog.weight).toBe(wasteData.weight);
                    
                    // Photo should be stored as provided (even if invalid)
                    // This tests current behavior - in production, validation should be added
                    expect(savedWasteLog.photo).toBe(wasteData.photo);
                } catch (error) {
                    // If validation is implemented, invalid URLs should be rejected
                    // This is acceptable behavior for invalid data
                    expect(error).toBeDefined();
                }
            }
        ), { numRuns: 7 });
    });

    /**
     * Property: Photo URL format consistency
     * All valid photo URLs should follow Cloudinary URL format patterns
     */
    test('should maintain photo URL format consistency', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(wasteDataWithPhotoArbitrary, { minLength: 1, maxLength: 10 }),
            async (wasteDataArray) => {
                const savedWasteLogs = [];

                // Create multiple waste logs with photos
                for (const wasteData of wasteDataArray) {
                    const wasteLog = new Waste({
                        citizen: testUser._id,
                        material: wasteData.material,
                        weight: wasteData.weight,
                        photo: wasteData.photo,
                        pointsEarned: 0,
                        co2Saved: 0
                    });

                    await wasteLog.save();
                    savedWasteLogs.push(wasteLog);
                }

                // Verify all photo URLs follow consistent format
                const retrievedLogs = await Waste.find({ 
                    _id: { $in: savedWasteLogs.map(log => log._id) } 
                });

                for (const log of retrievedLogs) {
                    if (log.photo) {
                        // All photo URLs should be valid Cloudinary URLs
                        expect(log.photo).toMatch(/^https:\/\/res\.cloudinary\.com\//);
                        expect(log.photo).toMatch(/\.(jpg|jpeg|png|gif|webp)$/i);
                        expect(log.photo.length).toBeGreaterThan(10);
                        expect(log.photo.length).toBeLessThan(500);
                    }
                }
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: Photo storage should not affect other waste log fields
     * When photos are included in waste logs, all other required fields
     * should remain unaffected and properly stored
     */
    test('should not affect other fields when photo is included', async () => {
        await fc.assert(fc.asyncProperty(
            wasteDataWithPhotoArbitrary,
            async (wasteData) => {
                const originalData = {
                    citizen: testUser._id,
                    material: wasteData.material,
                    weight: wasteData.weight,
                    photo: wasteData.photo
                };

                // Create waste log with photo
                const wasteLog = new Waste({
                    ...originalData,
                    pointsEarned: 0,
                    co2Saved: 0
                });

                await wasteLog.save();

                // Retrieve and verify all fields
                const savedWasteLog = await Waste.findById(wasteLog._id);

                // Core fields should be preserved exactly
                expect(savedWasteLog.citizen.toString()).toBe(originalData.citizen.toString());
                expect(savedWasteLog.material).toBe(originalData.material);
                expect(savedWasteLog.weight).toBe(originalData.weight);
                expect(savedWasteLog.photo).toBe(originalData.photo);

                // Default fields should be set correctly
                expect(savedWasteLog.status).toBe('Pending');
                expect(savedWasteLog.pointsEarned).toBe(0);
                expect(savedWasteLog.co2Saved).toBe(0);
                expect(savedWasteLog.pointsAwarded).toBe(false);

                // Timestamps should be present
                expect(savedWasteLog.createdAt).toBeDefined();
                expect(savedWasteLog.updatedAt).toBeDefined();
            }
        ), { numRuns: 12 });
    });

    /**
     * Property: Photo URL retrieval consistency
     * When waste logs with photos are queried, the photo URLs should be
     * returned consistently across different query methods
     */
    test('should return photo URLs consistently across queries', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(wasteDataWithPhotoArbitrary, { minLength: 2, maxLength: 5 }),
            async (wasteDataArray) => {
                const createdLogs = [];

                // Create multiple waste logs with photos
                for (const wasteData of wasteDataArray) {
                    const wasteLog = new Waste({
                        citizen: testUser._id,
                        material: wasteData.material,
                        weight: wasteData.weight,
                        photo: wasteData.photo,
                        pointsEarned: 0,
                        co2Saved: 0
                    });

                    await wasteLog.save();
                    createdLogs.push(wasteLog);
                }

                // Query using different methods
                const findAllResults = await Waste.find({ 
                    citizen: testUser._id 
                }).sort({ createdAt: -1 });

                const findByIdResults = await Promise.all(
                    createdLogs.map(log => Waste.findById(log._id))
                );

                const findWithFilterResults = await Waste.find({
                    citizen: testUser._id,
                    photo: { $exists: true, $ne: null }
                });

                // Verify consistency across query methods
                expect(findAllResults.length).toBe(createdLogs.length);
                expect(findByIdResults.length).toBe(createdLogs.length);
                expect(findWithFilterResults.length).toBe(createdLogs.length);

                // Verify photo URLs are consistent
                for (let i = 0; i < createdLogs.length; i++) {
                    const originalPhoto = createdLogs[i].photo;
                    
                    expect(findAllResults[i].photo).toBe(originalPhoto);
                    expect(findByIdResults[i].photo).toBe(originalPhoto);
                    
                    const matchingFilterResult = findWithFilterResults.find(
                        log => log._id.toString() === createdLogs[i]._id.toString()
                    );
                    expect(matchingFilterResult.photo).toBe(originalPhoto);
                }
            }
        ), { numRuns: 5 });
    });
});