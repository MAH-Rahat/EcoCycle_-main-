import fc from 'fast-check';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Pickup from '../models/Pickup.js';
import PickupStatusHistory from '../models/PickupStatusHistory.js';
import WasteLog from '../models/Waste.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';

// Feature: ecocycle-platform, Property 15: Pickup Status Management

describe('Pickup Status Management Property Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
    }
  });

  beforeEach(async () => {
    // Clear all collections
    await User.deleteMany({});
    await Pickup.deleteMany({});
    await PickupStatusHistory.deleteMany({});
    await WasteLog.deleteMany({});
    await WasteTypeConfig.deleteMany({});

    // Clear notification tracking
    notificationsSent.clear();

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

  // Mock notification tracking
  const notificationsSent = new Map();

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

  // Valid status transitions based on pickup workflow
  const statusTransitionsGen = fc.constantFrom(
    ['pending', 'assigned'],
    ['assigned', 'en_route'],
    ['en_route', 'arrived'],
    ['arrived', 'in_progress'],
    ['in_progress', 'completed'],
    ['pending', 'cancelled'],
    ['assigned', 'cancelled'],
    ['en_route', 'cancelled']
  );

  // Invalid status transitions
  const invalidStatusTransitionsGen = fc.constantFrom(
    ['completed', 'pending'],
    ['completed', 'assigned'],
    ['cancelled', 'pending'],
    ['cancelled', 'assigned'],
    ['pending', 'completed'], // Skip intermediate steps
    ['assigned', 'completed'], // Skip intermediate steps
    ['arrived', 'assigned'], // Backward transition
    ['in_progress', 'en_route'] // Backward transition
  );

  /**
   * Property 15: Pickup Status Management
   * For any pickup status change, the status should be updated correctly and citizens should be notified appropriately
   * **Validates: Requirements 4.1, 4.3, 4.5**
   */
  test('Property 15: Valid status transitions are processed correctly with notifications', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen, 
        wasteLogGen, 
        priorityGen,
        statusTransitionsGen,
        async (userData, wasteLogData, priority, [fromStatus, toStatus]) => {
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

          // Set initial status
          pickup.status = fromStatus;
          if (fromStatus === 'assigned') {
            pickup.assignedCollectorId = collector._id;
          }
          await pickup.save();

          // Clear previous notifications
          notificationsSent.clear();

          // Record time before status change
          const beforeTime = new Date();

          // Perform status transition
          const updatedPickup = await updatePickupStatus(
            pickup._id,
            toStatus,
            collector._id,
            'Status updated via property test'
          );

          const afterTime = new Date();

          // Verify status was updated correctly
          expect(updatedPickup.status).toBe(toStatus);
          expect(updatedPickup.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
          expect(updatedPickup.updatedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());

          // Verify status history was recorded
          const statusHistory = await PickupStatusHistory.find({ pickupId: pickup._id }).sort({ createdAt: 1 });
          expect(statusHistory.length).toBeGreaterThan(0);
          
          const latestHistory = statusHistory[statusHistory.length - 1];
          expect(latestHistory.fromStatus).toBe(fromStatus);
          expect(latestHistory.toStatus).toBe(toStatus);
          expect(latestHistory.changedBy.toString()).toBe(collector._id.toString());
          expect(latestHistory.reason).toBe('Status updated via property test');

          // Verify citizen notification was sent
          const citizenNotifications = notificationsSent.get(citizen._id.toString()) || [];
          const statusNotification = citizenNotifications.find(n => 
            n.type === 'pickup_status_updated' && 
            n.pickupId === pickup._id.toString()
          );
          
          expect(statusNotification).toBeDefined();
          expect(statusNotification.fromStatus).toBe(fromStatus);
          expect(statusNotification.toStatus).toBe(toStatus);
          expect(statusNotification.sentAt).toBeInstanceOf(Date);
          expect(statusNotification.sentAt.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 10000); // Within 10 seconds

          // Verify collector notification for assignment
          if (toStatus === 'assigned') {
            const collectorNotifications = notificationsSent.get(collector._id.toString()) || [];
            const assignmentNotification = collectorNotifications.find(n => 
              n.type === 'pickup_assigned' && 
              n.pickupId === pickup._id.toString()
            );
            
            expect(assignmentNotification).toBeDefined();
          }

          // Verify completion handling
          if (toStatus === 'completed') {
            expect(updatedPickup.completedAt).toBeInstanceOf(Date);
            expect(updatedPickup.completedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
          }
        }
      ),
      { numRuns: 25, timeout: 30000 }
    );
  });

  /**
   * Property: Invalid status transitions are rejected
   * For any invalid status transition, the system should reject the change and maintain current status
   */
  test('Property: Invalid status transitions are rejected with appropriate errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen, 
        wasteLogGen, 
        priorityGen,
        invalidStatusTransitionsGen,
        async (userData, wasteLogData, priority, [fromStatus, toStatus]) => {
          // Create citizen and collector users
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

          // Set initial status
          pickup.status = fromStatus;
          if (fromStatus === 'assigned' || fromStatus === 'completed') {
            pickup.assignedCollectorId = collector._id;
          }
          if (fromStatus === 'completed') {
            pickup.completedAt = new Date();
          }
          await pickup.save();

          const originalUpdatedAt = pickup.updatedAt;

          // Attempt invalid status transition
          let errorThrown = false;
          try {
            await updatePickupStatus(
              pickup._id,
              toStatus,
              collector._id,
              'Invalid transition attempt'
            );
          } catch (error) {
            errorThrown = true;
            expect(error.message.toLowerCase()).toMatch(/invalid|transition|status|not allowed/);
          }

          expect(errorThrown).toBe(true);

          // Verify status remained unchanged
          const unchangedPickup = await Pickup.findById(pickup._id);
          expect(unchangedPickup.status).toBe(fromStatus);
          expect(unchangedPickup.updatedAt.getTime()).toBe(originalUpdatedAt.getTime());

          // Verify no status history was created for invalid transition
          const statusHistory = await PickupStatusHistory.find({ 
            pickupId: pickup._id,
            toStatus: toStatus
          });
          expect(statusHistory).toHaveLength(0);
        }
      ),
      { numRuns: 12, timeout: 30000 }
    );
  });

  /**
   * Property: Status history maintains complete audit trail
   * For any sequence of status changes, complete history should be maintained
   */
  test('Property: Status history maintains complete audit trail', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen, 
        wasteLogGen, 
        priorityGen,
        async (userData, wasteLogData, priority) => {
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

          // Perform complete workflow: pending -> assigned -> en_route -> arrived -> in_progress -> completed
          const statusSequence = [
            { status: 'assigned', reason: 'Assigned to collector' },
            { status: 'en_route', reason: 'Collector en route' },
            { status: 'arrived', reason: 'Collector arrived' },
            { status: 'in_progress', reason: 'Collection in progress' },
            { status: 'completed', reason: 'Collection completed' }
          ];

          let previousStatus = 'pending';
          
          for (const { status, reason } of statusSequence) {
            await updatePickupStatus(pickup._id, status, collector._id, reason);
            
            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 1));
            
            previousStatus = status;
          }

          // Verify complete status history
          const statusHistory = await PickupStatusHistory.find({ pickupId: pickup._id }).sort({ createdAt: 1 });
          expect(statusHistory).toHaveLength(statusSequence.length);

          // Verify each transition is recorded correctly
          let expectedFromStatus = 'pending';
          for (let i = 0; i < statusHistory.length; i++) {
            const history = statusHistory[i];
            const expected = statusSequence[i];
            
            expect(history.fromStatus).toBe(expectedFromStatus);
            expect(history.toStatus).toBe(expected.status);
            expect(history.changedBy.toString()).toBe(collector._id.toString());
            expect(history.reason).toBe(expected.reason);
            expect(history.createdAt).toBeInstanceOf(Date);
            
            // Verify chronological order
            if (i > 0) {
              expect(history.createdAt.getTime()).toBeGreaterThan(statusHistory[i - 1].createdAt.getTime());
            }
            
            expectedFromStatus = expected.status;
          }

          // Verify final pickup state
          const finalPickup = await Pickup.findById(pickup._id);
          expect(finalPickup.status).toBe('completed');
          expect(finalPickup.completedAt).toBeInstanceOf(Date);
          expect(finalPickup.assignedCollectorId.toString()).toBe(collector._id.toString());
        }
      ),
      { numRuns: 7, timeout: 30000 }
    );
  });

  /**
   * Property: Concurrent status updates are handled correctly
   * For any concurrent status update attempts, only one should succeed and maintain consistency
   */
  test('Property: Concurrent status updates maintain consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen, 
        wasteLogGen, 
        priorityGen,
        async (userData, wasteLogData, priority) => {
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

          const collector1 = new User({
            email: `collector1_${userData.email}`,
            password: 'hashedpassword123',
            role: 'collector',
            profile: {
              firstName: 'Collector',
              lastName: 'One',
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
          await collector1.save();

          const collector2 = new User({
            email: `collector2_${userData.email}`,
            password: 'hashedpassword123',
            role: 'collector',
            profile: {
              firstName: 'Collector',
              lastName: 'Two',
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
          await collector2.save();

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

          // Attempt concurrent status updates (both collectors trying to assign)
          const updatePromises = [
            updatePickupStatus(pickup._id, 'assigned', collector1._id, 'Assigned by collector 1').catch(e => ({ error: e.message })),
            updatePickupStatus(pickup._id, 'assigned', collector2._id, 'Assigned by collector 2').catch(e => ({ error: e.message }))
          ];

          const results = await Promise.all(updatePromises);

          // Verify only one update succeeded
          const successfulUpdates = results.filter(r => !r.error);
          const failedUpdates = results.filter(r => r.error);

          expect(successfulUpdates).toHaveLength(1);
          expect(failedUpdates).toHaveLength(1);

          // Verify final state consistency
          const finalPickup = await Pickup.findById(pickup._id);
          expect(finalPickup.status).toBe('assigned');
          expect(finalPickup.assignedCollectorId).toBeDefined();

          // Verify only one status history entry was created
          const statusHistory = await PickupStatusHistory.find({ 
            pickupId: pickup._id,
            toStatus: 'assigned'
          });
          expect(statusHistory).toHaveLength(1);

          // Verify the assigned collector matches the successful update
          const successfulUpdate = successfulUpdates[0];
          expect(finalPickup.assignedCollectorId.toString()).toBe(successfulUpdate.assignedCollectorId.toString());
        }
      ),
      { numRuns: 5, timeout: 30000 }
    );
  });

  /**
   * Property: Status update timing meets requirements
   * For any status update, citizens should be notified within 10 seconds
   */
  test('Property: Status updates notify citizens within 10 seconds', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen, 
        wasteLogGen, 
        priorityGen,
        fc.constantFrom('assigned', 'en_route', 'arrived', 'in_progress', 'completed'),
        async (userData, wasteLogData, priority, newStatus) => {
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

          // Set appropriate initial status for the transition
          let initialStatus = 'pending';
          if (newStatus === 'en_route') initialStatus = 'assigned';
          else if (newStatus === 'arrived') initialStatus = 'en_route';
          else if (newStatus === 'in_progress') initialStatus = 'arrived';
          else if (newStatus === 'completed') initialStatus = 'in_progress';

          if (initialStatus !== 'pending') {
            pickup.status = initialStatus;
            pickup.assignedCollectorId = collector._id;
            await pickup.save();
          }

          // Clear notifications and record time
          notificationsSent.clear();
          const beforeTime = new Date();

          // Perform status update
          await updatePickupStatus(pickup._id, newStatus, collector._id, 'Status update timing test');

          // Verify notification timing
          const citizenNotifications = notificationsSent.get(citizen._id.toString()) || [];
          const statusNotification = citizenNotifications.find(n => 
            n.type === 'pickup_status_updated' && 
            n.pickupId === pickup._id.toString()
          );

          expect(statusNotification).toBeDefined();
          expect(statusNotification.sentAt).toBeInstanceOf(Date);

          // Verify notification was sent within 10 seconds (requirement: within 10 seconds)
          const notificationDelay = statusNotification.sentAt.getTime() - beforeTime.getTime();
          expect(notificationDelay).toBeLessThan(10000); // 10 seconds
          expect(statusNotification.sentAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        }
      ),
      { numRuns: 12, timeout: 30000 }
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
 * Updates pickup status with validation and notifications
 */
async function updatePickupStatus(pickupId, newStatus, changedBy, reason) {
  const pickup = await Pickup.findById(pickupId);
  if (!pickup) throw new Error('Pickup not found');

  const oldStatus = pickup.status;

  // Validate status transition
  if (!isValidStatusTransition(oldStatus, newStatus)) {
    throw new Error(`Invalid status transition from ${oldStatus} to ${newStatus}`);
  }

  // Check for concurrent updates (simple version using updatedAt)
  const currentPickup = await Pickup.findById(pickupId);
  if (currentPickup.updatedAt.getTime() !== pickup.updatedAt.getTime()) {
    throw new Error('Concurrent update detected');
  }

  // Update pickup status
  pickup.status = newStatus;
  pickup.updatedAt = new Date();

  if (newStatus === 'assigned' && !pickup.assignedCollectorId) {
    pickup.assignedCollectorId = changedBy;
  }

  if (newStatus === 'completed') {
    pickup.completedAt = new Date();
  }

  await pickup.save();

  // Record status history
  const statusHistory = new PickupStatusHistory({
    pickupId: pickup._id,
    fromStatus: oldStatus,
    toStatus: newStatus,
    changedBy,
    reason,
    createdAt: new Date()
  });
  await statusHistory.save();

  // Send notifications
  await sendStatusUpdateNotification(pickup, oldStatus, newStatus);

  return pickup;
}

/**
 * Validates if a status transition is allowed
 */
function isValidStatusTransition(fromStatus, toStatus) {
  const validTransitions = {
    'pending': ['assigned', 'cancelled'],
    'assigned': ['en_route', 'cancelled'],
    'en_route': ['arrived', 'cancelled'],
    'arrived': ['in_progress'],
    'in_progress': ['completed'],
    'completed': [], // Terminal state
    'cancelled': []  // Terminal state
  };

  return validTransitions[fromStatus]?.includes(toStatus) || false;
}

/**
 * Sends status update notifications
 */
async function sendStatusUpdateNotification(pickup, fromStatus, toStatus) {
  // Notify citizen
  await sendNotification(pickup.citizenId, 'pickup_status_updated', {
    pickupId: pickup._id.toString(),
    fromStatus,
    toStatus,
    message: `Your pickup status has been updated from ${fromStatus} to ${toStatus}`
  });

  // Notify collector on assignment
  if (toStatus === 'assigned' && pickup.assignedCollectorId) {
    await sendNotification(pickup.assignedCollectorId, 'pickup_assigned', {
      pickupId: pickup._id.toString(),
      citizenId: pickup.citizenId.toString(),
      message: 'You have been assigned a new pickup request'
    });
  }
}

/**
 * Sends a notification to a user
 */
async function sendNotification(userId, type, data) {
  const user = await User.findById(userId);
  if (!user) return;

  // Check notification preferences
  const preferences = user.profile.preferences.notifications;
  if (type.includes('pickup') && !preferences.pickup) {
    return;
  }

  // Create notification record
  const notification = {
    recipientId: userId.toString(),
    type,
    sentAt: new Date(),
    ...data
  };

  // Store notification
  if (!notificationsSent.has(userId.toString())) {
    notificationsSent.set(userId.toString(), []);
  }
  notificationsSent.get(userId.toString()).push(notification);
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