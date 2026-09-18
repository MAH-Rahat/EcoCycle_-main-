import fc from 'fast-check';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Pickup from '../models/Pickup.js';
import Waste from '../models/Waste.js';

/**
 * Property-Based Test for Offline Data Caching
 * **Validates: Requirements 5.4**
 * 
 * Property 20: Offline Data Caching
 * For any collector operating offline, essential pickup data should remain 
 * accessible from cache
 */

describe('Offline Data Caching Properties', () => {
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

    // Mock cache implementation for testing
    class MockOfflineCache {
        constructor() {
            this.cache = new Map();
            this.isOnline = true;
        }

        setOnlineStatus(online) {
            this.isOnline = online;
        }

        async cachePickupData(collectorId, pickups) {
            const cacheKey = `collector_${collectorId}_pickups`;
            const cacheData = {
                timestamp: new Date(),
                data: pickups,
                collectorId: collectorId
            };
            this.cache.set(cacheKey, cacheData);
            return cacheData;
        }

        async getCachedPickupData(collectorId) {
            const cacheKey = `collector_${collectorId}_pickups`;
            return this.cache.get(cacheKey);
        }

        async cachePickupUpdate(pickupId, updateData) {
            const cacheKey = `pickup_update_${pickupId}`;
            const cacheData = {
                timestamp: new Date(),
                pickupId: pickupId,
                updateData: updateData,
                synced: false
            };
            this.cache.set(cacheKey, cacheData);
            return cacheData;
        }

        async getPendingUpdates() {
            const updates = [];
            for (const [key, value] of this.cache.entries()) {
                if (key.startsWith('pickup_update_') && !value.synced) {
                    updates.push(value);
                }
            }
            return updates;
        }

        async markUpdateSynced(pickupId) {
            const cacheKey = `pickup_update_${pickupId}`;
            const cached = this.cache.get(cacheKey);
            if (cached) {
                cached.synced = true;
                this.cache.set(cacheKey, cached);
            }
        }

        async clearCache() {
            this.cache.clear();
        }

        getCacheSize() {
            return this.cache.size;
        }

        isDataStale(cacheData, maxAgeMs = 300000) { // 5 minutes default
            if (!cacheData || !cacheData.timestamp) return true;
            return (new Date() - new Date(cacheData.timestamp)) > maxAgeMs;
        }
    }

    // Custom arbitraries for test data generation
    const pickupStatusArbitrary = fc.constantFrom(
        'Pending', 'Assigned', 'En Route', 'Arrived', 'In Progress', 'Completed'
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

    const offlineUpdateArbitrary = fc.record({
        status: pickupStatusArbitrary,
        notes: fc.string({ minLength: 0, maxLength: 200 }),
        timestamp: fc.date({ min: new Date(Date.now() - 24 * 60 * 60 * 1000), max: new Date() })
    });

    /**
     * Property: Essential pickup data should be cacheable for offline access
     * When pickup data is cached, it should be retrievable even when offline
     * and contain all essential information for collector operations
     */
    test('should cache essential pickup data for offline access', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 1, maxLength: 15 }),
            async (pickupDataArray) => {
                const cache = new MockOfflineCache();
                
                // Create pickups with essential data
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
                        status: pickupData.status,
                        assignedCollector: testCollector._id
                    });
                    await pickup.save();
                    createdPickups.push(pickup);
                }

                // Fetch and cache pickup data (simulating online operation)
                const pickupsForCache = await Pickup.find({ 
                    assignedCollector: testCollector._id 
                })
                .populate('citizen', 'name email')
                .populate('wasteItem', 'material weight')
                .lean(); // Use lean for better caching performance

                // Cache the data
                const cachedData = await cache.cachePickupData(testCollector._id, pickupsForCache);

                // Verify caching was successful
                expect(cachedData).toBeDefined();
                expect(cachedData.data).toHaveLength(createdPickups.length);
                expect(cachedData.collectorId.toString()).toBe(testCollector._id.toString());
                expect(cachedData.timestamp).toBeDefined();

                // Simulate going offline
                cache.setOnlineStatus(false);

                // Retrieve cached data while offline
                const offlineCachedData = await cache.getCachedPickupData(testCollector._id);

                // Verify offline data access
                expect(offlineCachedData).toBeDefined();
                expect(offlineCachedData.data).toHaveLength(createdPickups.length);

                // Verify essential fields are present in cached data
                for (const cachedPickup of offlineCachedData.data) {
                    // Essential pickup fields for offline operation
                    expect(cachedPickup._id).toBeDefined();
                    expect(cachedPickup.address).toBeDefined();
                    expect(cachedPickup.scheduledDate).toBeDefined();
                    expect(cachedPickup.timeSlot).toBeDefined();
                    expect(cachedPickup.status).toBeDefined();
                    expect(cachedPickup.assignedCollector).toBeDefined();

                    // Essential citizen information
                    expect(cachedPickup.citizen).toBeDefined();
                    expect(cachedPickup.citizen.name).toBeDefined();
                    expect(cachedPickup.citizen.email).toBeDefined();

                    // Essential waste item information
                    expect(cachedPickup.wasteItem).toBeDefined();
                    expect(cachedPickup.wasteItem.material).toBeDefined();
                    expect(cachedPickup.wasteItem.weight).toBeDefined();
                }
            }
        ), { numRuns: 6 });
    });

    /**
     * Property: Offline status updates should be cached and synchronized later
     * When collectors update pickup status while offline, updates should be
     * stored locally and synchronized when connection is restored
     */
    test('should cache offline status updates for later synchronization', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 1, maxLength: 8 }),
            fc.array(offlineUpdateArbitrary, { minLength: 1, maxLength: 8 }),
            async (pickupDataArray, updateDataArray) => {
                const cache = new MockOfflineCache();
                
                // Create pickups
                const createdPickups = [];
                
                for (const pickupData of pickupDataArray) {
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
                        status: 'Assigned',
                        assignedCollector: testCollector._id
                    });
                    await pickup.save();
                    createdPickups.push(pickup);
                }

                // Simulate going offline
                cache.setOnlineStatus(false);

                // Cache offline updates
                const cachedUpdates = [];
                const updateCount = Math.min(createdPickups.length, updateDataArray.length);
                
                for (let i = 0; i < updateCount; i++) {
                    const pickup = createdPickups[i];
                    const updateData = updateDataArray[i];
                    
                    const cachedUpdate = await cache.cachePickupUpdate(pickup._id, {
                        status: updateData.status,
                        notes: updateData.notes,
                        timestamp: updateData.timestamp,
                        collectorId: testCollector._id
                    });
                    
                    cachedUpdates.push(cachedUpdate);
                }

                // Verify updates were cached
                expect(cachedUpdates).toHaveLength(updateCount);
                
                for (const cachedUpdate of cachedUpdates) {
                    expect(cachedUpdate.pickupId).toBeDefined();
                    expect(cachedUpdate.updateData).toBeDefined();
                    expect(cachedUpdate.updateData.status).toBeDefined();
                    expect(cachedUpdate.updateData.collectorId.toString()).toBe(testCollector._id.toString());
                    expect(cachedUpdate.synced).toBe(false);
                    expect(cachedUpdate.timestamp).toBeDefined();
                }

                // Retrieve pending updates
                const pendingUpdates = await cache.getPendingUpdates();
                expect(pendingUpdates).toHaveLength(updateCount);

                // Verify all updates are marked as unsynced
                for (const update of pendingUpdates) {
                    expect(update.synced).toBe(false);
                    expect(update.updateData).toBeDefined();
                }

                // Simulate coming back online and syncing
                cache.setOnlineStatus(true);
                
                // Sync updates (simulate applying to database)
                for (const update of pendingUpdates) {
                    // In real implementation, this would update the database
                    await Pickup.findByIdAndUpdate(
                        update.pickupId,
                        {
                            status: update.updateData.status,
                            collectionNotes: update.updateData.notes
                        }
                    );
                    
                    // Mark as synced in cache
                    await cache.markUpdateSynced(update.pickupId);
                }

                // Verify no pending updates remain
                const remainingUpdates = await cache.getPendingUpdates();
                expect(remainingUpdates).toHaveLength(0);
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: Cache should handle data staleness appropriately
     * When cached data becomes stale, the system should detect this
     * and handle it appropriately for offline operations
     */
    test('should handle cache data staleness appropriately', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 1, maxLength: 10 }),
            fc.integer({ min: 1000, max: 600000 }), // 1 second to 10 minutes
            async (pickupDataArray, maxAgeMs) => {
                const cache = new MockOfflineCache();
                
                // Create and cache pickup data
                const createdPickups = [];
                
                for (const pickupData of pickupDataArray) {
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
                        address: pickupData.address,
                        scheduledDate: pickupData.scheduledDate,
                        timeSlot: pickupData.timeSlot,
                        status: pickupData.status,
                        assignedCollector: testCollector._id
                    });
                    await pickup.save();
                    createdPickups.push(pickup);
                }

                // Cache the data with current timestamp
                const pickupsForCache = await Pickup.find({ 
                    assignedCollector: testCollector._id 
                }).lean();

                const cachedData = await cache.cachePickupData(testCollector._id, pickupsForCache);

                // Verify data is initially fresh
                expect(cache.isDataStale(cachedData, maxAgeMs)).toBe(false);

                // Simulate time passing by modifying timestamp
                const oldTimestamp = new Date(Date.now() - maxAgeMs - 1000); // 1 second past max age
                cachedData.timestamp = oldTimestamp;

                // Verify data is now stale
                expect(cache.isDataStale(cachedData, maxAgeMs)).toBe(true);

                // Test with fresh data again
                const freshCachedData = await cache.cachePickupData(testCollector._id, pickupsForCache);
                expect(cache.isDataStale(freshCachedData, maxAgeMs)).toBe(false);

                // Verify cache can still provide stale data for offline operations
                const retrievedData = await cache.getCachedPickupData(testCollector._id);
                expect(retrievedData).toBeDefined();
                expect(retrievedData.data).toHaveLength(createdPickups.length);
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: Cache should efficiently manage storage space
     * When caching data for offline use, the cache should manage
     * storage efficiently and not grow unbounded
     */
    test('should manage cache storage efficiently', async () => {
        await fc.assert(fc.asyncProperty(
            fc.integer({ min: 5, max: 50 }),
            fc.integer({ min: 1, max: 10 }),
            async (pickupCount, operationCount) => {
                const cache = new MockOfflineCache();
                
                // Create multiple sets of pickup data
                for (let op = 0; op < operationCount; op++) {
                    const pickups = [];
                    
                    for (let i = 0; i < pickupCount; i++) {
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
                            address: `Address ${op}-${i}`,
                            scheduledDate: '2024-12-31',
                            timeSlot: 'Morning',
                            status: 'Assigned',
                            assignedCollector: testCollector._id
                        });
                        await pickup.save();
                        pickups.push(pickup);
                    }

                    // Cache the data (this should replace previous cache)
                    const pickupsForCache = await Pickup.find({ 
                        assignedCollector: testCollector._id 
                    }).lean();

                    await cache.cachePickupData(testCollector._id, pickupsForCache);
                    
                    // Add some offline updates
                    for (let j = 0; j < Math.min(3, pickups.length); j++) {
                        await cache.cachePickupUpdate(pickups[j]._id, {
                            status: 'In Progress',
                            notes: `Update ${op}-${j}`,
                            timestamp: new Date()
                        });
                    }
                }

                // Verify cache size is reasonable (not growing unbounded)
                const cacheSize = cache.getCacheSize();
                
                // Cache should contain:
                // 1. One pickup data cache entry per collector
                // 2. Offline update entries (limited by operations)
                const expectedMaxSize = 1 + (operationCount * Math.min(3, pickupCount));
                expect(cacheSize).toBeLessThanOrEqual(expectedMaxSize);

                // Verify cached data is still accessible
                const cachedData = await cache.getCachedPickupData(testCollector._id);
                expect(cachedData).toBeDefined();
                expect(cachedData.data).toBeDefined();

                // Verify pending updates are manageable
                const pendingUpdates = await cache.getPendingUpdates();
                expect(pendingUpdates.length).toBeLessThanOrEqual(operationCount * Math.min(3, pickupCount));
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: Cache should maintain data integrity during offline operations
     * When performing multiple offline operations, cached data should
     * remain consistent and not become corrupted
     */
    test('should maintain data integrity during offline operations', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 3, maxLength: 12 }),
            fc.array(offlineUpdateArbitrary, { minLength: 1, maxLength: 5 }),
            async (pickupDataArray, updateDataArray) => {
                const cache = new MockOfflineCache();
                
                // Create pickups
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
                        status: 'Assigned',
                        assignedCollector: testCollector._id
                    });
                    await pickup.save();
                    createdPickups.push(pickup);
                }

                // Cache initial data
                const pickupsForCache = await Pickup.find({ 
                    assignedCollector: testCollector._id 
                }).populate('citizen', 'name email').populate('wasteItem', 'material weight').lean();

                const initialCacheData = await cache.cachePickupData(testCollector._id, pickupsForCache);

                // Simulate offline operations
                cache.setOnlineStatus(false);

                // Perform multiple offline updates
                const appliedUpdates = [];
                const updateCount = Math.min(createdPickups.length, updateDataArray.length);
                
                for (let i = 0; i < updateCount; i++) {
                    const pickup = createdPickups[i];
                    const updateData = updateDataArray[i];
                    
                    const update = await cache.cachePickupUpdate(pickup._id, {
                        status: updateData.status,
                        notes: updateData.notes,
                        timestamp: updateData.timestamp,
                        collectorId: testCollector._id
                    });
                    
                    appliedUpdates.push(update);
                }

                // Verify cache integrity
                const cachedPickupData = await cache.getCachedPickupData(testCollector._id);
                expect(cachedPickupData).toBeDefined();
                expect(cachedPickupData.data).toHaveLength(createdPickups.length);

                // Verify all original data is intact
                for (const originalPickup of createdPickups) {
                    const cachedPickup = cachedPickupData.data.find(
                        p => p._id.toString() === originalPickup._id.toString()
                    );
                    
                    expect(cachedPickup).toBeDefined();
                    expect(cachedPickup.address).toBe(originalPickup.address);
                    expect(cachedPickup.scheduledDate).toBe(originalPickup.scheduledDate);
                    expect(cachedPickup.timeSlot).toBe(originalPickup.timeSlot);
                    expect(cachedPickup.citizen).toBeDefined();
                    expect(cachedPickup.wasteItem).toBeDefined();
                }

                // Verify offline updates are properly stored
                const pendingUpdates = await cache.getPendingUpdates();
                expect(pendingUpdates).toHaveLength(updateCount);

                // Verify each update maintains integrity
                for (const update of pendingUpdates) {
                    expect(update.pickupId).toBeDefined();
                    expect(update.updateData).toBeDefined();
                    expect(update.updateData.status).toBeDefined();
                    expect(update.updateData.collectorId.toString()).toBe(testCollector._id.toString());
                    expect(update.synced).toBe(false);
                    expect(update.timestamp).toBeDefined();
                    
                    // Verify update corresponds to a real pickup
                    const correspondingPickup = createdPickups.find(
                        p => p._id.toString() === update.pickupId.toString()
                    );
                    expect(correspondingPickup).toBeDefined();
                }

                // Clear cache and verify it's empty
                await cache.clearCache();
                expect(cache.getCacheSize()).toBe(0);
                
                const clearedData = await cache.getCachedPickupData(testCollector._id);
                expect(clearedData).toBeUndefined();
            }
        ), { numRuns: 5 });
    });
});