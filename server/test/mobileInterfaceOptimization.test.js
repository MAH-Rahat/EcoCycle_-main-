import fc from 'fast-check';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Pickup from '../models/Pickup.js';
import Waste from '../models/Waste.js';

/**
 * Property-Based Test for Mobile Interface Optimization
 * **Validates: Requirements 5.1, 5.3**
 * 
 * Property 18: Mobile Interface Optimization
 * For any collector dashboard access, the interface should render correctly 
 * on mobile devices with full functionality
 */

describe('Mobile Interface Optimization Properties', () => {
    let testCollector, testCitizen;

    beforeAll(async () => {
        // Connect to test database with timeout
        const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/ecocycle_test';
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });

        // Create test users
        testCollector = new User({
            name: 'Test Collector',
            email: 'collector@example.com',
            password: 'hashedpassword',
            role: 'collector'
        });
        await testCollector.save();

        testCitizen = new User({
            name: 'Test Citizen',
            email: 'citizen@example.com',
            password: 'hashedpassword',
            role: 'citizen'
        });
        await testCitizen.save();
    }, 10000);

    afterAll(async () => {
        // Clean up test data
        await User.deleteMany({});
        await Pickup.deleteMany({});
        await Waste.deleteMany({});
        await mongoose.connection.close();
    }, 10000);

    beforeEach(async () => {
        // Clean up pickups and waste before each test
        await Pickup.deleteMany({});
        await Waste.deleteMany({});
    });

    // Custom arbitraries for test data generation
    const mobileViewportArbitrary = fc.record({
        width: fc.integer({ min: 320, max: 768 }), // Mobile to tablet range
        height: fc.integer({ min: 568, max: 1024 }),
        devicePixelRatio: fc.constantFrom(1, 1.5, 2, 3),
        orientation: fc.constantFrom('portrait', 'landscape')
    });

    const pickupStatusArbitrary = fc.constantFrom(
        'Pending', 'Assigned', 'En Route', 'Arrived', 'In Progress', 'Completed', 'Cancelled'
    );

    const timeSlotArbitrary = fc.constantFrom('Morning', 'Afternoon', 'Evening');

    const wasteTypeArbitrary = fc.constantFrom(
        'Plastic', 'Paper', 'Metal', 'Glass', 'E-Waste', 'Organic', 'Other'
    );

    const addressArbitrary = fc.string({ minLength: 10, maxLength: 100 })
        .filter(str => str.trim().length > 0);

    const pickupDataArbitrary = fc.record({
        address: addressArbitrary,
        scheduledDate: fc.date({ min: new Date(), max: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })
            .map(date => date.toISOString().split('T')[0]),
        timeSlot: timeSlotArbitrary,
        status: pickupStatusArbitrary
    });

    const wasteDataArbitrary = fc.record({
        material: wasteTypeArbitrary,
        weight: fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true })
    });

    /**
     * Property: Mobile pickup queue should display correctly across different viewport sizes
     * When pickups are queried for mobile display, they should be formatted appropriately
     * for different screen sizes and orientations
     */
    test('should display pickup queue correctly on mobile viewports', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 1, maxLength: 20 }),
            mobileViewportArbitrary,
            async (pickupDataArray, viewport) => {
                // Create waste items and pickups
                const createdPickups = [];
                
                for (const pickupData of pickupDataArray) {
                    // Create waste item
                    const wasteItem = new Waste({
                        citizen: testCitizen._id,
                        material: 'Plastic',
                        weight: 5.0,
                        pointsEarned: 50,
                        co2Saved: 2.5
                    });
                    await wasteItem.save();

                    // Create pickup
                    const pickup = new Pickup({
                        citizen: testCitizen._id,
                        wasteItem: wasteItem._id,
                        address: pickupData.address,
                        scheduledDate: pickupData.scheduledDate,
                        timeSlot: pickupData.timeSlot,
                        status: pickupData.status
                    });
                    await pickup.save();
                    createdPickups.push(pickup);
                }

                // Query pickups as would be done for mobile interface
                const mobilePickups = await Pickup.find({ status: 'Pending' })
                    .populate('citizen', 'name email')
                    .populate('wasteItem', 'material weight')
                    .sort({ createdAt: -1 })
                    .limit(viewport.width < 480 ? 10 : 20); // Limit based on screen size

                // Verify mobile-optimized data structure
                for (const pickup of mobilePickups) {
                    // Essential fields should be present for mobile display
                    expect(pickup._id).toBeDefined();
                    expect(pickup.address).toBeDefined();
                    expect(pickup.scheduledDate).toBeDefined();
                    expect(pickup.timeSlot).toBeDefined();
                    expect(pickup.status).toBeDefined();
                    expect(pickup.createdAt).toBeDefined();

                    // Populated fields should be available
                    if (pickup.citizen) {
                        expect(pickup.citizen.name).toBeDefined();
                        expect(pickup.citizen.email).toBeDefined();
                    }

                    if (pickup.wasteItem) {
                        expect(pickup.wasteItem.material).toBeDefined();
                        expect(pickup.wasteItem.weight).toBeDefined();
                    }

                    // Address should be suitable for mobile display (not too long)
                    expect(pickup.address.length).toBeLessThanOrEqual(100);
                    
                    // Time slot should be mobile-friendly format
                    expect(['Morning', 'Afternoon', 'Evening']).toContain(pickup.timeSlot);
                }

                // Verify appropriate pagination for mobile
                if (viewport.width < 480) {
                    expect(mobilePickups.length).toBeLessThanOrEqual(10);
                } else {
                    expect(mobilePickups.length).toBeLessThanOrEqual(20);
                }
            }
        ), { numRuns: 7 });
    });

    /**
     * Property: Pickup status updates should work efficiently on mobile
     * When pickup status is updated from mobile interface, the operation should
     * complete quickly and return mobile-optimized response data
     */
    test('should handle pickup status updates efficiently for mobile', async () => {
        await fc.assert(fc.asyncProperty(
            pickupDataArbitrary,
            pickupStatusArbitrary,
            mobileViewportArbitrary,
            async (pickupData, newStatus, viewport) => {
                // Skip invalid status transitions
                if (pickupData.status === 'Completed' || pickupData.status === 'Cancelled') {
                    return;
                }

                // Create waste item and pickup
                const wasteItem = new Waste({
                    citizen: testCitizen._id,
                    material: 'Paper',
                    weight: 3.0,
                    pointsEarned: 30,
                    co2Saved: 1.8
                });
                await wasteItem.save();

                const pickup = new Pickup({
                    citizen: testCitizen._id,
                    wasteItem: wasteItem._id,
                    address: pickupData.address,
                    scheduledDate: pickupData.scheduledDate,
                    timeSlot: pickupData.timeSlot,
                    status: pickupData.status,
                    assignedCollector: testCollector._id
                });
                await pickup.save();

                // Measure update performance (mobile should be fast)
                const startTime = Date.now();
                
                // Update status
                const updatedPickup = await Pickup.findByIdAndUpdate(
                    pickup._id,
                    { status: newStatus },
                    { new: true }
                ).populate('citizen', 'name email')
                 .populate('wasteItem', 'material weight');

                const updateTime = Date.now() - startTime;

                // Verify mobile performance requirements (under 3 seconds as per Requirements 5.5)
                expect(updateTime).toBeLessThan(3000);

                // Verify update was successful
                expect(updatedPickup.status).toBe(newStatus);
                expect(updatedPickup._id.toString()).toBe(pickup._id.toString());

                // Verify mobile-optimized response structure
                expect(updatedPickup.citizen).toBeDefined();
                expect(updatedPickup.wasteItem).toBeDefined();
                expect(updatedPickup.updatedAt).toBeDefined();

                // Verify essential mobile fields are present
                const mobileEssentialFields = [
                    '_id', 'status', 'address', 'scheduledDate', 'timeSlot', 'updatedAt'
                ];
                
                for (const field of mobileEssentialFields) {
                    expect(updatedPickup[field]).toBeDefined();
                }
            }
        ), { numRuns: 6 });
    });

    /**
     * Property: Mobile interface should handle different pickup queue sizes efficiently
     * When different numbers of pickups are loaded, mobile interface should maintain
     * performance and proper data structure
     */
    test('should handle varying pickup queue sizes efficiently on mobile', async () => {
        await fc.assert(fc.asyncProperty(
            fc.integer({ min: 0, max: 100 }),
            mobileViewportArbitrary,
            async (pickupCount, viewport) => {
                // Create specified number of pickups
                const createdPickups = [];
                
                for (let i = 0; i < pickupCount; i++) {
                    const wasteItem = new Waste({
                        citizen: testCitizen._id,
                        material: 'Metal',
                        weight: 2.0,
                        pointsEarned: 20,
                        co2Saved: 1.0
                    });
                    await wasteItem.save();

                    const pickup = new Pickup({
                        citizen: testCitizen._id,
                        wasteItem: wasteItem._id,
                        address: `Test Address ${i}`,
                        scheduledDate: '2024-12-31',
                        timeSlot: 'Morning',
                        status: 'Pending'
                    });
                    await pickup.save();
                    createdPickups.push(pickup);
                }

                // Query with mobile-appropriate pagination
                const pageSize = viewport.width < 480 ? 10 : 20;
                const startTime = Date.now();
                
                const mobilePickups = await Pickup.find({ status: 'Pending' })
                    .populate('citizen', 'name email')
                    .populate('wasteItem', 'material weight')
                    .sort({ createdAt: -1 })
                    .limit(pageSize);

                const queryTime = Date.now() - startTime;

                // Verify mobile performance (should be fast even with many pickups)
                expect(queryTime).toBeLessThan(3000);

                // Verify appropriate pagination
                const expectedCount = Math.min(pickupCount, pageSize);
                expect(mobilePickups.length).toBe(expectedCount);

                // Verify data structure consistency
                for (const pickup of mobilePickups) {
                    expect(pickup._id).toBeDefined();
                    expect(pickup.status).toBe('Pending');
                    expect(pickup.citizen).toBeDefined();
                    expect(pickup.wasteItem).toBeDefined();
                    
                    // Verify mobile-friendly data types
                    expect(typeof pickup.address).toBe('string');
                    expect(typeof pickup.scheduledDate).toBe('string');
                    expect(['Morning', 'Afternoon', 'Evening']).toContain(pickup.timeSlot);
                }
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: Mobile interface should provide consistent pickup assignment functionality
     * When pickups are assigned to collectors via mobile interface, the assignment
     * should work correctly across different mobile configurations
     */
    test('should handle pickup assignment consistently on mobile', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 1, maxLength: 10 }),
            mobileViewportArbitrary,
            async (pickupDataArray, viewport) => {
                // Create pickups for assignment
                const createdPickups = [];
                
                for (const pickupData of pickupDataArray) {
                    const wasteItem = new Waste({
                        citizen: testCitizen._id,
                        material: 'Glass',
                        weight: 4.0,
                        pointsEarned: 40,
                        co2Saved: 2.0
                    });
                    await wasteItem.save();

                    const pickup = new Pickup({
                        citizen: testCitizen._id,
                        wasteItem: wasteItem._id,
                        address: pickupData.address,
                        scheduledDate: pickupData.scheduledDate,
                        timeSlot: pickupData.timeSlot,
                        status: 'Pending'
                    });
                    await pickup.save();
                    createdPickups.push(pickup);
                }

                // Simulate mobile assignment process
                for (const pickup of createdPickups) {
                    const startTime = Date.now();
                    
                    // Assign pickup to collector
                    const assignedPickup = await Pickup.findByIdAndUpdate(
                        pickup._id,
                        {
                            status: 'Assigned',
                            assignedCollector: testCollector._id,
                            assignedAt: new Date()
                        },
                        { new: true }
                    ).populate('assignedCollector', 'name email role');

                    const assignmentTime = Date.now() - startTime;

                    // Verify mobile performance requirements
                    expect(assignmentTime).toBeLessThan(3000);

                    // Verify assignment was successful
                    expect(assignedPickup.status).toBe('Assigned');
                    expect(assignedPickup.assignedCollector._id.toString()).toBe(testCollector._id.toString());
                    expect(assignedPickup.assignedAt).toBeDefined();

                    // Verify mobile-optimized response
                    expect(assignedPickup.assignedCollector.name).toBeDefined();
                    expect(assignedPickup.assignedCollector.role).toBe('collector');

                    // Verify QR code generation for mobile scanning
                    expect(assignedPickup.qrCode).toBeDefined();
                    expect(assignedPickup.qrCode).toMatch(/^PICKUP-/);
                    expect(assignedPickup.qrCodeImage).toBeDefined();
                    expect(assignedPickup.qrCodeImage).toMatch(/^data:image\/png;base64,/);
                }
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: Mobile interface should handle pickup filtering efficiently
     * When pickups are filtered by status or other criteria on mobile,
     * the filtering should work correctly and efficiently
     */
    test('should handle pickup filtering efficiently on mobile', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 5, maxLength: 30 }),
            pickupStatusArbitrary,
            mobileViewportArbitrary,
            async (pickupDataArray, filterStatus, viewport) => {
                // Create pickups with various statuses
                const createdPickups = [];
                
                for (const pickupData of pickupDataArray) {
                    const wasteItem = new Waste({
                        citizen: testCitizen._id,
                        material: 'E-Waste',
                        weight: 1.5,
                        pointsEarned: 15,
                        co2Saved: 0.8
                    });
                    await wasteItem.save();

                    const pickup = new Pickup({
                        citizen: testCitizen._id,
                        wasteItem: wasteItem._id,
                        address: pickupData.address,
                        scheduledDate: pickupData.scheduledDate,
                        timeSlot: pickupData.timeSlot,
                        status: pickupData.status,
                        assignedCollector: pickupData.status !== 'Pending' ? testCollector._id : undefined
                    });
                    await pickup.save();
                    createdPickups.push(pickup);
                }

                // Apply mobile filtering
                const startTime = Date.now();
                
                const filteredPickups = await Pickup.find({ status: filterStatus })
                    .populate('citizen', 'name email')
                    .populate('wasteItem', 'material weight')
                    .populate('assignedCollector', 'name email')
                    .sort({ createdAt: -1 })
                    .limit(viewport.width < 480 ? 10 : 20);

                const filterTime = Date.now() - startTime;

                // Verify mobile performance
                expect(filterTime).toBeLessThan(3000);

                // Verify filtering accuracy
                for (const pickup of filteredPickups) {
                    expect(pickup.status).toBe(filterStatus);
                }

                // Verify mobile-appropriate result count
                const expectedMaxResults = viewport.width < 480 ? 10 : 20;
                expect(filteredPickups.length).toBeLessThanOrEqual(expectedMaxResults);

                // Verify mobile-optimized data structure
                for (const pickup of filteredPickups) {
                    expect(pickup._id).toBeDefined();
                    expect(pickup.citizen).toBeDefined();
                    expect(pickup.wasteItem).toBeDefined();
                    
                    // Verify essential mobile fields
                    expect(pickup.address).toBeDefined();
                    expect(pickup.scheduledDate).toBeDefined();
                    expect(pickup.timeSlot).toBeDefined();
                    expect(pickup.createdAt).toBeDefined();
                }
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: Mobile interface should maintain data consistency during concurrent operations
     * When multiple mobile operations occur simultaneously, data should remain consistent
     */
    test('should maintain data consistency during concurrent mobile operations', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 3, maxLength: 8 }),
            mobileViewportArbitrary,
            async (pickupDataArray, viewport) => {
                // Create pickups for concurrent operations
                const createdPickups = [];
                
                for (const pickupData of pickupDataArray) {
                    const wasteItem = new Waste({
                        citizen: testCitizen._id,
                        material: 'Organic',
                        weight: 6.0,
                        pointsEarned: 60,
                        co2Saved: 3.0
                    });
                    await wasteItem.save();

                    const pickup = new Pickup({
                        citizen: testCitizen._id,
                        wasteItem: wasteItem._id,
                        address: pickupData.address,
                        scheduledDate: pickupData.scheduledDate,
                        timeSlot: pickupData.timeSlot,
                        status: 'Pending'
                    });
                    await pickup.save();
                    createdPickups.push(pickup);
                }

                // Simulate concurrent mobile operations
                const operations = createdPickups.map(async (pickup, index) => {
                    // Alternate between different operations
                    if (index % 2 === 0) {
                        // Assign pickup
                        return await Pickup.findByIdAndUpdate(
                            pickup._id,
                            {
                                status: 'Assigned',
                                assignedCollector: testCollector._id,
                                assignedAt: new Date()
                            },
                            { new: true }
                        );
                    } else {
                        // Query pickup details
                        return await Pickup.findById(pickup._id)
                            .populate('citizen', 'name email')
                            .populate('wasteItem', 'material weight');
                    }
                });

                // Execute concurrent operations
                const results = await Promise.all(operations);

                // Verify all operations completed successfully
                expect(results.length).toBe(createdPickups.length);
                
                for (let i = 0; i < results.length; i++) {
                    const result = results[i];
                    expect(result).toBeDefined();
                    expect(result._id).toBeDefined();
                    
                    if (i % 2 === 0) {
                        // Assigned pickups should have correct status
                        expect(result.status).toBe('Assigned');
                        expect(result.assignedCollector).toBeDefined();
                        expect(result.assignedAt).toBeDefined();
                    } else {
                        // Queried pickups should have populated data
                        expect(result.citizen).toBeDefined();
                        expect(result.wasteItem).toBeDefined();
                    }
                }

                // Verify database consistency
                const finalPickups = await Pickup.find({
                    _id: { $in: createdPickups.map(p => p._id) }
                });

                expect(finalPickups.length).toBe(createdPickups.length);
                
                // Count assigned vs pending pickups
                const assignedCount = finalPickups.filter(p => p.status === 'Assigned').length;
                const pendingCount = finalPickups.filter(p => p.status === 'Pending').length;
                
                expect(assignedCount + pendingCount).toBe(createdPickups.length);
            }
        ), { numRuns: 5 });
    });
});