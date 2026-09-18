import fc from 'fast-check';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Pickup from '../models/Pickup.js';
import WasteLog from '../models/Waste.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';

// Feature: ecocycle-platform, Property 13: Priority Queue Ordering

describe('Priority Queue Ordering Property Tests', () => {
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

  // Generator for pickup requests with different priorities
  const pickupRequestGen = fc.record({
    priority: priorityGen,
    notes: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
    wasteLog: wasteLogGen
  });

  /**
   * Property 13: Priority Queue Ordering
   * For any set of pickup requests with different priorities, the collector queue should maintain correct priority ordering
   * **Validates: Requirements 3.3**
   */
  test('Property 13: Pickup requests are ordered correctly by priority in the collector queue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ user: userGen, request: pickupRequestGen }), { minLength: 5, maxLength: 15 }),
        async (requestsData) => {
          const createdPickups = [];

          // Create users and pickup requests with various priorities
          for (const { user: userData, request: requestData } of requestsData) {
            // Create user
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

            // Create waste log
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
              requestData.priority,
              requestData.notes
            );

            createdPickups.push({
              pickup,
              priority: requestData.priority,
              createdAt: pickup.createdAt
            });

            // Small delay to ensure different creation times
            await new Promise(resolve => setTimeout(resolve, 1));
          }

          // Get the priority queue
          const orderedQueue = await getCollectorQueue();

          // Verify queue length matches created pickups
          expect(orderedQueue).toHaveLength(createdPickups.length);

          // Verify priority ordering
          const priorityValues = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
          
          for (let i = 0; i < orderedQueue.length - 1; i++) {
            const currentPriority = priorityValues[orderedQueue[i].priority];
            const nextPriority = priorityValues[orderedQueue[i + 1].priority];
            
            // Current pickup should have higher or equal priority than next
            if (currentPriority !== nextPriority) {
              expect(currentPriority).toBeGreaterThan(nextPriority);
            } else {
              // If same priority, should be ordered by creation time (FIFO)
              expect(orderedQueue[i].createdAt.getTime()).toBeLessThanOrEqual(orderedQueue[i + 1].createdAt.getTime());
            }
          }

          // Verify all created pickups are in the queue
          const queueIds = orderedQueue.map(p => p._id.toString());
          const createdIds = createdPickups.map(p => p.pickup._id.toString());
          
          for (const createdId of createdIds) {
            expect(queueIds).toContain(createdId);
          }
        }
      ),
      { numRuns: 25, timeout: 30000 }
    );
  });

  /**
   * Property: Priority queue maintains order when new requests are added
   * For any existing queue, adding new requests should maintain correct priority ordering
   */
  test('Property: Adding new requests maintains priority queue ordering', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ user: userGen, request: pickupRequestGen }), { minLength: 3, maxLength: 8 }),
        fc.array(fc.record({ user: userGen, request: pickupRequestGen }), { minLength: 2, maxLength: 5 }),
        async (initialRequestsData, newRequestsData) => {
          // Create initial batch of pickup requests
          const initialPickups = [];
          for (const { user: userData, request: requestData } of initialRequestsData) {
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

            const wasteLog = new WasteLog({
              citizenId: user._id,
              wasteType: requestData.wasteLog.wasteType,
              weight: requestData.wasteLog.weight,
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

            const pickup = await createPickupRequest(
              user._id,
              [wasteLog._id],
              user.profile.addresses[0],
              requestData.priority,
              requestData.notes
            );

            initialPickups.push(pickup);
            await new Promise(resolve => setTimeout(resolve, 1));
          }

          // Get initial queue state
          const initialQueue = await getCollectorQueue();
          expect(initialQueue).toHaveLength(initialPickups.length);

          // Add new requests
          const newPickups = [];
          for (const { user: userData, request: requestData } of newRequestsData) {
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

            const wasteLog = new WasteLog({
              citizenId: user._id,
              wasteType: requestData.wasteLog.wasteType,
              weight: requestData.wasteLog.weight,
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

            const pickup = await createPickupRequest(
              user._id,
              [wasteLog._id],
              user.profile.addresses[0],
              requestData.priority,
              requestData.notes
            );

            newPickups.push(pickup);
            await new Promise(resolve => setTimeout(resolve, 1));
          }

          // Get updated queue
          const updatedQueue = await getCollectorQueue();
          expect(updatedQueue).toHaveLength(initialPickups.length + newPickups.length);

          // Verify priority ordering is maintained
          const priorityValues = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
          
          for (let i = 0; i < updatedQueue.length - 1; i++) {
            const currentPriority = priorityValues[updatedQueue[i].priority];
            const nextPriority = priorityValues[updatedQueue[i + 1].priority];
            
            if (currentPriority !== nextPriority) {
              expect(currentPriority).toBeGreaterThan(nextPriority);
            } else {
              // Same priority should be ordered by creation time
              expect(updatedQueue[i].createdAt.getTime()).toBeLessThanOrEqual(updatedQueue[i + 1].createdAt.getTime());
            }
          }
        }
      ),
      { numRuns: 12, timeout: 30000 }
    );
  });

  /**
   * Property: Priority queue handles status changes correctly
   * For any pickup status change, the queue should update appropriately
   */
  test('Property: Queue updates correctly when pickup status changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ user: userGen, request: pickupRequestGen }), { minLength: 5, maxLength: 10 }),
        fc.constantFrom('assigned', 'en_route', 'completed', 'cancelled'),
        async (requestsData, newStatus) => {
          const createdPickups = [];

          // Create pickup requests
          for (const { user: userData, request: requestData } of requestsData) {
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

            const wasteLog = new WasteLog({
              citizenId: user._id,
              wasteType: requestData.wasteLog.wasteType,
              weight: requestData.wasteLog.weight,
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

            const pickup = await createPickupRequest(
              user._id,
              [wasteLog._id],
              user.profile.addresses[0],
              requestData.priority,
              requestData.notes
            );

            createdPickups.push(pickup);
          }

          // Get initial queue
          const initialQueue = await getCollectorQueue();
          expect(initialQueue).toHaveLength(createdPickups.length);

          // Change status of first pickup
          const pickupToUpdate = createdPickups[0];
          pickupToUpdate.status = newStatus;
          await pickupToUpdate.save();

          // Get updated queue
          const updatedQueue = await getCollectorQueue();

          // Verify queue behavior based on status change
          if (newStatus === 'completed' || newStatus === 'cancelled') {
            // Completed/cancelled pickups should be removed from active queue
            expect(updatedQueue).toHaveLength(createdPickups.length - 1);
            
            // Verify the updated pickup is not in the queue
            const queueIds = updatedQueue.map(p => p._id.toString());
            expect(queueIds).not.toContain(pickupToUpdate._id.toString());
          } else {
            // Other status changes should keep pickup in queue
            expect(updatedQueue).toHaveLength(createdPickups.length);
            
            // Verify the pickup is still in queue with updated status
            const updatedPickupInQueue = updatedQueue.find(p => p._id.toString() === pickupToUpdate._id.toString());
            expect(updatedPickupInQueue).toBeDefined();
            expect(updatedPickupInQueue.status).toBe(newStatus);
          }

          // Verify remaining queue maintains priority ordering
          const priorityValues = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
          
          for (let i = 0; i < updatedQueue.length - 1; i++) {
            const currentPriority = priorityValues[updatedQueue[i].priority];
            const nextPriority = priorityValues[updatedQueue[i + 1].priority];
            
            if (currentPriority !== nextPriority) {
              expect(currentPriority).toBeGreaterThan(nextPriority);
            }
          }
        }
      ),
      { numRuns: 12, timeout: 30000 }
    );
  });

  /**
   * Property: Priority queue handles concurrent operations correctly
   * For any concurrent pickup creation and status updates, queue ordering should remain consistent
   */
  test('Property: Queue maintains consistency during concurrent operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ user: userGen, request: pickupRequestGen }), { minLength: 4, maxLength: 8 }),
        async (requestsData) => {
          // Create users and waste logs first
          const usersAndLogs = [];
          for (const { user: userData, request: requestData } of requestsData) {
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

            const wasteLog = new WasteLog({
              citizenId: user._id,
              wasteType: requestData.wasteLog.wasteType,
              weight: requestData.wasteLog.weight,
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

            usersAndLogs.push({
              user,
              wasteLog,
              priority: requestData.priority,
              notes: requestData.notes
            });
          }

          // Create pickup requests concurrently
          const pickupPromises = usersAndLogs.map(({ user, wasteLog, priority, notes }) =>
            createPickupRequest(
              user._id,
              [wasteLog._id],
              user.profile.addresses[0],
              priority,
              notes
            )
          );

          const createdPickups = await Promise.all(pickupPromises);

          // Verify all pickups were created
          expect(createdPickups).toHaveLength(requestsData.length);

          // Get the queue
          const queue = await getCollectorQueue();
          expect(queue).toHaveLength(createdPickups.length);

          // Verify priority ordering
          const priorityValues = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
          
          for (let i = 0; i < queue.length - 1; i++) {
            const currentPriority = priorityValues[queue[i].priority];
            const nextPriority = priorityValues[queue[i + 1].priority];
            
            if (currentPriority !== nextPriority) {
              expect(currentPriority).toBeGreaterThan(nextPriority);
            }
          }

          // Verify all created pickups are in the queue
          const queueIds = queue.map(p => p._id.toString());
          const createdIds = createdPickups.map(p => p._id.toString());
          
          for (const createdId of createdIds) {
            expect(queueIds).toContain(createdId);
          }
        }
      ),
      { numRuns: 7, timeout: 30000 }
    );
  });

  /**
   * Property: Priority queue respects FIFO within same priority level
   * For any pickups with the same priority, they should be ordered by creation time (first in, first out)
   */
  test('Property: Same priority pickups are ordered by creation time (FIFO)', async () => {
    await fc.assert(
      fc.asyncProperty(
        priorityGen,
        fc.array(fc.record({ user: userGen, request: wasteLogGen }), { minLength: 3, maxLength: 8 }),
        async (samePriority, requestsData) => {
          const createdPickups = [];

          // Create pickup requests with the same priority but different creation times
          for (const { user: userData, request: wasteLogData } of requestsData) {
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

            const wasteLog = new WasteLog({
              citizenId: user._id,
              wasteType: wasteLogData.wasteType,
              weight: wasteLogData.weight,
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

            const pickup = await createPickupRequest(
              user._id,
              [wasteLog._id],
              user.profile.addresses[0],
              samePriority,
              undefined
            );

            createdPickups.push({
              pickup,
              createdAt: pickup.createdAt
            });

            // Ensure different creation times
            await new Promise(resolve => setTimeout(resolve, 2));
          }

          // Get the queue
          const queue = await getCollectorQueue();

          // Filter queue to only same priority pickups
          const samePriorityPickups = queue.filter(p => p.priority === samePriority);
          expect(samePriorityPickups.length).toBeGreaterThanOrEqual(createdPickups.length);

          // Verify FIFO ordering within same priority
          for (let i = 0; i < samePriorityPickups.length - 1; i++) {
            const current = samePriorityPickups[i];
            const next = samePriorityPickups[i + 1];
            
            if (current.priority === next.priority) {
              expect(current.createdAt.getTime()).toBeLessThanOrEqual(next.createdAt.getTime());
            }
          }

          // Verify all created pickups are in the correct order
          const createdIds = createdPickups.map(p => p.pickup._id.toString());
          const queueSamePriorityIds = samePriorityPickups.map(p => p._id.toString());
          
          // Find the positions of our created pickups in the queue
          const positions = createdIds.map(id => queueSamePriorityIds.indexOf(id)).filter(pos => pos !== -1);
          
          // Positions should be in ascending order (FIFO)
          for (let i = 0; i < positions.length - 1; i++) {
            expect(positions[i]).toBeLessThan(positions[i + 1]);
          }
        }
      ),
      { numRuns: 12, timeout: 30000 }
    );
  });
});

/**
 * Creates a pickup request with the specified priority
 */
async function createPickupRequest(citizenId, wasteLogIds, address, priority, notes) {
  // Calculate estimated weight from waste logs
  const wasteLogs = await WasteLog.find({ _id: { $in: wasteLogIds } });
  const estimatedWeight = wasteLogs.reduce((sum, log) => sum + log.weight, 0);

  // Generate unique QR code
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
    priority,
    status: 'pending',
    qrCode,
    estimatedWeight,
    notes,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await pickup.save();
  return pickup;
}

/**
 * Gets the collector queue ordered by priority and creation time
 */
async function getCollectorQueue() {
  const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
  
  // Get all pending pickups
  const pickups = await Pickup.find({ 
    status: { $in: ['pending', 'assigned', 'en_route'] }
  }).sort({ createdAt: 1 });
  
  // Sort by priority (highest first), then by creation time (FIFO within same priority)
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