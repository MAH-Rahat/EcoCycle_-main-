import fc from 'fast-check';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Pickup from '../models/Pickup.js';
import WasteLog from '../models/Waste.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';

// Feature: ecocycle-platform, Property 12: Scheduling Validation

describe('Scheduling Validation Property Tests', () => {
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

  // Generator for valid future dates (business hours: 8 AM - 6 PM, Sunday-Thursday)
  const validScheduledTimeGen = fc.date({ 
    min: new Date(Date.now() + 60000), // At least 1 minute in the future
    max: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // Up to 14 days in the future
  }).map(date => {
    // Adjust to business hours (8 AM - 6 PM, Sunday-Thursday)
    const adjustedDate = new Date(date);
    const dayOfWeek = adjustedDate.getDay();
    
    // If Friday or Saturday, move to Sunday
    if (dayOfWeek === 5) { // Friday
      adjustedDate.setDate(adjustedDate.getDate() + 2);
    } else if (dayOfWeek === 6) { // Saturday
      adjustedDate.setDate(adjustedDate.getDate() + 1);
    }
    
    // Set to business hours (8 AM - 6 PM)
    const hour = 8 + Math.floor(Math.random() * 10); // 8-17 (8 AM - 5 PM)
    adjustedDate.setHours(hour, 0, 0, 0);
    
    return adjustedDate;
  });

  // Generator for invalid scheduled times
  const invalidScheduledTimeGen = fc.oneof(
    // Past dates
    fc.date({ 
      min: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 
      max: new Date(Date.now() - 60000) 
    }),
    // Weekend dates (Friday and Saturday)
    fc.date({ 
      min: new Date(Date.now() + 60000), 
      max: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
    }).map(date => {
      const adjustedDate = new Date(date);
      // Force to weekend (Friday or Saturday)
      const dayOfWeek = adjustedDate.getDay();
      if (dayOfWeek < 5) {
        adjustedDate.setDate(adjustedDate.getDate() + (5 - dayOfWeek));
      } else if (dayOfWeek === 0) { // Sunday, move to Friday
        adjustedDate.setDate(adjustedDate.getDate() + 5);
      }
      return adjustedDate;
    }),
    // Outside business hours
    fc.date({ 
      min: new Date(Date.now() + 60000), 
      max: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
    }).map(date => {
      const adjustedDate = new Date(date);
      // Set to outside business hours (before 8 AM or after 6 PM)
      const hour = Math.random() < 0.5 ? Math.floor(Math.random() * 8) : 18 + Math.floor(Math.random() * 6);
      adjustedDate.setHours(hour, 0, 0, 0);
      return adjustedDate;
    })
  );

  /**
   * Property 12: Scheduling Validation
   * For any scheduled pickup request, time slot availability should be validated before acceptance
   * **Validates: Requirements 3.2**
   */
  test('Property 12: Valid time slots are accepted and invalid ones are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen, 
        wasteLogGen, 
        validScheduledTimeGen,
        async (userData, wasteLogData, scheduledTime) => {
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

          // Validate the scheduled time
          const validationResult = await validateScheduledTime(scheduledTime, user.profile.addresses[0]);

          // Valid time should pass validation
          expect(validationResult.isValid).toBe(true);
          expect(validationResult.errors).toHaveLength(0);

          // Create pickup request with valid scheduled time
          const pickup = await createScheduledPickupRequest(
            user._id,
            [wasteLog._id],
            user.profile.addresses[0],
            scheduledTime,
            'medium'
          );

          // Pickup should be created successfully
          expect(pickup).toBeDefined();
          expect(pickup.scheduledTime.getTime()).toBe(scheduledTime.getTime());
          expect(pickup.status).toBe('pending');

          // Verify time slot is now marked as occupied
          const timeSlotCheck = await checkTimeSlotAvailability(scheduledTime, user.profile.addresses[0]);
          expect(timeSlotCheck.available).toBe(false);
          expect(timeSlotCheck.conflictingPickupId).toBe(pickup._id.toString());
        }
      ),
      { numRuns: 25, timeout: 30000 }
    );
  });

  /**
   * Property: Invalid scheduled times are rejected with appropriate errors
   * For any invalid scheduled time, the system should reject the request with specific error messages
   */
  test('Property: Invalid scheduled times are rejected with appropriate validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen, 
        wasteLogGen, 
        invalidScheduledTimeGen,
        async (userData, wasteLogData, invalidTime) => {
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

          // Validate the invalid scheduled time
          const validationResult = await validateScheduledTime(invalidTime, user.profile.addresses[0]);

          // Invalid time should fail validation
          expect(validationResult.isValid).toBe(false);
          expect(validationResult.errors.length).toBeGreaterThan(0);

          // Attempt to create pickup request with invalid scheduled time should fail
          let errorThrown = false;
          try {
            await createScheduledPickupRequest(
              user._id,
              [wasteLog._id],
              user.profile.addresses[0],
              invalidTime,
              'medium'
            );
          } catch (error) {
            errorThrown = true;
            expect(error.message.toLowerCase()).toMatch(/schedule|time|invalid|business|weekend|past/);
          }

          expect(errorThrown).toBe(true);
        }
      ),
      { numRuns: 25, timeout: 30000 }
    );
  });

  /**
   * Property: Time slot conflicts are detected and prevented
   * For any time slot that is already occupied, new requests should be rejected
   */
  test('Property: Time slot conflicts are detected and prevented', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(userGen, { minLength: 2, maxLength: 5 }),
        validScheduledTimeGen,
        async (usersData, scheduledTime) => {
          const users = [];
          const wasteLogs = [];

          // Create multiple users and waste logs
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
            users.push(user);

            // Create waste log for each user
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
            wasteLogs.push(wasteLog);
          }

          // First user should be able to book the time slot
          const firstPickup = await createScheduledPickupRequest(
            users[0]._id,
            [wasteLogs[0]._id],
            users[0].profile.addresses[0],
            scheduledTime,
            'medium'
          );

          expect(firstPickup).toBeDefined();
          expect(firstPickup.scheduledTime.getTime()).toBe(scheduledTime.getTime());

          // Subsequent users should be rejected for the same time slot
          for (let i = 1; i < users.length; i++) {
            let conflictDetected = false;
            try {
              await createScheduledPickupRequest(
                users[i]._id,
                [wasteLogs[i]._id],
                users[i].profile.addresses[0],
                scheduledTime,
                'medium'
              );
            } catch (error) {
              conflictDetected = true;
              expect(error.message.toLowerCase()).toMatch(/conflict|occupied|unavailable|booked/);
            }

            expect(conflictDetected).toBe(true);
          }

          // Verify only one pickup exists for this time slot
          const pickupsAtTime = await Pickup.find({
            scheduledTime: scheduledTime,
            status: { $ne: 'cancelled' }
          });

          expect(pickupsAtTime).toHaveLength(1);
          expect(pickupsAtTime[0]._id.toString()).toBe(firstPickup._id.toString());
        }
      ),
      { numRuns: 12, timeout: 30000 }
    );
  });

  /**
   * Property: Time slot availability is correctly calculated
   * For any given time and location, availability should be accurately determined
   */
  test('Property: Time slot availability is accurately calculated', async () => {
    await fc.assert(
      fc.asyncProperty(
        userGen,
        fc.array(validScheduledTimeGen, { minLength: 3, maxLength: 8 }),
        async (userData, scheduledTimes) => {
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

          // Create waste log
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

          // Initially, all time slots should be available
          for (const time of scheduledTimes) {
            const availability = await checkTimeSlotAvailability(time, user.profile.addresses[0]);
            expect(availability.available).toBe(true);
            expect(availability.conflictingPickupId).toBeNull();
          }

          // Book the first time slot
          const bookedTime = scheduledTimes[0];
          const pickup = await createScheduledPickupRequest(
            user._id,
            [wasteLog._id],
            user.profile.addresses[0],
            bookedTime,
            'medium'
          );

          // The booked time slot should now be unavailable
          const bookedAvailability = await checkTimeSlotAvailability(bookedTime, user.profile.addresses[0]);
          expect(bookedAvailability.available).toBe(false);
          expect(bookedAvailability.conflictingPickupId).toBe(pickup._id.toString());

          // Other time slots should still be available
          for (let i = 1; i < scheduledTimes.length; i++) {
            const availability = await checkTimeSlotAvailability(scheduledTimes[i], user.profile.addresses[0]);
            expect(availability.available).toBe(true);
            expect(availability.conflictingPickupId).toBeNull();
          }

          // Cancel the pickup
          pickup.status = 'cancelled';
          await pickup.save();

          // The time slot should become available again
          const cancelledAvailability = await checkTimeSlotAvailability(bookedTime, user.profile.addresses[0]);
          expect(cancelledAvailability.available).toBe(true);
          expect(cancelledAvailability.conflictingPickupId).toBeNull();
        }
      ),
      { numRuns: 12, timeout: 30000 }
    );
  });
});

/**
 * Validates a scheduled time against business rules
 */
async function validateScheduledTime(scheduledTime, address) {
  const errors = [];
  const now = new Date();

  // Check if time is in the past
  if (scheduledTime.getTime() <= now.getTime()) {
    errors.push('Scheduled time must be in the future');
  }

  // Check if time is too far in the future (max 14 days)
  const maxFutureTime = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  if (scheduledTime.getTime() > maxFutureTime.getTime()) {
    errors.push('Scheduled time cannot be more than 14 days in the future');
  }

  // Check if it's a business day (Sunday-Thursday)
  const dayOfWeek = scheduledTime.getDay();
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    errors.push('Pickups are only available on business days (Sunday-Thursday)');
  }

  // Check if it's during business hours (8 AM - 6 PM)
  const hour = scheduledTime.getHours();
  if (hour < 8 || hour >= 18) {
    errors.push('Pickups are only available during business hours (8 AM - 6 PM)');
  }

  // Check for time slot conflicts
  const conflictCheck = await checkTimeSlotAvailability(scheduledTime, address);
  if (!conflictCheck.available) {
    errors.push(`Time slot is already occupied by pickup ${conflictCheck.conflictingPickupId}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Checks if a time slot is available for scheduling
 */
async function checkTimeSlotAvailability(scheduledTime, address) {
  // Check for existing pickups in the same time slot and area
  // For simplicity, we consider a 1-hour window around the scheduled time
  const startTime = new Date(scheduledTime.getTime() - 30 * 60 * 1000); // 30 minutes before
  const endTime = new Date(scheduledTime.getTime() + 30 * 60 * 1000); // 30 minutes after

  const conflictingPickup = await Pickup.findOne({
    scheduledTime: {
      $gte: startTime,
      $lte: endTime
    },
    'address.zipCode': address.zipCode,
    status: { $nin: ['cancelled', 'completed'] }
  });

  return {
    available: !conflictingPickup,
    conflictingPickupId: conflictingPickup ? conflictingPickup._id.toString() : null
  };
}

/**
 * Creates a scheduled pickup request with validation
 */
async function createScheduledPickupRequest(citizenId, wasteLogIds, address, scheduledTime, priority) {
  // Validate scheduled time
  const validation = await validateScheduledTime(scheduledTime, address);
  if (!validation.isValid) {
    throw new Error(`Scheduling validation failed: ${validation.errors.join(', ')}`);
  }

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
    scheduledTime,
    priority,
    status: 'pending',
    qrCode,
    estimatedWeight,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await pickup.save();
  return pickup;
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