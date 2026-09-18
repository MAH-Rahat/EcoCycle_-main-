import fc from 'fast-check';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Pickup from '../models/Pickup.js';
import WasteLog from '../models/Waste.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';

// Feature: ecocycle-platform, Property 14: Pickup Request Notifications

describe('Pickup Request Notifications Property Tests', () => {
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

  // Generator for notification preferences
  const notificationPreferencesGen = fc.record({
    pickup: fc.boolean(),
    rewards: fc.boolean(),
    challenges: fc.boolean()
  });

  // Generator for scheduled time (business days: Sunday-Thursday, 8 AM - 6 PM)
  const scheduledTimeGen = fc.date({ 
    min: new Date(Date.now() + 60000), 
    max: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
  }).map(date => {
    const adjustedDate = new Date(date);
    const dayOfWeek = adjustedDate.getDay();
    
    // Adjust to business days (Sunday-Thursday)
    if (dayOfWeek === 5) { // Friday
      adjustedDate.setDate(adjustedDate.getDate() + 2);
    } else if (dayOfWeek === 6) { // Saturday
      adjustedDate.setDate(adjustedDate.getDate() + 1);
    }
    
    // Set to business hours (8 AM - 6 PM)
    const hour = 8 + Math.floor(Math.random() * 10);
    adjustedDate.setHours(hour, 0, 0, 0);
    
    return adjustedDate;
  });

  /**
   * Property 14: Pickup Request Notifications
   * For any pickup request creation or modification, appropriate notifications should be sent to all relevant parties
   * **Validates: Requirements 3.4, 3.5**
   */
  test('Property 14: Pickup request creation sends notifications to citizens with correct preferences', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen, 
        wasteLogGen, 
        priorityGen,
        notificationPreferencesGen,
        fc.option(scheduledTimeGen, { nil: undefined }),
        async (userData, wasteLogData, priority, notificationPrefs, scheduledTime) => {
          // Create a citizen user with notification preferences
          const user = new User({
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
                notifications: notificationPrefs,
                privacy: {
                  showInLeaderboard: true,
                  shareImpactData: true
                }
              }
            }
          });
          await user.save();

          // Create waste log
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

          // Create pickup request with notifications
          const pickup = await createPickupRequestWithNotifications(
            user._id,
            [wasteLog._id],
            user.profile.addresses[0],
            priority,
            scheduledTime
          );

          // Verify pickup was created
          expect(pickup).toBeDefined();
          expect(pickup.citizenId.toString()).toBe(user._id.toString());

          // Check notification behavior based on user preferences
          const userNotifications = notificationsSent.get(user._id.toString()) || [];

          if (notificationPrefs.pickup) {
            // User has pickup notifications enabled - should receive notification
            expect(userNotifications.length).toBeGreaterThan(0);
            
            const pickupNotification = userNotifications.find(n => 
              n.type === 'pickup_request_created' && 
              n.pickupId === pickup._id.toString()
            );
            
            expect(pickupNotification).toBeDefined();
            expect(pickupNotification.recipientId).toBe(user._id.toString());
            expect(pickupNotification.message).toContain('pickup request');
            expect(pickupNotification.priority).toBe(priority);
            
            if (scheduledTime) {
              expect(pickupNotification.message).toContain('scheduled');
              expect(pickupNotification.scheduledTime).toBeDefined();
            } else {
              expect(pickupNotification.message).toContain('on-demand');
            }
          } else {
            // User has pickup notifications disabled - should not receive notification
            const pickupNotifications = userNotifications.filter(n => 
              n.type === 'pickup_request_created'
            );
            expect(pickupNotifications).toHaveLength(0);
          }
        }
      ),
      { numRuns: 25, timeout: 30000 }
    );
  });

  /**
   * Property: Pickup request modifications send appropriate update notifications
   * For any pickup request status change, notifications should be sent based on the change type
   */
  test('Property: Pickup request status changes send appropriate notifications', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen,
        wasteLogGen,
        fc.constantFrom('assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled'),
        notificationPreferencesGen,
        async (userData, wasteLogData, newStatus, notificationPrefs) => {
          // Create citizen user
          const user = new User({
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
                notifications: notificationPrefs,
                privacy: {
                  showInLeaderboard: true,
                  shareImpactData: true
                }
              }
            }
          });
          await user.save();

          // Create collector user (for assignment notifications)
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

          const pickup = await createPickupRequestWithNotifications(
            user._id,
            [wasteLog._id],
            user.profile.addresses[0],
            'medium'
          );

          // Clear previous notifications
          notificationsSent.clear();

          // Update pickup status with notifications
          await updatePickupStatusWithNotifications(
            pickup._id,
            newStatus,
            collector._id
          );

          // Verify notifications based on status change and user preferences
          const userNotifications = notificationsSent.get(user._id.toString()) || [];
          const collectorNotifications = notificationsSent.get(collector._id.toString()) || [];

          if (notificationPrefs.pickup) {
            // User should receive status update notification
            const statusNotification = userNotifications.find(n => 
              n.type === 'pickup_status_updated' && 
              n.pickupId === pickup._id.toString()
            );
            
            expect(statusNotification).toBeDefined();
            expect(statusNotification.newStatus).toBe(newStatus);
            expect(statusNotification.recipientId).toBe(user._id.toString());
          }

          // Collector should receive assignment notification if status is 'assigned'
          if (newStatus === 'assigned') {
            const assignmentNotification = collectorNotifications.find(n => 
              n.type === 'pickup_assigned' && 
              n.pickupId === pickup._id.toString()
            );
            
            expect(assignmentNotification).toBeDefined();
            expect(assignmentNotification.recipientId).toBe(collector._id.toString());
          }

          // Verify notification timing (should be sent within reasonable time)
          const allNotifications = [...userNotifications, ...collectorNotifications];
          for (const notification of allNotifications) {
            expect(notification.sentAt).toBeInstanceOf(Date);
            expect(notification.sentAt.getTime()).toBeLessThanOrEqual(Date.now());
          }
        }
      ),
      { numRuns: 12, timeout: 30000 }
    );
  });

  /**
   * Property: Multiple users receive notifications correctly
   * For any pickup request in an area, nearby collectors should be notified appropriately
   */
  test('Property: Nearby collectors receive pickup notifications based on location', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen,
        wasteLogGen,
        fc.array(userGen, { minLength: 2, maxLength: 5 }),
        async (citizenData, wasteLogData, collectorsData) => {
          // Create citizen user
          const citizen = new User({
            email: citizenData.email,
            password: 'hashedpassword123',
            role: 'citizen',
            profile: {
              firstName: citizenData.firstName,
              lastName: citizenData.lastName,
              addresses: [{
                street: citizenData.address.street,
                city: citizenData.address.city,
                zipCode: citizenData.address.zipCode,
                coordinates: {
                  type: 'Point',
                  coordinates: [citizenData.address.coordinates.lng, citizenData.address.coordinates.lat]
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

          // Create collector users in the same area (same zip code)
          const collectors = [];
          for (let i = 0; i < collectorsData.length; i++) {
            const collectorData = collectorsData[i];
            const collector = new User({
              email: `collector_${i}_${collectorData.email}`,
              password: 'hashedpassword123',
              role: 'collector',
              profile: {
                firstName: collectorData.firstName,
                lastName: collectorData.lastName,
                addresses: [{
                  street: collectorData.address.street,
                  city: collectorData.address.city,
                  zipCode: citizenData.address.zipCode, // Same zip code as citizen
                  coordinates: {
                    type: 'Point',
                    coordinates: [
                      citizenData.address.coordinates.lng + (Math.random() - 0.5) * 0.01, // Nearby
                      citizenData.address.coordinates.lat + (Math.random() - 0.5) * 0.01
                    ]
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
            collectors.push(collector);
          }

          // Create waste log and pickup request
          const wasteLog = new WasteLog({
            citizenId: citizen._id,
            wasteType: wasteLogData.wasteType,
            weight: wasteLogData.weight,
            location: {
              addressId: citizen.profile.addresses[0]._id,
              coordinates: {
                type: 'Point',
                coordinates: [citizenData.address.coordinates.lng, citizenData.address.coordinates.lat]
              }
            },
            ecoPointsEarned: 10,
            status: 'pending'
          });
          await wasteLog.save();

          // Create pickup request with area notifications
          const pickup = await createPickupRequestWithAreaNotifications(
            citizen._id,
            [wasteLog._id],
            citizen.profile.addresses[0],
            'medium'
          );

          // Verify all nearby collectors received notifications
          for (const collector of collectors) {
            const collectorNotifications = notificationsSent.get(collector._id.toString()) || [];
            const pickupNotification = collectorNotifications.find(n => 
              n.type === 'pickup_available_nearby' && 
              n.pickupId === pickup._id.toString()
            );
            
            expect(pickupNotification).toBeDefined();
            expect(pickupNotification.recipientId).toBe(collector._id.toString());
            expect(pickupNotification.area).toBe(citizenData.address.zipCode);
            expect(pickupNotification.priority).toBe('medium');
          }

          // Verify citizen received confirmation notification
          const citizenNotifications = notificationsSent.get(citizen._id.toString()) || [];
          const confirmationNotification = citizenNotifications.find(n => 
            n.type === 'pickup_request_created' && 
            n.pickupId === pickup._id.toString()
          );
          
          expect(confirmationNotification).toBeDefined();
        }
      ),
      { numRuns: 7, timeout: 30000 }
    );
  });

  /**
   * Property: Notification delivery respects user preferences
   * For any notification type, delivery should respect individual user notification preferences
   */
  test('Property: Notifications respect individual user preferences', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ user: userGen, prefs: notificationPreferencesGen }), { minLength: 3, maxLength: 8 }),
        wasteLogGen,
        async (usersData, wasteLogData) => {
          const users = [];
          
          // Create users with different notification preferences
          for (let i = 0; i < usersData.length; i++) {
            const { user: userData, prefs } = usersData[i];
            const user = new User({
              email: `user_${i}_${userData.email}`,
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
                  notifications: prefs,
                  privacy: { showInLeaderboard: true, shareImpactData: true }
                }
              }
            });
            await user.save();
            users.push({ user, prefs });
          }

          // Create pickup request for first user
          const firstUser = users[0];
          const wasteLog = new WasteLog({
            citizenId: firstUser.user._id,
            wasteType: wasteLogData.wasteType,
            weight: wasteLogData.weight,
            location: {
              addressId: firstUser.user.profile.addresses[0]._id,
              coordinates: {
                type: 'Point',
                coordinates: [firstUser.user.profile.addresses[0].coordinates.coordinates[0], firstUser.user.profile.addresses[0].coordinates.coordinates[1]]
              }
            },
            ecoPointsEarned: 10,
            status: 'pending'
          });
          await wasteLog.save();

          const pickup = await createPickupRequestWithNotifications(
            firstUser.user._id,
            [wasteLog._id],
            firstUser.user.profile.addresses[0],
            'high'
          );

          // Send broadcast notification to all users (simulating area notification)
          await sendBroadcastNotification(
            users.map(u => u.user._id),
            'pickup_available_nearby',
            {
              pickupId: pickup._id.toString(),
              area: firstUser.user.profile.addresses[0].zipCode,
              priority: 'high'
            }
          );

          // Verify each user received notifications according to their preferences
          for (const { user, prefs } of users) {
            const userNotifications = notificationsSent.get(user._id.toString()) || [];
            const pickupNotifications = userNotifications.filter(n => 
              n.type === 'pickup_available_nearby' || n.type === 'pickup_request_created'
            );

            if (prefs.pickup) {
              // User has pickup notifications enabled
              expect(pickupNotifications.length).toBeGreaterThan(0);
              
              // Verify notification content
              for (const notification of pickupNotifications) {
                expect(notification.recipientId).toBe(user._id.toString());
                expect(['pickup_available_nearby', 'pickup_request_created']).toContain(notification.type);
              }
            } else {
              // User has pickup notifications disabled
              expect(pickupNotifications).toHaveLength(0);
            }
          }
        }
      ),
      { numRuns: 12, timeout: 30000 }
    );
  });

  /**
   * Property: Notification timing and delivery guarantees
   * For any notification, it should be delivered within specified time limits
   */
  test('Property: Notifications are delivered within time limits', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen,
        wasteLogGen,
        priorityGen,
        async (userData, wasteLogData, priority) => {
          // Create user
          const user = new User({
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
          await user.save();

          // Create waste log
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

          // Record time before pickup creation
          const beforeTime = new Date();

          // Create pickup request
          const pickup = await createPickupRequestWithNotifications(
            user._id,
            [wasteLog._id],
            user.profile.addresses[0],
            priority
          );

          const afterTime = new Date();

          // Verify notification timing
          const userNotifications = notificationsSent.get(user._id.toString()) || [];
          const pickupNotification = userNotifications.find(n => 
            n.type === 'pickup_request_created' && 
            n.pickupId === pickup._id.toString()
          );

          expect(pickupNotification).toBeDefined();
          expect(pickupNotification.sentAt).toBeInstanceOf(Date);
          
          // Notification should be sent within reasonable time (within 30 seconds as per requirements)
          const notificationDelay = pickupNotification.sentAt.getTime() - beforeTime.getTime();
          expect(notificationDelay).toBeLessThan(30000); // 30 seconds
          expect(pickupNotification.sentAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
          expect(pickupNotification.sentAt.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 1000); // Allow 1 second buffer
        }
      ),
      { numRuns: 12, timeout: 30000 }
    );
  });
});

/**
 * Creates a pickup request and sends appropriate notifications
 */
async function createPickupRequestWithNotifications(citizenId, wasteLogIds, address, priority, scheduledTime) {
  // Calculate estimated weight
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
    scheduledTime,
    priority,
    status: 'pending',
    qrCode,
    estimatedWeight,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await pickup.save();

  // Send notification to citizen
  await sendNotification(citizenId, 'pickup_request_created', {
    pickupId: pickup._id.toString(),
    priority,
    scheduledTime,
    message: scheduledTime ? 
      `Your scheduled pickup request has been created for ${scheduledTime.toLocaleString()}` :
      'Your on-demand pickup request has been created'
  });

  return pickup;
}

/**
 * Creates a pickup request and notifies nearby collectors
 */
async function createPickupRequestWithAreaNotifications(citizenId, wasteLogIds, address, priority) {
  const pickup = await createPickupRequestWithNotifications(citizenId, wasteLogIds, address, priority);

  // Find nearby collectors (same zip code)
  const nearbyCollectors = await User.find({
    role: 'collector',
    'profile.addresses.zipCode': address.zipCode
  });

  // Notify nearby collectors
  for (const collector of nearbyCollectors) {
    await sendNotification(collector._id, 'pickup_available_nearby', {
      pickupId: pickup._id.toString(),
      area: address.zipCode,
      priority,
      message: `New ${priority} priority pickup available in your area (${address.zipCode})`
    });
  }

  return pickup;
}

/**
 * Updates pickup status and sends notifications
 */
async function updatePickupStatusWithNotifications(pickupId, newStatus, collectorId) {
  const pickup = await Pickup.findById(pickupId);
  if (!pickup) throw new Error('Pickup not found');

  const oldStatus = pickup.status;
  pickup.status = newStatus;
  pickup.updatedAt = new Date();

  if (newStatus === 'assigned' && collectorId) {
    pickup.assignedCollectorId = collectorId;
  }

  await pickup.save();

  // Send status update notification to citizen
  await sendNotification(pickup.citizenId, 'pickup_status_updated', {
    pickupId: pickup._id.toString(),
    oldStatus,
    newStatus,
    message: `Your pickup request status has been updated to: ${newStatus}`
  });

  // Send assignment notification to collector
  if (newStatus === 'assigned' && collectorId) {
    await sendNotification(collectorId, 'pickup_assigned', {
      pickupId: pickup._id.toString(),
      citizenId: pickup.citizenId.toString(),
      message: `You have been assigned a new pickup request`
    });
  }

  return pickup;
}

/**
 * Sends a notification to a user (respects preferences)
 */
async function sendNotification(userId, type, data) {
  const user = await User.findById(userId);
  if (!user) return;

  // Check notification preferences
  const preferences = user.profile.preferences.notifications;
  
  // Only send pickup-related notifications if user has pickup notifications enabled
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

  // Store notification (in real system, this would be sent via push notification, email, etc.)
  if (!notificationsSent.has(userId.toString())) {
    notificationsSent.set(userId.toString(), []);
  }
  notificationsSent.get(userId.toString()).push(notification);
}

/**
 * Sends broadcast notification to multiple users
 */
async function sendBroadcastNotification(userIds, type, data) {
  for (const userId of userIds) {
    await sendNotification(userId, type, data);
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