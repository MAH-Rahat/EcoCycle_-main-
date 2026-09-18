import fc from 'fast-check';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Pickup from '../models/Pickup.js';
import WasteLog from '../models/Waste.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';

// Feature: ecocycle-platform, Property 16: Real-time Location Tracking

describe('Real-time Location Tracking Property Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
    }
  });

  beforeEach(async () => {
    // Clear all collections
    await User.deleteMany({});
    await Pickup.deleteMany({});
    await WasteLog.deleteMany({});
    await WasteTypeConfig.deleteMany({});

    // Clear tracking data
    locationUpdates.clear();
    webSocketConnections.clear();

    // Initialize waste type configurations
    const wasteTypes = [
      { type: 'plastic', pointsPerKg: 10, co2SavedPerKg: 2.5 },
      { type: 'paper', pointsPerKg: 5, co2SavedPerKg: 1.2 },
      { type: 'glass', pointsPerKg: 8, co2SavedPerKg: 0.8 },
      { type: 'metal', pointsPerKg: 15, co2SavedPerKg: 3.2 },
      { type: 'organic', pointsPerKg: 3, co2SavedPerKg: 0.5 },
      { type: 'electronic', pointsPerKg: 20, co2SavedPerKg: 5.0 }
    ];
    
    await WasteTypeConfig.insertMany(wasteTypes);
  });

  // Mock WebSocket and location tracking
  const locationUpdates = new Map(); // pickupId -> [locationUpdate]
  const webSocketConnections = new Map(); // userId -> connection info

  // Custom generators for test data
  const wasteTypeGen = fc.constantFrom('plastic', 'paper', 'glass', 'metal', 'organic', 'electronic');
  const weightGen = fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true });
  const priorityGen = fc.constantFrom('low', 'medium', 'high', 'urgent');
  
  const coordinatesGen = fc.record({
    lat: fc.float({ min: Math.fround(-90), max: Math.fround(90), noNaN: true }),
    lng: fc.float({ min: Math.fround(-180), max: Math.fround(180), noNaN: true })
  });

  const addressGen = fc.record({
    street: fc.string({ minLength: 5, maxLength: 100 }),
    city: fc.string({ minLength: 2, maxLength: 50 }),
    zipCode: fc.string({ minLength: 5, maxLength: 10 }),
    coordinates: coordinatesGen
  });

  const userGen = fc.record({
    email: fc.emailAddress(),
    firstName: fc.string({ minLength: 1, maxLength: 50 }),
    lastName: fc.string({ minLength: 1, maxLength: 50 }),
    address: addressGen
  });

  const wasteLogGen = fc.record({
    wasteType: wasteTypeGen,
    weight: weightGen,
    description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined })
  });

  // Generator for location updates (realistic GPS coordinates)
  const locationUpdateGen = fc.record({
    lat: fc.float({ min: Math.fround(-85), max: Math.fround(85), noNaN: true }),
    lng: fc.float({ min: Math.fround(-175), max: Math.fround(175), noNaN: true }),
    accuracy: fc.float({ min: Math.fround(1), max: Math.fround(100), noNaN: true }),
    speed: fc.option(fc.float({ min: Math.fround(0), max: Math.fround(120), noNaN: true }), { nil: undefined }),
    heading: fc.option(fc.float({ min: Math.fround(0), max: Math.fround(360), noNaN: true }), { nil: undefined })
  });

  /**
   * Property 16: Real-time Location Tracking
   * For any active pickup with an en-route collector, citizens should receive location updates within the specified time limits
   * **Validates: Requirements 4.2**
   */
  test('Property 16: Citizens receive collector location updates within time limits for en-route pickups', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen, 
        wasteLogGen, 
        priorityGen,
        fc.array(locationUpdateGen, { minLength: 3, maxLength: 10 }),
        async (userData, wasteLogData, priority, locationSequence) => {
          // Create citizen user
          const citizen = new User({
            email: userData.email,
            password: 'hashedpassword123',
            role: 'citizen',
            profile: {
              firstName: userData.firstName,
              lastName: userData.lastName,
              addresses: [{
                street: userData.address.street,
                city: userData.address.city,
                zipCode: userData.address.zipCode,
                coordinates: {
                  type: 'Point',
                  coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
                },
                isDefault: true
              }],
              preferences: {
                notifications: { pickup: true, rewards: true, challenges: true },
                privacy: { showInLeaderboard: true, shareImpactData: true }
              }
            }
          });
          await citizen.save();

          // Create collector user
          const collector = new User({
            email: `collector_${userData.email}`,
            password: 'hashedpassword123',
            role: 'collector',
            profile: {
              firstName: 'Test',
              lastName: 'Collector',
              addresses: [{
                street: userData.address.street,
                city: userData.address.city,
                zipCode: userData.address.zipCode,
                coordinates: {
                  type: 'Point',
                  coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
                },
                isDefault: true
              }],
              preferences: {
                notifications: { pickup: true, rewards: true, challenges: true },
                privacy: { showInLeaderboard: true, shareImpactData: true }
              }
            }
          });
          await collector.save();

          // Create waste log and pickup request
          const wasteLog = new WasteLog({
            citizenId: citizen._id,
            wasteType: wasteLogData.wasteType,
            weight: wasteLogData.weight,
            description: wasteLogData.description,
            location: {
              addressId: citizen.profile.addresses[0]._id,
              coordinates: {
                type: 'Point',
                coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
              }
            },
            ecoPointsEarned: 10,
            status: 'pending'
          });
          await wasteLog.save();

          const pickup = await createPickupRequest(
            citizen._id,
            [wasteLog._id],
            citizen.profile.addresses[0],
            priority
          );

          // Set pickup to en_route status
          pickup.status = 'en_route';
          pickup.assignedCollectorId = collector._id;
          await pickup.save();

          // Establish WebSocket connection for citizen
          await establishWebSocketConnection(citizen._id, pickup._id);

          // Send location updates from collector
          const updateTimes = [];
          for (const locationData of locationSequence) {
            const updateTime = new Date();
            updateTimes.push(updateTime);

            await sendCollectorLocationUpdate(
              collector._id,
              pickup._id,
              locationData,
              updateTime
            );

            // Small delay between updates (realistic scenario)
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Verify citizen received all location updates
          const citizenUpdates = locationUpdates.get(pickup._id.toString()) || [];
          expect(citizenUpdates).toHaveLength(locationSequence.length);

          // Verify each update was delivered within time limits (10 seconds per requirement)
          for (let i = 0; i < citizenUpdates.length; i++) {
            const update = citizenUpdates[i];
            const originalTime = updateTimes[i];
            const deliveryDelay = update.deliveredAt.getTime() - originalTime.getTime();

            expect(deliveryDelay).toBeLessThan(10000); // 10 seconds
            expect(update.collectorId).toBe(collector._id.toString());
            expect(update.pickupId).toBe(pickup._id.toString());
            expect(update.location.lat).toBe(locationSequence[i].lat);
            expect(update.location.lng).toBe(locationSequence[i].lng);
            expect(update.location.accuracy).toBe(locationSequence[i].accuracy);
          }

          // Verify updates are in chronological order
          for (let i = 1; i < citizenUpdates.length; i++) {
            expect(citizenUpdates[i].timestamp.getTime()).toBeGreaterThanOrEqual(
              citizenUpdates[i - 1].timestamp.getTime()
            );
          }
        }
      ),
      { numRuns: 25, timeout: 30000 }
    );
  });

  /**
   * Property: Location updates are only sent for active en-route pickups
   * For any pickup not in en-route status, location updates should not be sent to citizens
   */
  test('Property: Location updates are only sent for en-route pickups', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen, 
        wasteLogGen, 
        priorityGen,
        fc.constantFrom('pending', 'assigned', 'arrived', 'in_progress', 'completed', 'cancelled'),
        locationUpdateGen,
        async (userData, wasteLogData, priority, pickupStatus, locationData) => {
          // Create users
          const citizen = new User({
            email: userData.email,
            password: 'hashedpassword123',
            role: 'citizen',
            profile: {
              firstName: userData.firstName,
              lastName: userData.lastName,
              addresses: [{
                street: userData.address.street,
                city: userData.address.city,
                zipCode: userData.address.zipCode,
                coordinates: {
                  type: 'Point',
                  coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
                },
                isDefault: true
              }],
              preferences: {
                notifications: { pickup: true, rewards: true, challenges: true },
                privacy: { showInLeaderboard: true, shareImpactData: true }
              }
            }
          });
          await citizen.save();

          const collector = new User({
            email: `collector_${userData.email}`,
            password: 'hashedpassword123',
            role: 'collector',
            profile: {
              firstName: 'Test',
              lastName: 'Collector',
              addresses: [{
                street: userData.address.street,
                city: userData.address.city,
                zipCode: userData.address.zipCode,
                coordinates: {
                  type: 'Point',
                  coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
                },
                isDefault: true
              }],
              preferences: {
                notifications: { pickup: true, rewards: true, challenges: true },
                privacy: { showInLeaderboard: true, shareImpactData: true }
              }
            }
          });
          await collector.save();

          // Create waste log and pickup request
          const wasteLog = new WasteLog({
            citizenId: citizen._id,
            wasteType: wasteLogData.wasteType,
            weight: wasteLogData.weight,
            location: {
              addressId: citizen.profile.addresses[0]._id,
              coordinates: {
                type: 'Point',
                coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
              }
            },
            ecoPointsEarned: 10,
            status: 'pending'
          });
          await wasteLog.save();

          const pickup = await createPickupRequest(
            citizen._id,
            [wasteLog._id],
            citizen.profile.addresses[0],
            priority
          );

          // Set pickup to specified status
          pickup.status = pickupStatus;
          if (['assigned', 'en_route', 'arrived', 'in_progress', 'completed'].includes(pickupStatus)) {
            pickup.assignedCollectorId = collector._id;
          }
          if (pickupStatus === 'completed') {
            pickup.completedAt = new Date();
          }
          await pickup.save();

          // Establish WebSocket connection for citizen
          await establishWebSocketConnection(citizen._id, pickup._id);

          // Attempt to send location update
          await sendCollectorLocationUpdate(
            collector._id,
            pickup._id,
            locationData,
            new Date()
          );

          // Verify location update behavior based on status
          const citizenUpdates = locationUpdates.get(pickup._id.toString()) || [];

          if (pickupStatus === 'en_route') {
            // Should receive location updates
            expect(citizenUpdates.length).toBeGreaterThan(0);
            expect(citizenUpdates[0].location.lat).toBe(locationData.lat);
            expect(citizenUpdates[0].location.lng).toBe(locationData.lng);
          } else {
            // Should not receive location updates
            expect(citizenUpdates).toHaveLength(0);
          }
        }
      ),
      { numRuns: 12, timeout: 30000 }
    );
  });

  /**
   * Property: Location accuracy and data integrity
   * For any location update, the data should be preserved accurately and include required metadata
   */
  test('Property: Location updates preserve data accuracy and include required metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen, 
        wasteLogGen, 
        priorityGen,
        locationUpdateGen,
        async (userData, wasteLogData, priority, locationData) => {
          // Create users
          const citizen = new User({
            email: userData.email,
            password: 'hashedpassword123',
            role: 'citizen',
            profile: {
              firstName: userData.firstName,
              lastName: userData.lastName,
              addresses: [{
                street: userData.address.street,
                city: userData.address.city,
                zipCode: userData.address.zipCode,
                coordinates: {
                  type: 'Point',
                  coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
                },
                isDefault: true
              }],
              preferences: {
                notifications: { pickup: true, rewards: true, challenges: true },
                privacy: { showInLeaderboard: true, shareImpactData: true }
              }
            }
          });
          await citizen.save();

          const collector = new User({
            email: `collector_${userData.email}`,
            password: 'hashedpassword123',
            role: 'collector',
            profile: {
              firstName: 'Test',
              lastName: 'Collector',
              addresses: [{
                street: userData.address.street,
                city: userData.address.city,
                zipCode: userData.address.zipCode,
                coordinates: {
                  type: 'Point',
                  coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
                },
                isDefault: true
              }],
              preferences: {
                notifications: { pickup: true, rewards: true, challenges: true },
                privacy: { showInLeaderboard: true, shareImpactData: true }
              }
            }
          });
          await collector.save();

          // Create waste log and pickup request
          const wasteLog = new WasteLog({
            citizenId: citizen._id,
            wasteType: wasteLogData.wasteType,
            weight: wasteLogData.weight,
            location: {
              addressId: citizen.profile.addresses[0]._id,
              coordinates: {
                type: 'Point',
                coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
              }
            },
            ecoPointsEarned: 10,
            status: 'pending'
          });
          await wasteLog.save();

          const pickup = await createPickupRequest(
            citizen._id,
            [wasteLog._id],
            citizen.profile.addresses[0],
            priority
          );

          // Set pickup to en_route status
          pickup.status = 'en_route';
          pickup.assignedCollectorId = collector._id;
          await pickup.save();

          // Establish WebSocket connection
          await establishWebSocketConnection(citizen._id, pickup._id);

          const updateTime = new Date();

          // Send location update
          await sendCollectorLocationUpdate(
            collector._id,
            pickup._id,
            locationData,
            updateTime
          );

          // Verify location data integrity
          const citizenUpdates = locationUpdates.get(pickup._id.toString()) || [];
          expect(citizenUpdates).toHaveLength(1);

          const update = citizenUpdates[0];

          // Verify required fields are present
          expect(update.collectorId).toBe(collector._id.toString());
          expect(update.pickupId).toBe(pickup._id.toString());
          expect(update.citizenId).toBe(citizen._id.toString());
          expect(update.timestamp).toBeInstanceOf(Date);
          expect(update.deliveredAt).toBeInstanceOf(Date);

          // Verify location data accuracy
          expect(update.location.lat).toBe(locationData.lat);
          expect(update.location.lng).toBe(locationData.lng);
          expect(update.location.accuracy).toBe(locationData.accuracy);

          // Verify optional fields
          if (locationData.speed !== undefined) {
            expect(update.location.speed).toBe(locationData.speed);
          }
          if (locationData.heading !== undefined) {
            expect(update.location.heading).toBe(locationData.heading);
          }

          // Verify coordinate validity
          expect(update.location.lat).toBeGreaterThanOrEqual(-90);
          expect(update.location.lat).toBeLessThanOrEqual(90);
          expect(update.location.lng).toBeGreaterThanOrEqual(-180);
          expect(update.location.lng).toBeLessThanOrEqual(180);
          expect(update.location.accuracy).toBeGreaterThan(0);
        }
      ),
      { numRuns: 25, timeout: 30000 }
    );
  });

  /**
   * Property: Multiple citizens can track the same collector
   * For any pickup with multiple interested parties, all should receive location updates
   */
  test('Property: Multiple citizens can track the same collector simultaneously', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(userGen, { minLength: 2, maxLength: 5 }),
        wasteLogGen,
        priorityGen,
        locationUpdateGen,
        async (citizensData, wasteLogData, priority, locationData) => {
          // Create multiple citizen users
          const citizens = [];
          for (let i = 0; i < citizensData.length; i++) {
            const userData = citizensData[i];
            const citizen = new User({
              email: `citizen_${i}_${userData.email}`,
              password: 'hashedpassword123',
              role: 'citizen',
              profile: {
                firstName: userData.firstName,
                lastName: userData.lastName,
                addresses: [{
                  street: userData.address.street,
                  city: userData.address.city,
                  zipCode: userData.address.zipCode,
                  coordinates: {
                    type: 'Point',
                    coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
                  },
                  isDefault: true
                }],
                preferences: {
                  notifications: { pickup: true, rewards: true, challenges: true },
                  privacy: { showInLeaderboard: true, shareImpactData: true }
                }
              }
            });
            await citizen.save();
            citizens.push(citizen);
          }

          // Create collector
          const collector = new User({
            email: `collector_${citizensData[0].email}`,
            password: 'hashedpassword123',
            role: 'collector',
            profile: {
              firstName: 'Test',
              lastName: 'Collector',
              addresses: [{
                street: citizensData[0].address.street,
                city: citizensData[0].address.city,
                zipCode: citizensData[0].address.zipCode,
                coordinates: {
                  type: 'Point',
                  coordinates: [citizensData[0].address.coordinates.lng, citizensData[0].address.coordinates.lat]
                },
                isDefault: true
              }],
              preferences: {
                notifications: { pickup: true, rewards: true, challenges: true },
                privacy: { showInLeaderboard: true, shareImpactData: true }
              }
            }
          });
          await collector.save();

          // Create pickup requests for each citizen (same collector)
          const pickups = [];
          for (const citizen of citizens) {
            const wasteLog = new WasteLog({
              citizenId: citizen._id,
              wasteType: wasteLogData.wasteType,
              weight: wasteLogData.weight,
              location: {
                addressId: citizen.profile.addresses[0]._id,
                coordinates: {
                  type: 'Point',
                  coordinates: [citizen.profile.addresses[0].coordinates.coordinates[0], citizen.profile.addresses[0].coordinates.coordinates[1]]
                }
              },
              ecoPointsEarned: 10,
              status: 'pending'
            });
            await wasteLog.save();

            const pickup = await createPickupRequest(
              citizen._id,
              [wasteLog._id],
              citizen.profile.addresses[0],
              priority
            );

            pickup.status = 'en_route';
            pickup.assignedCollectorId = collector._id;
            await pickup.save();

            pickups.push(pickup);

            // Establish WebSocket connection for each citizen
            await establishWebSocketConnection(citizen._id, pickup._id);
          }

          // Send single location update from collector
          await sendCollectorLocationUpdate(
            collector._id,
            null, // Broadcast to all pickups for this collector
            locationData,
            new Date()
          );

          // Verify all citizens received the location update
          for (const pickup of pickups) {
            const citizenUpdates = locationUpdates.get(pickup._id.toString()) || [];
            expect(citizenUpdates).toHaveLength(1);

            const update = citizenUpdates[0];
            expect(update.collectorId).toBe(collector._id.toString());
            expect(update.location.lat).toBe(locationData.lat);
            expect(update.location.lng).toBe(locationData.lng);
          }
        }
      ),
      { numRuns: 7, timeout: 30000 }
    );
  });

  /**
   * Property: Location update frequency and throttling
   * For any rapid sequence of location updates, the system should handle them appropriately without overwhelming citizens
   */
  test('Property: Location updates are throttled appropriately for rapid updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen, 
        wasteLogGen, 
        priorityGen,
        fc.array(locationUpdateGen, { minLength: 10, maxLength: 20 }),
        async (userData, wasteLogData, priority, rapidLocationSequence) => {
          // Create users
          const citizen = new User({
            email: userData.email,
            password: 'hashedpassword123',
            role: 'citizen',
            profile: {
              firstName: userData.firstName,
              lastName: userData.lastName,
              addresses: [{
                street: userData.address.street,
                city: userData.address.city,
                zipCode: userData.address.zipCode,
                coordinates: {
                  type: 'Point',
                  coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
                },
                isDefault: true
              }],
              preferences: {
                notifications: { pickup: true, rewards: true, challenges: true },
                privacy: { showInLeaderboard: true, shareImpactData: true }
              }
            }
          });
          await citizen.save();

          const collector = new User({
            email: `collector_${userData.email}`,
            password: 'hashedpassword123',
            role: 'collector',
            profile: {
              firstName: 'Test',
              lastName: 'Collector',
              addresses: [{
                street: userData.address.street,
                city: userData.address.city,
                zipCode: userData.address.zipCode,
                coordinates: {
                  type: 'Point',
                  coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
                },
                isDefault: true
              }],
              preferences: {
                notifications: { pickup: true, rewards: true, challenges: true },
                privacy: { showInLeaderboard: true, shareImpactData: true }
              }
            }
          });
          await collector.save();

          // Create waste log and pickup request
          const wasteLog = new WasteLog({
            citizenId: citizen._id,
            wasteType: wasteLogData.wasteType,
            weight: wasteLogData.weight,
            location: {
              addressId: citizen.profile.addresses[0]._id,
              coordinates: {
                type: 'Point',
                coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
              }
            },
            ecoPointsEarned: 10,
            status: 'pending'
          });
          await wasteLog.save();

          const pickup = await createPickupRequest(
            citizen._id,
            [wasteLog._id],
            citizen.profile.addresses[0],
            priority
          );

          pickup.status = 'en_route';
          pickup.assignedCollectorId = collector._id;
          await pickup.save();

          await establishWebSocketConnection(citizen._id, pickup._id);

          // Send rapid location updates (every 10ms)
          const startTime = new Date();
          for (const locationData of rapidLocationSequence) {
            await sendCollectorLocationUpdate(
              collector._id,
              pickup._id,
              locationData,
              new Date()
            );
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          // Verify throttling behavior
          const citizenUpdates = locationUpdates.get(pickup._id.toString()) || [];
          
          // Should receive updates but not necessarily all of them (due to throttling)
          expect(citizenUpdates.length).toBeGreaterThan(0);
          expect(citizenUpdates.length).toBeLessThanOrEqual(rapidLocationSequence.length);

          // Verify minimum interval between delivered updates (e.g., max 1 update per second)
          if (citizenUpdates.length > 1) {
            for (let i = 1; i < citizenUpdates.length; i++) {
              const timeDiff = citizenUpdates[i].deliveredAt.getTime() - citizenUpdates[i - 1].deliveredAt.getTime();
              expect(timeDiff).toBeGreaterThanOrEqual(900); // At least 900ms between updates (allowing for some variance)
            }
          }

          // Verify the last update contains the most recent location
          const lastUpdate = citizenUpdates[citizenUpdates.length - 1];
          const lastLocation = rapidLocationSequence[rapidLocationSequence.length - 1];
          expect(lastUpdate.location.lat).toBe(lastLocation.lat);
          expect(lastUpdate.location.lng).toBe(lastLocation.lng);
        }
      ),
      { numRuns: 5, timeout: 30000 }
    );
  });
});

/**
 * Creates a pickup request
 */
async function createPickupRequest(citizenId, wasteLogIds, address, priority) {
  const wasteLogs = await WasteLog.find({ _id: { $in: wasteLogIds } });
  const estimatedWeight = wasteLogs.reduce((sum, log) => sum + log.weight, 0);

  const pickup = new Pickup({
    citizenId,
    wasteLogIds,
    address: {
      street: address.street,
      city: address.city,
      zipCode: address.zipCode,
      coordinates: {
        type: 'Point',
        coordinates: address.coordinates.coordinates || [address.coordinates.lng, address.coordinates.lat]
      }
    },
    priority,
    status: 'pending',
    qrCode: generateUUID(),
    estimatedWeight,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await pickup.save();
  return pickup;
}

/**
 * Establishes a WebSocket connection for location tracking
 */
async function establishWebSocketConnection(citizenId, pickupId) {
  webSocketConnections.set(citizenId.toString(), {
    pickupId: pickupId.toString(),
    connectedAt: new Date(),
    isActive: true
  });
}

/**
 * Sends collector location update to citizens
 */
async function sendCollectorLocationUpdate(collectorId, pickupId, locationData, timestamp) {
  // Find relevant pickups to update
  let pickupsToUpdate = [];
  
  if (pickupId) {
    // Update specific pickup
    const pickup = await Pickup.findById(pickupId);
    if (pickup && pickup.status === 'en_route' && pickup.assignedCollectorId?.toString() === collectorId.toString()) {
      pickupsToUpdate.push(pickup);
    }
  } else {
    // Broadcast to all en_route pickups for this collector
    pickupsToUpdate = await Pickup.find({
      assignedCollectorId: collectorId,
      status: 'en_route'
    });
  }

  // Send location updates to citizens
  for (const pickup of pickupsToUpdate) {
    const connection = webSocketConnections.get(pickup.citizenId.toString());
    if (connection && connection.isActive) {
      // Apply throttling (max 1 update per second per pickup)
      const existingUpdates = locationUpdates.get(pickup._id.toString()) || [];
      const lastUpdate = existingUpdates[existingUpdates.length - 1];
      
      if (!lastUpdate || (timestamp.getTime() - lastUpdate.deliveredAt.getTime()) >= 1000) {
        const locationUpdate = {
          collectorId: collectorId.toString(),
          pickupId: pickup._id.toString(),
          citizenId: pickup.citizenId.toString(),
          location: {
            lat: locationData.lat,
            lng: locationData.lng,
            accuracy: locationData.accuracy,
            speed: locationData.speed,
            heading: locationData.heading
          },
          timestamp: timestamp,
          deliveredAt: new Date()
        };

        if (!locationUpdates.has(pickup._id.toString())) {
          locationUpdates.set(pickup._id.toString(), []);
        }
        locationUpdates.get(pickup._id.toString()).push(locationUpdate);
      }
    }
  }
}

/**
 * Generates a UUID for QR codes
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}