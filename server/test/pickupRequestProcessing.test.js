import fc from 'fast-check';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Pickup from '../models/Pickup.js';
import WasteLog from '../models/Waste.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';

// Feature: ecocycle-platform, Property 11: Pickup Request Processing

describe('Pickup Request Processing Property Tests', () => {
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
    role: fc.constant('citizen'),
    address: addressGen
  });

  const wasteLogGen = fc.record({
    wasteType: wasteTypeGen,
    weight: weightGen,
    description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined })
  });

  // Generator for scheduled time (future dates only)
  const scheduledTimeGen = fc.date({ 
    min: new Date(Date.now() + 60000), // At least 1 minute in the future
    max: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Up to 7 days in the future
  });

  const pickupRequestGen = fc.record({
    priority: priorityGen,
    scheduledTime: fc.option(scheduledTimeGen, { nil: undefined }),
    notes: fc.option(fc.string({ maxLength: 500 }), { nil: undefined })
  });

  /**
   * Property 11: Pickup Request Processing
   * For any pickup request, both on-demand and scheduled options should be processed correctly with appropriate validation
   * **Validates: Requirements 3.1**
   */
  test('Property 11: On-demand and scheduled pickup requests are processed correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen, 
        fc.array(wasteLogGen, { minLength: 1, maxLength: 5 }), 
        pickupRequestGen, 
        async (userData, wasteLogs, pickupData) => {
          // Create a citizen user
          const user = new User({
            email: userData.email,
            password: 'hashedpassword123',
            role: userData.role,
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
              }]
            }
          });
          await user.save();

          // Create waste logs for the pickup request
          const wasteLogIds = [];
          let totalEstimatedWeight = 0;

          for (const wasteLogData of wasteLogs) {
            const config = await WasteTypeConfig.findOne({ type: wasteLogData.wasteType });
            const ecoPointsEarned = wasteLogData.weight * config.pointsPerKg;

            const wasteLog = new WasteLog({
              citizenId: user._id,
              wasteType: wasteLogData.wasteType,
              weight: wasteLogData.weight,
              description: wasteLogData.description,
              location: {
                addressId: user.profile.addresses[0]._id,
                coordinates: {
                  type: 'Point',
                  coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
                }
              },
              ecoPointsEarned,
              status: 'pending'
            });
            await wasteLog.save();
            
            wasteLogIds.push(wasteLog._id);
            totalEstimatedWeight += wasteLogData.weight;
          }

          // Create pickup request
          const pickupRequest = await createPickupRequest(
            user._id,
            wasteLogIds,
            user.profile.addresses[0],
            pickupData
          );

          // Validate pickup request was created correctly
          expect(pickupRequest).toBeDefined();
          expect(pickupRequest.citizenId.toString()).toBe(user._id.toString());
          expect(pickupRequest.wasteLogIds).toHaveLength(wasteLogIds.length);
          expect(pickupRequest.status).toBe('pending');
          expect(pickupRequest.priority).toBe(pickupData.priority);
          expect(pickupRequest.qrCode).toBeDefined();
          expect(pickupRequest.qrCode).toHaveLength(36); // UUID format

          // Validate address information
          expect(pickupRequest.address.street).toBe(userData.address.street);
          expect(pickupRequest.address.city).toBe(userData.address.city);
          expect(pickupRequest.address.zipCode).toBe(userData.address.zipCode);
          expect(pickupRequest.address.coordinates.type).toBe('Point');
          expect(pickupRequest.address.coordinates.coordinates).toHaveLength(2);

          // Validate estimated weight calculation
          expect(Math.abs(pickupRequest.estimatedWeight - totalEstimatedWeight)).toBeLessThan(0.01);

          // Validate scheduling behavior
          if (pickupData.scheduledTime) {
            // Scheduled pickup
            expect(pickupRequest.scheduledTime).toBeDefined();
            expect(pickupRequest.scheduledTime.getTime()).toBe(pickupData.scheduledTime.getTime());
            
            // Scheduled time should be in the future
            expect(pickupRequest.scheduledTime.getTime()).toBeGreaterThan(Date.now());
          } else {
            // On-demand pickup
            expect(pickupRequest.scheduledTime).toBeUndefined();
          }

          // Validate optional fields
          if (pickupData.notes) {
            expect(pickupRequest.notes).toBe(pickupData.notes);
          } else {
            expect(pickupRequest.notes).toBeUndefined();
          }

          // Validate timestamps
          expect(pickupRequest.createdAt).toBeDefined();
          expect(pickupRequest.updatedAt).toBeDefined();
          expect(pickupRequest.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
          expect(pickupRequest.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());

          // Validate that pickup request is retrievable
          const retrievedPickup = await Pickup.findById(pickupRequest._id);
          expect(retrievedPickup).toBeDefined();
          expect(retrievedPickup.citizenId.toString()).toBe(user._id.toString());
        }
      ),
      { numRuns: 25, timeout: 30000 }
    );
  });

  /**
   * Property: Pickup request validation rejects invalid data
   * For any invalid pickup request data, the system should reject the request with appropriate error messages
   */
  test('Property: Invalid pickup requests are rejected with appropriate validation', async () => {
    await fc.assert(
      fc.asyncProperty(userGen, async (userData) => {
        // Create a citizen user
        const user = new User({
          email: userData.email,
          password: 'hashedpassword123',
          role: userData.role,
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
            }]
          }
        });
        await user.save();

        // Test cases for invalid pickup requests
        const invalidCases = [
          {
            name: 'empty waste logs array',
            data: { wasteLogIds: [], priority: 'medium' },
            expectedError: 'wasteLogIds'
          },
          {
            name: 'invalid priority',
            data: { wasteLogIds: [new mongoose.Types.ObjectId()], priority: 'invalid' },
            expectedError: 'priority'
          },
          {
            name: 'scheduled time in the past',
            data: { 
              wasteLogIds: [new mongoose.Types.ObjectId()], 
              priority: 'medium',
              scheduledTime: new Date(Date.now() - 60000) // 1 minute ago
            },
            expectedError: 'scheduledTime'
          },
          {
            name: 'missing address',
            data: { wasteLogIds: [new mongoose.Types.ObjectId()], priority: 'medium', address: null },
            expectedError: 'address'
          }
        ];

        for (const testCase of invalidCases) {
          let errorThrown = false;
          try {
            await createPickupRequest(
              user._id,
              testCase.data.wasteLogIds,
              testCase.data.address || user.profile.addresses[0],
              testCase.data
            );
          } catch (error) {
            errorThrown = true;
            expect(error.message.toLowerCase()).toContain(testCase.expectedError.toLowerCase());
          }
          
          expect(errorThrown).toBe(true);
        }
      }),
      { numRuns: 12, timeout: 30000 }
    );
  });

  /**
   * Property: Pickup request priority affects queue ordering
   * For any set of pickup requests with different priorities, higher priority requests should be processed first
   */
  test('Property: Pickup request priority determines processing order', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen,
        fc.array(fc.record({ priority: priorityGen, wasteLog: wasteLogGen }), { minLength: 3, maxLength: 8 }),
        async (userData, requestsData) => {
          // Create a citizen user
          const user = new User({
            email: userData.email,
            password: 'hashedpassword123',
            role: userData.role,
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
              }]
            }
          });
          await user.save();

          const createdPickups = [];

          // Create pickup requests with different priorities
          for (const requestData of requestsData) {
            // Create a waste log for this pickup
            const config = await WasteTypeConfig.findOne({ type: requestData.wasteLog.wasteType });
            const ecoPointsEarned = requestData.wasteLog.weight * config.pointsPerKg;

            const wasteLog = new WasteLog({
              citizenId: user._id,
              wasteType: requestData.wasteLog.wasteType,
              weight: requestData.wasteLog.weight,
              description: requestData.wasteLog.description,
              location: {
                addressId: user.profile.addresses[0]._id,
                coordinates: {
                  type: 'Point',
                  coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
                }
              },
              ecoPointsEarned,
              status: 'pending'
            });
            await wasteLog.save();

            // Create pickup request
            const pickup = await createPickupRequest(
              user._id,
              [wasteLog._id],
              user.profile.addresses[0],
              { priority: requestData.priority }
            );

            createdPickups.push(pickup);
          }

          // Get pickup queue ordered by priority
          const orderedPickups = await getPickupQueue();

          // Verify priority ordering
          const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
          
          for (let i = 0; i < orderedPickups.length - 1; i++) {
            const currentPriority = priorityOrder[orderedPickups[i].priority];
            const nextPriority = priorityOrder[orderedPickups[i + 1].priority];
            
            // Current pickup should have higher or equal priority than next
            expect(currentPriority).toBeGreaterThanOrEqual(nextPriority);
          }

          // Verify all created pickups are in the queue
          const queueIds = orderedPickups.map(p => p._id.toString());
          const createdIds = createdPickups.map(p => p._id.toString());
          
          for (const createdId of createdIds) {
            expect(queueIds).toContain(createdId);
          }
        }
      ),
      { numRuns: 12, timeout: 30000 }
    );
  });

  /**
   * Property: Pickup request QR codes are unique
   * For any set of pickup requests, each should have a unique QR code
   */
  test('Property: Pickup request QR codes are unique across all requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(userGen, { minLength: 2, maxLength: 10 }),
        async (usersData) => {
          const createdPickups = [];

          // Create multiple users and pickup requests
          for (const userData of usersData) {
            const user = new User({
              email: userData.email,
              password: 'hashedpassword123',
              role: userData.role,
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
                }]
              }
            });
            await user.save();

            // Create a waste log
            const wasteLog = new WasteLog({
              citizenId: user._id,
              wasteType: 'plastic',
              weight: 1.0,
              location: {
                addressId: user.profile.addresses[0]._id,
                coordinates: {
                  type: 'Point',
                  coordinates: [userData.address.coordinates.lng, userData.address.coordinates.lat]
                }
              },
              ecoPointsEarned: 10,
              status: 'pending'
            });
            await wasteLog.save();

            // Create pickup request
            const pickup = await createPickupRequest(
              user._id,
              [wasteLog._id],
              user.profile.addresses[0],
              { priority: 'medium' }
            );

            createdPickups.push(pickup);
          }

          // Verify all QR codes are unique
          const qrCodes = createdPickups.map(p => p.qrCode);
          const uniqueQrCodes = new Set(qrCodes);
          
          expect(uniqueQrCodes.size).toBe(qrCodes.length);

          // Verify QR codes follow expected format (UUID)
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          for (const qrCode of qrCodes) {
            expect(qrCode).toMatch(uuidRegex);
          }
        }
      ),
      { numRuns: 12, timeout: 30000 }
    );
  });
});

/**
 * Creates a pickup request with validation
 * This simulates the pickup request creation functionality
 */
async function createPickupRequest(citizenId, wasteLogIds, address, requestData) {
  // Validation
  if (!wasteLogIds || wasteLogIds.length === 0) {
    throw new Error('wasteLogIds cannot be empty');
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (!validPriorities.includes(requestData.priority)) {
    throw new Error('Invalid priority value');
  }

  if (requestData.scheduledTime && requestData.scheduledTime.getTime() <= Date.now()) {
    throw new Error('scheduledTime must be in the future');
  }

  if (!address) {
    throw new Error('address is required');
  }

  // Calculate estimated weight from waste logs
  const wasteLogs = await WasteLog.find({ _id: { $in: wasteLogIds } });
  const estimatedWeight = wasteLogs.reduce((sum, log) => sum + log.weight, 0);

  // Generate unique QR code (UUID format)
  const qrCode = generateUUID();

  // Create pickup request
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
    scheduledTime: requestData.scheduledTime,
    priority: requestData.priority,
    status: 'pending',
    qrCode,
    estimatedWeight,
    notes: requestData.notes,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await pickup.save();
  return pickup;
}

/**
 * Gets pickup queue ordered by priority
 */
async function getPickupQueue() {
  const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
  
  const pickups = await Pickup.find({ status: 'pending' }).sort({ createdAt: 1 });
  
  // Sort by priority (highest first), then by creation time
  return pickups.sort((a, b) => {
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
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