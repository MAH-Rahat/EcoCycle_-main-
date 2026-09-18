import fc from 'fast-check';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Pickup from '../models/Pickup.js';
import { Waste } from '../models/Waste.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Property-Based Test for QR Code Uniqueness
 * **Validates: Requirements 6.1**
 * 
 * Property 21: QR Code Uniqueness
 * For any pickup initiation, a unique QR code should be generated that 
 * doesn't conflict with existing codes
 */

describe('QR Code Uniqueness Properties', () => {
    let testCollector, testCitizen;

    beforeAll(async () => {
        // Create test users
        testCollector = new User({
            name: 'Test Collector',
            username: 'testcollector',
            email: 'collector@example.com',
            password: 'hashedpassword',
            role: 'collector',
            profile: {
                firstName: 'Test',
                lastName: 'Collector',
                addresses: [{
                    street: '456 Collector Ave',
                    city: 'Test City',
                    zipCode: '12345',
                    coordinates: {
                        type: 'Point',
                        coordinates: [-122.4194, 37.7749]
                    },
                    isDefault: true
                }]
            }
        });
        await testCollector.save();

        testCitizen = new User({
            name: 'Test Citizen',
            username: 'testcitizen',
            email: 'citizen@example.com',
            password: 'hashedpassword',
            role: 'citizen',
            profile: {
                firstName: 'Test',
                lastName: 'Citizen',
                addresses: [{
                    street: '123 Test St',
                    city: 'Test City',
                    zipCode: '12345',
                    coordinates: {
                        type: 'Point',
                        coordinates: [-122.4194, 37.7749]
                    },
                    isDefault: true
                }]
            }
        });
        await testCitizen.save();
    }, 10000);

    afterAll(async () => {
        // Clean up test data
        await User.deleteMany({});
        await Pickup.deleteMany({});
        await Waste.deleteMany({});
    }, 10000);

    beforeEach(async () => {
        // Clean up pickups and waste before each test
        await Pickup.deleteMany({});
        await Waste.deleteMany({});
    });

    // Custom arbitraries for test data generation
    const addressArbitrary = fc.string({ minLength: 10, maxLength: 100 })
        .filter(str => str.trim().length > 0);

    const wasteTypeArbitrary = fc.constantFrom(
        'plastic', 'paper', 'metal', 'glass', 'electronic', 'organic', 'hazardous'
    );

    const pickupDataArbitrary = fc.record({
        address: addressArbitrary,
        scheduledDate: fc.date({ min: new Date(), max: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }),
        wasteType: wasteTypeArbitrary,
        weight: fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true })
    });

    /**
     * Property: Each pickup should generate a unique QR code
     * When multiple pickups are assigned, each should receive a unique QR code
     * that doesn't conflict with any existing QR codes
     */
    test('should generate unique QR codes for all pickups', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 1, maxLength: 10 }),
            async (pickupDataArray) => {
                // Create pickups and assign them to generate QR codes
                const createdPickups = [];
                const generatedQRCodes = new Set();
                
                for (const pickupData of pickupDataArray) {
                    // Create waste item
                    const wasteItem = new Waste({
                        citizenId: testCitizen._id,
                        wasteType: pickupData.wasteType,
                        weight: pickupData.weight,
                        ecoPointsEarned: Math.round(pickupData.weight * 10),
                        co2Saved: pickupData.weight * 0.5
                    });
                    await wasteItem.save();

                    // Create pickup
                    const pickup = new Pickup({
                        citizenId: testCitizen._id,
                        wasteLogIds: [wasteItem._id],
                        address: {
                            street: pickupData.address,
                            city: 'Test City',
                            zipCode: '12345',
                            coordinates: {
                                type: 'Point',
                                coordinates: [-122.4194, 37.7749]
                            }
                        },
                        scheduledTime: pickupData.scheduledDate,
                        estimatedWeight: pickupData.weight,
                        status: 'pending'
                    });
                    await pickup.save();

                    // Assign pickup to trigger QR code generation
                    pickup.status = 'assigned';
                    pickup.assignedCollectorId = testCollector._id;
                    pickup.assignedAt = new Date();
                    await pickup.save();

                    createdPickups.push(pickup);
                }

                // Retrieve all pickups with QR codes
                const pickupsWithQR = await Pickup.find({
                    _id: { $in: createdPickups.map(p => p._id) }
                });

                // Verify all pickups have QR codes
                expect(pickupsWithQR.length).toBe(createdPickups.length);

                // Verify QR code uniqueness
                for (const pickup of pickupsWithQR) {
                    expect(pickup.qrCode).toBeDefined();
                    expect(pickup.qrCode).toMatch(/^PICKUP-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
                    
                    // Verify QR code is unique
                    expect(generatedQRCodes.has(pickup.qrCode)).toBe(false);
                    generatedQRCodes.add(pickup.qrCode);

                    // Verify QR code image is generated
                    expect(pickup.qrCodeImage).toBeDefined();
                    expect(pickup.qrCodeImage).toMatch(/^data:image\/png;base64,/);
                }

                // Verify total unique QR codes equals number of pickups
                expect(generatedQRCodes.size).toBe(createdPickups.length);

                // Verify database uniqueness constraint
                const qrCodeCounts = await Pickup.aggregate([
                    { $match: { qrCode: { $exists: true, $ne: null } } },
                    { $group: { _id: '$qrCode', count: { $sum: 1 } } },
                    { $match: { count: { $gt: 1 } } }
                ]);

                // Should have no duplicate QR codes
                expect(qrCodeCounts.length).toBe(0);
            }
        ), { numRuns: 5 });
    }, 15000);

    /**
     * Property: QR codes should remain unique across multiple assignment sessions
     * When pickups are assigned in different batches over time, QR codes should
     * remain unique across all sessions
     */
    test('should maintain QR code uniqueness across multiple assignment sessions', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.array(pickupDataArbitrary, { minLength: 1, maxLength: 10 }), { minLength: 2, maxLength: 5 }),
            async (pickupBatches) => {
                const allGeneratedQRCodes = new Set();
                let totalPickupsCreated = 0;

                // Process each batch of pickups separately
                for (let batchIndex = 0; batchIndex < pickupBatches.length; batchIndex++) {
                    const pickupBatch = pickupBatches[batchIndex];
                    const batchPickups = [];

                    // Create pickups in this batch
                    for (const pickupData of pickupBatch) {
                        const wasteItem = new Waste({
                            citizenId: testCitizen._id,
                            wasteType: pickupData.wasteType,
                            weight: pickupData.weight,
                            ecoPointsEarned: Math.round(pickupData.weight * 10),
                            co2Saved: pickupData.weight * 0.5
                        });
                        await wasteItem.save();

                        const pickup = new Pickup({
                            citizenId: testCitizen._id,
                            wasteLogIds: [wasteItem._id],
                            address: {
                                street: pickupData.address,
                                city: 'Test City',
                                zipCode: '12345',
                                coordinates: {
                                    type: 'Point',
                                    coordinates: [-122.4194, 37.7749]
                                }
                            },
                            scheduledTime: pickupData.scheduledDate,
                            estimatedWeight: pickupData.weight,
                            status: 'pending'
                        });
                        await pickup.save();
                        batchPickups.push(pickup);
                    }

                    // Assign all pickups in this batch simultaneously
                    const assignmentPromises = batchPickups.map(async (pickup) => {
                        pickup.status = 'assigned';
                        pickup.assignedCollectorId = testCollector._id;
                        pickup.assignedAt = new Date();
                        return await pickup.save();
                    });

                    await Promise.all(assignmentPromises);
                    totalPickupsCreated += batchPickups.length;

                    // Verify QR codes for this batch
                    const assignedPickups = await Pickup.find({
                        _id: { $in: batchPickups.map(p => p._id) }
                    });

                    for (const pickup of assignedPickups) {
                        expect(pickup.qrCode).toBeDefined();
                        expect(pickup.qrCode).toMatch(/^PICKUP-/);
                        
                        // Verify uniqueness across all batches
                        expect(allGeneratedQRCodes.has(pickup.qrCode)).toBe(false);
                        allGeneratedQRCodes.add(pickup.qrCode);
                    }

                    // Small delay between batches to simulate real-world timing
                    await new Promise(resolve => setTimeout(resolve, 10));
                }

                // Final verification of global uniqueness
                expect(allGeneratedQRCodes.size).toBe(totalPickupsCreated);

                // Verify database consistency
                const allPickupsWithQR = await Pickup.find({
                    qrCode: { $exists: true, $ne: null }
                });

                expect(allPickupsWithQR.length).toBe(totalPickupsCreated);

                // Verify no duplicates in database
                const dbQRCodes = new Set();
                for (const pickup of allPickupsWithQR) {
                    expect(dbQRCodes.has(pickup.qrCode)).toBe(false);
                    dbQRCodes.add(pickup.qrCode);
                }
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: QR code generation should handle concurrent assignments correctly
     * When multiple pickups are assigned concurrently, each should receive
     * a unique QR code without race conditions
     */
    test('should handle concurrent QR code generation without conflicts', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 5, maxLength: 20 }),
            async (pickupDataArray) => {
                // Create all pickups first
                const createdPickups = [];
                
                for (const pickupData of pickupDataArray) {
                    const wasteItem = new Waste({
                        citizenId: testCitizen._id,
                        wasteType: pickupData.wasteType,
                        weight: pickupData.weight,
                        ecoPointsEarned: Math.round(pickupData.weight * 10),
                        co2Saved: pickupData.weight * 0.5
                    });
                    await wasteItem.save();

                    const pickup = new Pickup({
                        citizenId: testCitizen._id,
                        wasteLogIds: [wasteItem._id],
                        address: {
                            street: pickupData.address,
                            city: 'Test City',
                            zipCode: '12345',
                            coordinates: {
                                type: 'Point',
                                coordinates: [-122.4194, 37.7749]
                            }
                        },
                        scheduledTime: pickupData.scheduledDate,
                        estimatedWeight: pickupData.weight,
                        status: 'pending'
                    });
                    await pickup.save();
                    createdPickups.push(pickup);
                }

                // Assign all pickups concurrently to test race conditions
                const concurrentAssignments = createdPickups.map(async (pickup) => {
                    pickup.status = 'assigned';
                    pickup.assignedCollectorId = testCollector._id;
                    pickup.assignedAt = new Date();
                    return await pickup.save();
                });

                // Wait for all concurrent assignments to complete
                const assignedPickups = await Promise.all(concurrentAssignments);

                // Verify all assignments succeeded
                expect(assignedPickups.length).toBe(createdPickups.length);

                // Verify QR code uniqueness after concurrent generation
                const qrCodes = new Set();
                
                for (const pickup of assignedPickups) {
                    expect(pickup.qrCode).toBeDefined();
                    expect(pickup.qrCode).toMatch(/^PICKUP-/);
                    expect(pickup.qrCodeImage).toBeDefined();
                    
                    // Verify no duplicates
                    expect(qrCodes.has(pickup.qrCode)).toBe(false);
                    qrCodes.add(pickup.qrCode);
                }

                // Verify total unique QR codes
                expect(qrCodes.size).toBe(createdPickups.length);

                // Verify database integrity after concurrent operations
                const dbPickups = await Pickup.find({
                    _id: { $in: createdPickups.map(p => p._id) }
                });

                expect(dbPickups.length).toBe(createdPickups.length);

                // Verify all have unique QR codes in database
                const dbQRCodes = new Set();
                for (const pickup of dbPickups) {
                    expect(pickup.qrCode).toBeDefined();
                    expect(dbQRCodes.has(pickup.qrCode)).toBe(false);
                    dbQRCodes.add(pickup.qrCode);
                }
            }
        ), { numRuns: 6 });
    });

    /**
     * Property: QR codes should follow consistent format and structure
     * When QR codes are generated, they should follow a consistent format
     * that includes necessary information for verification
     */
    test('should generate QR codes with consistent format and structure', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 1, maxLength: 15 }),
            async (pickupDataArray) => {
                const createdPickups = [];
                
                for (const pickupData of pickupDataArray) {
                    const wasteItem = new Waste({
                        citizenId: testCitizen._id,
                        wasteType: pickupData.wasteType,
                        weight: pickupData.weight,
                        ecoPointsEarned: Math.round(pickupData.weight * 10),
                        co2Saved: pickupData.weight * 0.5
                    });
                    await wasteItem.save();

                    const pickup = new Pickup({
                        citizenId: testCitizen._id,
                        wasteLogIds: [wasteItem._id],
                        address: {
                            street: pickupData.address,
                            city: 'Test City',
                            zipCode: '12345',
                            coordinates: {
                                type: 'Point',
                                coordinates: [-122.4194, 37.7749]
                            }
                        },
                        scheduledTime: pickupData.scheduledDate,
                        estimatedWeight: pickupData.weight,
                        status: 'assigned',
                        assignedCollectorId: testCollector._id,
                        assignedAt: new Date()
                    });
                    await pickup.save();
                    createdPickups.push(pickup);
                }

                // Retrieve pickups with QR codes
                const pickupsWithQR = await Pickup.find({
                    _id: { $in: createdPickups.map(p => p._id) }
                });

                for (const pickup of pickupsWithQR) {
                    // Verify QR code format
                    expect(pickup.qrCode).toBeDefined();
                    expect(pickup.qrCode).toMatch(/^PICKUP-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
                    
                    // Verify QR code length is consistent
                    expect(pickup.qrCode.length).toBe(43); // "PICKUP-" + UUID length
                    
                    // Verify QR code starts with expected prefix
                    expect(pickup.qrCode.startsWith('PICKUP-')).toBe(true);
                    
                    // Verify UUID part is valid
                    const uuidPart = pickup.qrCode.substring(7);
                    expect(uuidPart).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
                    
                    // Verify QR code image format
                    expect(pickup.qrCodeImage).toBeDefined();
                    expect(pickup.qrCodeImage).toMatch(/^data:image\/png;base64,/);
                    
                    // Verify QR code image contains valid base64 data
                    const base64Data = pickup.qrCodeImage.split(',')[1];
                    expect(base64Data).toBeDefined();
                    expect(base64Data.length).toBeGreaterThan(0);
                    
                    // Verify base64 is valid (should not throw)
                    expect(() => Buffer.from(base64Data, 'base64')).not.toThrow();
                }
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: QR codes should be retrievable and verifiable
     * When QR codes are generated, they should be retrievable by the QR code
     * string and should contain correct pickup information
     */
    test('should generate retrievable and verifiable QR codes', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 1, maxLength: 10 }),
            async (pickupDataArray) => {
                const createdPickups = [];
                
                for (const pickupData of pickupDataArray) {
                    const wasteItem = new Waste({
                        citizenId: testCitizen._id,
                        wasteType: pickupData.wasteType,
                        weight: pickupData.weight,
                        ecoPointsEarned: Math.round(pickupData.weight * 10),
                        co2Saved: pickupData.weight * 0.5
                    });
                    await wasteItem.save();

                    const pickup = new Pickup({
                        citizenId: testCitizen._id,
                        wasteLogIds: [wasteItem._id],
                        address: {
                            street: pickupData.address,
                            city: 'Test City',
                            zipCode: '12345',
                            coordinates: {
                                type: 'Point',
                                coordinates: [-122.4194, 37.7749]
                            }
                        },
                        scheduledTime: pickupData.scheduledDate,
                        estimatedWeight: pickupData.weight,
                        status: 'assigned',
                        assignedCollectorId: testCollector._id,
                        assignedAt: new Date()
                    });
                    await pickup.save();
                    createdPickups.push(pickup);
                }

                // Test QR code retrieval for each pickup
                for (const originalPickup of createdPickups) {
                    const retrievedPickup = await Pickup.findById(originalPickup._id);
                    
                    expect(retrievedPickup.qrCode).toBeDefined();
                    
                    // Test findByQRCode static method
                    const pickupByQR = await Pickup.findByQRCode(retrievedPickup.qrCode);
                    
                    expect(pickupByQR).toBeDefined();
                    expect(pickupByQR._id.toString()).toBe(originalPickup._id.toString());
                    expect(pickupByQR.qrCode).toBe(retrievedPickup.qrCode);
                    
                    // Verify pickup data integrity
                    expect(pickupByQR.citizenId.toString()).toBe(testCitizen._id.toString());
                    expect(pickupByQR.assignedCollectorId.toString()).toBe(testCollector._id.toString());
                    expect(pickupByQR.address.street).toBe(originalPickup.address.street);
                    expect(pickupByQR.status).toBe('assigned');
                }

                // Test that invalid QR codes return null
                const invalidQRCode = 'PICKUP-invalid-qr-code';
                const invalidPickup = await Pickup.findByQRCode(invalidQRCode);
                expect(invalidPickup).toBeNull();

                // Test that empty/null QR codes return null
                const nullPickup = await Pickup.findByQRCode(null);
                expect(nullPickup).toBeNull();

                const emptyPickup = await Pickup.findByQRCode('');
                expect(emptyPickup).toBeNull();
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: QR code uniqueness should be maintained during pickup lifecycle
     * When pickups go through various status changes, QR codes should remain
     * unique and unchanged throughout the pickup lifecycle
     */
    test('should maintain QR code uniqueness throughout pickup lifecycle', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 2, maxLength: 8 }),
            async (pickupDataArray) => {
                const createdPickups = [];
                
                // Create and assign pickups
                for (const pickupData of pickupDataArray) {
                    const wasteItem = new Waste({
                        citizenId: testCitizen._id,
                        wasteType: pickupData.wasteType,
                        weight: pickupData.weight,
                        ecoPointsEarned: Math.round(pickupData.weight * 10),
                        co2Saved: pickupData.weight * 0.5
                    });
                    await wasteItem.save();

                    const pickup = new Pickup({
                        citizenId: testCitizen._id,
                        wasteLogIds: [wasteItem._id],
                        address: {
                            street: pickupData.address,
                            city: 'Test City',
                            zipCode: '12345',
                            coordinates: {
                                type: 'Point',
                                coordinates: [-122.4194, 37.7749]
                            }
                        },
                        scheduledTime: pickupData.scheduledDate,
                        estimatedWeight: pickupData.weight,
                        status: 'assigned',
                        assignedCollectorId: testCollector._id,
                        assignedAt: new Date()
                    });
                    await pickup.save();
                    createdPickups.push(pickup);
                }

                // Store original QR codes
                const originalQRCodes = new Map();
                for (const pickup of createdPickups) {
                    const retrievedPickup = await Pickup.findById(pickup._id);
                    originalQRCodes.set(pickup._id.toString(), retrievedPickup.qrCode);
                }

                // Simulate pickup lifecycle status changes
                const statusProgression = ['en_route', 'arrived', 'in_progress', 'completed'];
                
                for (const status of statusProgression) {
                    // Update all pickups to new status
                    for (const pickup of createdPickups) {
                        if (status === 'in_progress') {
                            // Simulate QR verification
                            pickup.qrVerified = true;
                            pickup.qrVerifiedAt = new Date();
                            pickup.qrVerifiedBy = testCollector._id;
                        }
                        
                        if (status === 'completed') {
                            pickup.actualWeight = pickup.estimatedWeight || 5.0;
                            pickup.completedAt = new Date();
                        }
                        
                        pickup.status = status;
                        await pickup.save();
                    }

                    // Verify QR codes remain unchanged and unique
                    const updatedPickups = await Pickup.find({
                        _id: { $in: createdPickups.map(p => p._id) }
                    });

                    const currentQRCodes = new Set();
                    
                    for (const pickup of updatedPickups) {
                        const originalQRCode = originalQRCodes.get(pickup._id.toString());
                        
                        // Verify QR code hasn't changed
                        expect(pickup.qrCode).toBe(originalQRCode);
                        
                        // Verify QR code is still unique
                        expect(currentQRCodes.has(pickup.qrCode)).toBe(false);
                        currentQRCodes.add(pickup.qrCode);
                        
                        // Verify status updated correctly
                        expect(pickup.status).toBe(status);
                    }

                    // Verify total unique QR codes
                    expect(currentQRCodes.size).toBe(createdPickups.length);
                }

                // Final verification that all QR codes are still unique and unchanged
                const finalPickups = await Pickup.find({
                    _id: { $in: createdPickups.map(p => p._id) }
                });

                const finalQRCodes = new Set();
                for (const pickup of finalPickups) {
                    const originalQRCode = originalQRCodes.get(pickup._id.toString());
                    expect(pickup.qrCode).toBe(originalQRCode);
                    expect(finalQRCodes.has(pickup.qrCode)).toBe(false);
                    finalQRCodes.add(pickup.qrCode);
                }

                expect(finalQRCodes.size).toBe(createdPickups.length);
            }
        ), { numRuns: 5 });
    });
});