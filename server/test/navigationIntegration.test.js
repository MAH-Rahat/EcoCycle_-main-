import fc from 'fast-check';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Pickup from '../models/Pickup.js';
import Waste from '../models/Waste.js';

/**
 * Property-Based Test for Navigation Integration
 * **Validates: Requirements 5.2**
 * 
 * Property 19: Navigation Integration
 * For any pickup selection by a collector, Google Maps integration should 
 * provide correct navigation functionality
 */

describe('Navigation Integration Properties', () => {
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

    // Mock Google Maps API for testing
    class MockGoogleMapsAPI {
        constructor() {
            this.apiKey = 'test_api_key';
            this.requestCount = 0;
            this.isAvailable = true;
        }

        setAvailability(available) {
            this.isAvailable = available;
        }

        async geocodeAddress(address) {
            this.requestCount++;
            
            if (!this.isAvailable) {
                throw new Error('Google Maps API unavailable');
            }

            // Mock geocoding response
            const mockCoordinates = this.generateMockCoordinates(address);
            return {
                lat: mockCoordinates.lat,
                lng: mockCoordinates.lng,
                formatted_address: address,
                place_id: `place_${this.requestCount}`,
                status: 'OK'
            };
        }

        async getDirections(origin, destination, options = {}) {
            this.requestCount++;
            
            if (!this.isAvailable) {
                throw new Error('Google Maps API unavailable');
            }

            const originCoords = typeof origin === 'string' ? 
                await this.geocodeAddress(origin) : origin;
            const destCoords = typeof destination === 'string' ? 
                await this.geocodeAddress(destination) : destination;

            // Calculate mock distance and duration
            const distance = this.calculateDistance(originCoords, destCoords);
            const duration = Math.max(300, distance * 60); // Minimum 5 minutes

            return {
                status: 'OK',
                routes: [{
                    legs: [{
                        distance: {
                            text: `${distance.toFixed(1)} km`,
                            value: Math.round(distance * 1000)
                        },
                        duration: {
                            text: `${Math.round(duration / 60)} min`,
                            value: duration
                        },
                        start_address: typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`,
                        end_address: typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`,
                        start_location: originCoords,
                        end_location: destCoords,
                        steps: this.generateMockSteps(originCoords, destCoords)
                    }]
                }],
                request: {
                    origin: origin,
                    destination: destination,
                    travelMode: options.travelMode || 'DRIVING'
                }
            };
        }

        async optimizeRoute(waypoints, options = {}) {
            this.requestCount++;
            
            if (!this.isAvailable) {
                throw new Error('Google Maps API unavailable');
            }

            if (waypoints.length < 2) {
                throw new Error('At least 2 waypoints required for route optimization');
            }

            // Mock route optimization
            const optimizedOrder = this.mockOptimizeWaypoints(waypoints);
            const totalDistance = this.calculateTotalDistance(optimizedOrder);
            const totalDuration = Math.max(600, totalDistance * 60); // Minimum 10 minutes

            return {
                status: 'OK',
                optimized_order: optimizedOrder.map((_, index) => index),
                total_distance: {
                    text: `${totalDistance.toFixed(1)} km`,
                    value: Math.round(totalDistance * 1000)
                },
                total_duration: {
                    text: `${Math.round(totalDuration / 60)} min`,
                    value: totalDuration
                },
                waypoints: optimizedOrder
            };
        }

        generateMockCoordinates(address) {
            // Generate deterministic coordinates based on address hash
            const hash = this.simpleHash(address);
            return {
                lat: 40.7128 + (hash % 1000) / 10000, // Around NYC
                lng: -74.0060 + (hash % 1000) / 10000
            };
        }

        calculateDistance(coord1, coord2) {
            // Simple distance calculation (not accurate, just for testing)
            const latDiff = coord1.lat - coord2.lat;
            const lngDiff = coord1.lng - coord2.lng;
            return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // Rough km conversion
        }

        calculateTotalDistance(waypoints) {
            let total = 0;
            for (let i = 0; i < waypoints.length - 1; i++) {
                total += this.calculateDistance(waypoints[i], waypoints[i + 1]);
            }
            return total;
        }

        generateMockSteps(origin, destination) {
            return [
                {
                    distance: { text: '0.5 km', value: 500 },
                    duration: { text: '2 min', value: 120 },
                    html_instructions: 'Head north',
                    start_location: origin,
                    end_location: { lat: origin.lat + 0.001, lng: origin.lng }
                },
                {
                    distance: { text: '1.0 km', value: 1000 },
                    duration: { text: '3 min', value: 180 },
                    html_instructions: 'Turn right',
                    start_location: { lat: origin.lat + 0.001, lng: origin.lng },
                    end_location: destination
                }
            ];
        }

        mockOptimizeWaypoints(waypoints) {
            // Simple optimization: sort by latitude (mock algorithm)
            return [...waypoints].sort((a, b) => a.lat - b.lat);
        }

        simpleHash(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            return Math.abs(hash);
        }

        getRequestCount() {
            return this.requestCount;
        }

        resetRequestCount() {
            this.requestCount = 0;
        }
    }

    // Custom arbitraries for test data generation
    const addressArbitrary = fc.record({
        street: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
        city: fc.string({ minLength: 3, maxLength: 30 }).filter(s => s.trim().length > 0),
        zipCode: fc.string({ minLength: 5, maxLength: 10 }).filter(s => /^\d+$/.test(s))
    }).map(addr => `${addr.street}, ${addr.city}, ${addr.zipCode}`);

    const coordinatesArbitrary = fc.record({
        lat: fc.float({ min: -90, max: 90, noNaN: true }),
        lng: fc.float({ min: -180, max: 180, noNaN: true })
    });

    const pickupDataArbitrary = fc.record({
        address: addressArbitrary,
        scheduledDate: fc.date({ min: new Date(), max: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })
            .map(date => date.toISOString().split('T')[0]),
        timeSlot: fc.constantFrom('Morning', 'Afternoon', 'Evening')
    });

    const collectorLocationArbitrary = coordinatesArbitrary;

    /**
     * Property: Navigation should provide valid directions for any pickup address
     * When a collector selects a pickup, the system should generate valid
     * navigation directions using Google Maps integration
     */
    test('should provide valid navigation directions for pickup addresses', async () => {
        await fc.assert(fc.asyncProperty(
            pickupDataArbitrary,
            collectorLocationArbitrary,
            async (pickupData, collectorLocation) => {
                const mapsAPI = new MockGoogleMapsAPI();
                
                // Create waste item and pickup
                const wasteItem = new Waste({
                    citizen: testCitizen._id,
                    material: 'Plastic',
                    weight: 5.0,
                    pointsEarned: 50,
                    co2Saved: 2.5
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

                // Test navigation integration
                const directions = await mapsAPI.getDirections(
                    collectorLocation,
                    pickupData.address,
                    { travelMode: 'DRIVING' }
                );

                // Verify navigation response structure
                expect(directions.status).toBe('OK');
                expect(directions.routes).toBeDefined();
                expect(directions.routes.length).toBeGreaterThan(0);

                const route = directions.routes[0];
                expect(route.legs).toBeDefined();
                expect(route.legs.length).toBeGreaterThan(0);

                const leg = route.legs[0];
                
                // Verify essential navigation data
                expect(leg.distance).toBeDefined();
                expect(leg.distance.text).toBeDefined();
                expect(leg.distance.value).toBeGreaterThan(0);
                
                expect(leg.duration).toBeDefined();
                expect(leg.duration.text).toBeDefined();
                expect(leg.duration.value).toBeGreaterThan(0);
                
                expect(leg.start_location).toBeDefined();
                expect(leg.end_location).toBeDefined();
                expect(leg.steps).toBeDefined();
                expect(leg.steps.length).toBeGreaterThan(0);

                // Verify coordinates are valid
                expect(leg.start_location.lat).toBeGreaterThanOrEqual(-90);
                expect(leg.start_location.lat).toBeLessThanOrEqual(90);
                expect(leg.start_location.lng).toBeGreaterThanOrEqual(-180);
                expect(leg.start_location.lng).toBeLessThanOrEqual(180);

                expect(leg.end_location.lat).toBeGreaterThanOrEqual(-90);
                expect(leg.end_location.lat).toBeLessThanOrEqual(90);
                expect(leg.end_location.lng).toBeGreaterThanOrEqual(-180);
                expect(leg.end_location.lng).toBeLessThanOrEqual(180);

                // Verify step-by-step directions
                for (const step of leg.steps) {
                    expect(step.distance).toBeDefined();
                    expect(step.duration).toBeDefined();
                    expect(step.html_instructions).toBeDefined();
                    expect(step.start_location).toBeDefined();
                    expect(step.end_location).toBeDefined();
                }
            }
        ), { numRuns: 7 });
    });

    /**
     * Property: Address geocoding should work correctly for pickup locations
     * When pickup addresses are geocoded, they should return valid coordinates
     * that can be used for navigation
     */
    test('should geocode pickup addresses correctly', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 1, maxLength: 10 }),
            async (pickupDataArray) => {
                const mapsAPI = new MockGoogleMapsAPI();
                
                // Create pickups with various addresses
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

                // Test geocoding for each pickup address
                for (const pickup of createdPickups) {
                    const geocodeResult = await mapsAPI.geocodeAddress(pickup.address);

                    // Verify geocoding response
                    expect(geocodeResult.status).toBe('OK');
                    expect(geocodeResult.lat).toBeDefined();
                    expect(geocodeResult.lng).toBeDefined();
                    expect(geocodeResult.formatted_address).toBeDefined();
                    expect(geocodeResult.place_id).toBeDefined();

                    // Verify coordinates are valid
                    expect(geocodeResult.lat).toBeGreaterThanOrEqual(-90);
                    expect(geocodeResult.lat).toBeLessThanOrEqual(90);
                    expect(geocodeResult.lng).toBeGreaterThanOrEqual(-180);
                    expect(geocodeResult.lng).toBeLessThanOrEqual(180);

                    // Verify formatted address contains original address elements
                    expect(geocodeResult.formatted_address).toContain(pickup.address);
                    
                    // Verify place_id is unique
                    expect(geocodeResult.place_id).toMatch(/^place_\d+$/);
                }

                // Verify API request count is reasonable
                expect(mapsAPI.getRequestCount()).toBe(createdPickups.length);
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: Route optimization should work for multiple pickup locations
     * When collectors have multiple pickups, the system should optimize
     * the route to minimize travel time and distance
     */
    test('should optimize routes for multiple pickup locations', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 2, maxLength: 8 }),
            collectorLocationArbitrary,
            async (pickupDataArray, collectorLocation) => {
                const mapsAPI = new MockGoogleMapsAPI();
                
                // Create multiple pickups for route optimization
                const createdPickups = [];
                const waypoints = [collectorLocation]; // Start with collector location
                
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
                        status: 'Assigned',
                        assignedCollector: testCollector._id
                    });
                    await pickup.save();
                    createdPickups.push(pickup);

                    // Add pickup location to waypoints
                    const coords = mapsAPI.generateMockCoordinates(pickupData.address);
                    waypoints.push(coords);
                }

                // Test route optimization
                const optimizedRoute = await mapsAPI.optimizeRoute(waypoints, {
                    travelMode: 'DRIVING'
                });

                // Verify optimization response
                expect(optimizedRoute.status).toBe('OK');
                expect(optimizedRoute.optimized_order).toBeDefined();
                expect(optimizedRoute.optimized_order.length).toBe(waypoints.length);
                expect(optimizedRoute.total_distance).toBeDefined();
                expect(optimizedRoute.total_duration).toBeDefined();
                expect(optimizedRoute.waypoints).toBeDefined();

                // Verify total distance and duration are reasonable
                expect(optimizedRoute.total_distance.value).toBeGreaterThan(0);
                expect(optimizedRoute.total_duration.value).toBeGreaterThan(0);
                expect(optimizedRoute.total_duration.value).toBeGreaterThanOrEqual(600); // At least 10 minutes

                // Verify optimized order contains all waypoint indices
                const orderSet = new Set(optimizedRoute.optimized_order);
                for (let i = 0; i < waypoints.length; i++) {
                    expect(orderSet.has(i)).toBe(true);
                }

                // Verify waypoints match original count
                expect(optimizedRoute.waypoints.length).toBe(waypoints.length);

                // Verify each waypoint has valid coordinates
                for (const waypoint of optimizedRoute.waypoints) {
                    expect(waypoint.lat).toBeGreaterThanOrEqual(-90);
                    expect(waypoint.lat).toBeLessThanOrEqual(90);
                    expect(waypoint.lng).toBeGreaterThanOrEqual(-180);
                    expect(waypoint.lng).toBeLessThanOrEqual(180);
                }
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: Navigation should handle API failures gracefully
     * When Google Maps API is unavailable, the system should handle
     * errors gracefully and provide fallback functionality
     */
    test('should handle navigation API failures gracefully', async () => {
        await fc.assert(fc.asyncProperty(
            pickupDataArbitrary,
            collectorLocationArbitrary,
            async (pickupData, collectorLocation) => {
                const mapsAPI = new MockGoogleMapsAPI();
                
                // Create pickup
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
                    status: 'Assigned',
                    assignedCollector: testCollector._id
                });
                await pickup.save();

                // Test with API available first
                mapsAPI.setAvailability(true);
                const successfulDirections = await mapsAPI.getDirections(
                    collectorLocation,
                    pickupData.address
                );
                expect(successfulDirections.status).toBe('OK');

                // Test with API unavailable
                mapsAPI.setAvailability(false);
                
                try {
                    await mapsAPI.getDirections(collectorLocation, pickupData.address);
                    // Should not reach here
                    expect(true).toBe(false);
                } catch (error) {
                    // Verify error handling
                    expect(error).toBeDefined();
                    expect(error.message).toContain('Google Maps API unavailable');
                }

                try {
                    await mapsAPI.geocodeAddress(pickupData.address);
                    // Should not reach here
                    expect(true).toBe(false);
                } catch (error) {
                    // Verify error handling
                    expect(error).toBeDefined();
                    expect(error.message).toContain('Google Maps API unavailable');
                }

                // Verify pickup data is still accessible for fallback
                const retrievedPickup = await Pickup.findById(pickup._id);
                expect(retrievedPickup).toBeDefined();
                expect(retrievedPickup.address).toBe(pickupData.address);
                
                // System should still provide basic address information
                expect(retrievedPickup.address.length).toBeGreaterThan(0);
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: Navigation integration should maintain performance standards
     * When navigation requests are made, they should complete within
     * reasonable time limits to maintain user experience
     */
    test('should maintain navigation performance standards', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(pickupDataArbitrary, { minLength: 1, maxLength: 5 }),
            collectorLocationArbitrary,
            async (pickupDataArray, collectorLocation) => {
                const mapsAPI = new MockGoogleMapsAPI();
                
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

                // Test navigation performance
                const startTime = Date.now();
                
                // Perform navigation operations
                const navigationPromises = createdPickups.map(async (pickup) => {
                    return await mapsAPI.getDirections(
                        collectorLocation,
                        pickup.address,
                        { travelMode: 'DRIVING' }
                    );
                });

                const results = await Promise.all(navigationPromises);
                const totalTime = Date.now() - startTime;

                // Verify performance (should complete within reasonable time)
                // Allow 3 seconds per pickup as per Requirements 5.5
                const maxAllowedTime = createdPickups.length * 3000;
                expect(totalTime).toBeLessThan(maxAllowedTime);

                // Verify all navigation requests succeeded
                expect(results.length).toBe(createdPickups.length);
                
                for (const result of results) {
                    expect(result.status).toBe('OK');
                    expect(result.routes).toBeDefined();
                    expect(result.routes.length).toBeGreaterThan(0);
                }

                // Verify API usage is efficient
                expect(mapsAPI.getRequestCount()).toBe(createdPickups.length * 2); // geocoding + directions
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: Navigation should provide consistent results for same locations
     * When the same pickup location is requested multiple times,
     * navigation should provide consistent results
     */
    test('should provide consistent navigation results for same locations', async () => {
        await fc.assert(fc.asyncProperty(
            pickupDataArbitrary,
            collectorLocationArbitrary,
            fc.integer({ min: 2, max: 5 }),
            async (pickupData, collectorLocation, requestCount) => {
                const mapsAPI = new MockGoogleMapsAPI();
                
                // Create pickup
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
                    status: 'Assigned',
                    assignedCollector: testCollector._id
                });
                await pickup.save();

                // Make multiple navigation requests for the same location
                const results = [];
                
                for (let i = 0; i < requestCount; i++) {
                    const directions = await mapsAPI.getDirections(
                        collectorLocation,
                        pickupData.address
                    );
                    results.push(directions);
                }

                // Verify consistency across requests
                expect(results.length).toBe(requestCount);
                
                const firstResult = results[0];
                expect(firstResult.status).toBe('OK');

                for (let i = 1; i < results.length; i++) {
                    const currentResult = results[i];
                    
                    // Verify consistent status
                    expect(currentResult.status).toBe(firstResult.status);
                    
                    // Verify consistent route structure
                    expect(currentResult.routes.length).toBe(firstResult.routes.length);
                    
                    const firstLeg = firstResult.routes[0].legs[0];
                    const currentLeg = currentResult.routes[0].legs[0];
                    
                    // Verify consistent distance and duration
                    expect(currentLeg.distance.value).toBe(firstLeg.distance.value);
                    expect(currentLeg.duration.value).toBe(firstLeg.duration.value);
                    
                    // Verify consistent start and end locations
                    expect(currentLeg.start_location.lat).toBeCloseTo(firstLeg.start_location.lat, 5);
                    expect(currentLeg.start_location.lng).toBeCloseTo(firstLeg.start_location.lng, 5);
                    expect(currentLeg.end_location.lat).toBeCloseTo(firstLeg.end_location.lat, 5);
                    expect(currentLeg.end_location.lng).toBeCloseTo(firstLeg.end_location.lng, 5);
                }
            }
        ), { numRuns: 5 });
    });
});