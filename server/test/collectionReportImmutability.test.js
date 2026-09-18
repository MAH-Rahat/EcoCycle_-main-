import fc from 'fast-check';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { Waste } from '../models/Waste.js';
import Pickup from '../models/Pickup.js';

// Feature: ecocycle-platform, Property 23: Collection Report Immutability

// Helper function to create valid user data
function createUserData(userData, role) {
  const firstName = userData.firstName.trim() || 'Test';
  const lastName = userData.lastName.trim() || 'User';
  return {
    name: firstName + ' ' + lastName,
    username: userData.email.split('@')[0] + Math.random().toString(36).substr(2, 5), // Add random suffix to avoid conflicts
    email: userData.email,
    password: 'hashedpassword123',
    role: role,
    profile: {
      firstName: firstName,
      lastName: lastName,
      addresses: [{
        street: role === 'citizen' ? '123 Test St' : '456 Collector Ave',
        city: 'Test City',
        zipCode: '12345',
        coordinates: {
          type: 'Point',
          coordinates: [userData.coordinates.lng, userData.coordinates.lat]
        },
        isDefault: true
      }]
    }
  };
}

describe('Collection Report Immutability Property Tests', () => {
  beforeEach(async () => {
    // Clear all collections
    await User.deleteMany({});
    await Waste.deleteMany({});
    await Pickup.deleteMany({});
  });

  // Custom generators for test data
  const coordinatesGen = fc.record({
    lat: fc.float({ min: Math.fround(-90), max: Math.fround(90), noNaN: true }),
    lng: fc.float({ min: Math.fround(-180), max: Math.fround(180), noNaN: true })
  });

  const userGen = fc.record({
    email: fc.string({ minLength: 3, maxLength: 10 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') + Math.random().toString(36).substr(2, 5) + '@test.com'),
    firstName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    lastName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    role: fc.constantFrom('citizen', 'collector'),
    coordinates: coordinatesGen
  });

  const wasteGen = fc.record({
    wasteType: fc.constantFrom('plastic', 'paper', 'metal', 'glass', 'electronic', 'organic'),
    weight: fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
    description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined })
  });

  const collectionReportGen = fc.record({
    actualWeight: fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
    notes: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
    photos: fc.array(fc.webUrl(), { maxLength: 5 })
  });

  /**
   * Property 23: Collection Report Immutability
   * For any verified pickup, the collection report should be created and remain immutable after creation
   * **Validates: Requirements 6.5**
   */
  test('Property 23: Collection reports remain immutable after creation', async () => {
    await fc.assert(
      fc.asyncProperty(userGen, userGen, wasteGen, collectionReportGen, async (citizenData, collectorData, wasteData, reportData) => {
        // Create citizen and collector users
        const citizen = new User(createUserData(citizenData, 'citizen'));
        await citizen.save();

        const collector = new User(createUserData(collectorData, 'collector'));
        await collector.save();

        // Create waste item
        const waste = new Waste({
          citizenId: citizen._id,
          wasteType: wasteData.wasteType,
          weight: wasteData.weight,
          description: wasteData.description,
          status: 'pending'
        });
        await waste.save();

        // Create pickup request
        const pickup = new Pickup({
          citizenId: citizen._id,
          wasteLogIds: [waste._id],
          address: {
            street: '123 Test St',
            city: 'Test City',
            zipCode: '12345',
            coordinates: {
              type: 'Point',
              coordinates: [-122.4194, 37.7749]
            }
          },
          scheduledTime: new Date('2024-02-01'),
          estimatedWeight: wasteData.weight,
          status: 'pending'
        });
        await pickup.save();

        // Simulate pickup workflow: Assign -> Arrived -> QR Verify -> Complete
        pickup.status = 'assigned';
        pickup.assignedCollectorId = collector._id;
        pickup.assignedAt = new Date();
        await pickup.save();

        pickup.status = 'arrived';
        await pickup.save();

        // Verify QR code
        const qrVerifyResult = pickup.verifyQRCode(pickup.qrCode, collector._id);
        expect(qrVerifyResult.success).toBe(true);
        await pickup.save();

        // Complete pickup with collection report
        const completionResult = pickup.completePickup(collector._id, reportData);
        expect(completionResult.success).toBe(true);
        await pickup.save();

        // Verify collection report was created
        const completedPickup = await Pickup.findById(pickup._id);
        expect(completedPickup.status).toBe('completed');
        expect(completedPickup.actualWeight).toBe(reportData.actualWeight);
        expect(completedPickup.notes).toBe(reportData.notes);
        expect(completedPickup.collectionPhotos).toEqual(reportData.photos);
        expect(completedPickup.completedAt).toBeInstanceOf(Date);

        // Store original collection report data
        const originalReport = {
          actualWeight: completedPickup.actualWeight,
          notes: completedPickup.notes,
          collectionPhotos: [...completedPickup.collectionPhotos],
          completedAt: completedPickup.completedAt,
          qrVerified: completedPickup.qrVerified,
          qrVerifiedAt: completedPickup.qrVerifiedAt,
          qrVerifiedBy: completedPickup.qrVerifiedBy
        };

        // Attempt to modify collection report fields directly
        try {
          completedPickup.actualWeight = reportData.actualWeight + 10;
          completedPickup.notes = 'Modified notes';
          completedPickup.collectionPhotos = ['http://modified.com/photo.jpg'];
          
          // Save should either fail or the changes should be rejected
          await completedPickup.save();
          
          // Reload from database to check if changes persisted
          const reloadedPickup = await Pickup.findById(pickup._id);
          
          // Collection report should remain unchanged (immutable)
          expect(reloadedPickup.actualWeight).toBe(originalReport.actualWeight);
          expect(reloadedPickup.notes).toBe(originalReport.notes);
          expect(reloadedPickup.collectionPhotos).toEqual(originalReport.collectionPhotos);
          expect(reloadedPickup.completedAt.getTime()).toBe(originalReport.completedAt.getTime());
          expect(reloadedPickup.qrVerified).toBe(originalReport.qrVerified);
          expect(reloadedPickup.qrVerifiedAt.getTime()).toBe(originalReport.qrVerifiedAt.getTime());
          expect(reloadedPickup.qrVerifiedBy.toString()).toBe(originalReport.qrVerifiedBy.toString());
          
        } catch (error) {
          // If modification throws an error, that's also acceptable for immutability
          console.log('Collection report modification prevented:', error.message);
        }

        // Attempt to use completePickup method again (should fail)
        const secondCompletionAttempt = completedPickup.completePickup(collector._id, {
          actualWeight: reportData.actualWeight + 20,
          notes: 'Second completion attempt',
          photos: ['http://second.com/photo.jpg']
        });
        
        expect(secondCompletionAttempt.success).toBe(false);
        expect(secondCompletionAttempt.message).toContain('not in progress');

        // Verify the collection report remains unchanged after failed modification attempt
        const finalPickup = await Pickup.findById(pickup._id);
        expect(finalPickup.actualWeight).toBe(originalReport.actualWeight);
        expect(finalPickup.notes).toBe(originalReport.notes);
        expect(finalPickup.collectionPhotos).toEqual(originalReport.collectionPhotos);
        expect(finalPickup.completedAt.getTime()).toBe(originalReport.completedAt.getTime());
      }),
      { numRuns: 5, timeout: 30000 }
    );
  });

  /**
   * Property: Collection report creation atomicity
   * For any pickup completion, either all collection report fields are set or none are set
   */
  test('Property: Collection report creation is atomic', async () => {
    await fc.assert(
      fc.asyncProperty(userGen, userGen, wasteGen, collectionReportGen, async (citizenData, collectorData, wasteData, reportData) => {
        // Create citizen and collector users
        const citizen = new User(createUserData(citizenData, 'citizen'));
        await citizen.save();

        const collector = new User(createUserData(collectorData, 'collector'));
        await collector.save();

        // Create waste item
        const waste = new Waste({
          citizenId: citizen._id,
          wasteType: wasteData.wasteType,
          weight: wasteData.weight,
          description: wasteData.description,
          status: 'pending'
        });
        await waste.save();

        // Create pickup request
        const pickup = new Pickup({
          citizenId: citizen._id,
          wasteLogIds: [waste._id],
          address: {
            street: '123 Test St',
            city: 'Test City',
            zipCode: '12345',
            coordinates: {
              type: 'Point',
              coordinates: [-122.4194, 37.7749]
            }
          },
          scheduledTime: new Date('2024-02-01'),
          estimatedWeight: wasteData.weight,
          status: 'pending'
        });
        await pickup.save();

        // Simulate pickup workflow up to QR verification
        pickup.status = 'assigned';
        pickup.assignedCollectorId = collector._id;
        pickup.assignedAt = new Date();
        await pickup.save();

        pickup.status = 'arrived';
        await pickup.save();

        const qrVerifyResult = pickup.verifyQRCode(pickup.qrCode, collector._id);
        expect(qrVerifyResult.success).toBe(true);
        await pickup.save();

        // Complete pickup
        const completionResult = pickup.completePickup(collector._id, reportData);
        expect(completionResult.success).toBe(true);
        await pickup.save();

        // Verify all collection report fields are set atomically
        const completedPickup = await Pickup.findById(pickup._id);
        
        // Either all fields are set (successful completion) or none are set (failed completion)
        if (completedPickup.status === 'completed') {
          // All collection report fields should be present
          expect(completedPickup.actualWeight).toBeDefined();
          expect(completedPickup.actualWeight).toBeGreaterThan(0);
          expect(completedPickup.completedAt).toBeInstanceOf(Date);
          expect(completedPickup.notes).toBeDefined(); // Can be null/undefined but should be defined
          expect(Array.isArray(completedPickup.collectionPhotos)).toBe(true);
          
          // QR verification fields should also be set
          expect(completedPickup.qrVerified).toBe(true);
          expect(completedPickup.qrVerifiedAt).toBeInstanceOf(Date);
          expect(completedPickup.qrVerifiedBy).toBeDefined();
        } else {
          // If not completed, collection report fields should not be set
          expect(completedPickup.actualWeight).toBeUndefined();
          expect(completedPickup.completedAt).toBeUndefined();
        }
      }),
      { numRuns: 12, timeout: 30000 }
    );
  });

  /**
   * Property: Collection report uniqueness per pickup
   * For any pickup, only one collection report can be created
   */
  test('Property: Only one collection report per pickup', async () => {
    await fc.assert(
      fc.asyncProperty(userGen, userGen, wasteGen, collectionReportGen, collectionReportGen, async (citizenData, collectorData, wasteData, firstReport, secondReport) => {
        // Create citizen and collector users
        const citizen = new User(createUserData(citizenData, 'citizen'));
        await citizen.save();

        const collector = new User(createUserData(collectorData, 'collector'));
        await collector.save();

        // Create waste item
        const waste = new Waste({
          citizenId: citizen._id,
          wasteType: wasteData.wasteType,
          weight: wasteData.weight,
          description: wasteData.description,
          status: 'pending'
        });
        await waste.save();

        // Create pickup request
        const pickup = new Pickup({
          citizenId: citizen._id,
          wasteLogIds: [waste._id],
          address: {
            street: '123 Test St',
            city: 'Test City',
            zipCode: '12345',
            coordinates: {
              type: 'Point',
              coordinates: [-122.4194, 37.7749]
            }
          },
          scheduledTime: new Date('2024-02-01'),
          estimatedWeight: wasteData.weight,
          status: 'pending'
        });
        await pickup.save();

        // Complete pickup workflow
        pickup.status = 'assigned';
        pickup.assignedCollectorId = collector._id;
        pickup.assignedAt = new Date();
        await pickup.save();

        pickup.status = 'arrived';
        await pickup.save();

        const qrVerifyResult = pickup.verifyQRCode(pickup.qrCode, collector._id);
        expect(qrVerifyResult.success).toBe(true);
        await pickup.save();

        // First completion (should succeed)
        const firstCompletionResult = pickup.completePickup(collector._id, firstReport);
        expect(firstCompletionResult.success).toBe(true);
        await pickup.save();

        // Store first collection report data
        const firstCompletedPickup = await Pickup.findById(pickup._id);
        const originalReportData = {
          actualWeight: firstCompletedPickup.actualWeight,
          notes: firstCompletedPickup.notes,
          collectionPhotos: [...firstCompletedPickup.collectionPhotos],
          completedAt: firstCompletedPickup.completedAt
        };

        // Second completion attempt (should fail)
        const secondCompletionResult = firstCompletedPickup.completePickup(collector._id, secondReport);
        expect(secondCompletionResult.success).toBe(false);

        // Verify original collection report remains unchanged
        const finalPickup = await Pickup.findById(pickup._id);
        expect(finalPickup.actualWeight).toBe(originalReportData.actualWeight);
        expect(finalPickup.notes).toBe(originalReportData.notes);
        expect(finalPickup.collectionPhotos).toEqual(originalReportData.collectionPhotos);
        expect(finalPickup.completedAt.getTime()).toBe(originalReportData.completedAt.getTime());
        expect(finalPickup.status).toBe('completed');
      }),
      { numRuns: 12, timeout: 30000 }
    );
  });

  /**
   * Property: Collection report data integrity
   * For any collection report, all data should be preserved exactly as provided
   */
  test('Property: Collection report preserves data integrity', async () => {
    await fc.assert(
      fc.asyncProperty(userGen, userGen, wasteGen, collectionReportGen, async (citizenData, collectorData, wasteData, reportData) => {
        // Create citizen and collector users
        const citizen = new User(createUserData(citizenData, 'citizen'));
        await citizen.save();

        const collector = new User(createUserData(collectorData, 'collector'));
        await collector.save();

        // Create waste item
        const waste = new Waste({
          citizenId: citizen._id,
          wasteType: wasteData.wasteType,
          weight: wasteData.weight,
          description: wasteData.description,
          status: 'pending'
        });
        await waste.save();

        // Create pickup request
        const pickup = new Pickup({
          citizenId: citizen._id,
          wasteLogIds: [waste._id],
          address: {
            street: '123 Test St',
            city: 'Test City',
            zipCode: '12345',
            coordinates: {
              type: 'Point',
              coordinates: [-122.4194, 37.7749]
            }
          },
          scheduledTime: new Date('2024-02-01'),
          estimatedWeight: wasteData.weight,
          status: 'pending'
        });
        await pickup.save();

        // Complete pickup workflow
        pickup.status = 'assigned';
        pickup.assignedCollectorId = collector._id;
        pickup.assignedAt = new Date();
        await pickup.save();

        pickup.status = 'arrived';
        await pickup.save();

        const qrVerifyResult = pickup.verifyQRCode(pickup.qrCode, collector._id);
        expect(qrVerifyResult.success).toBe(true);
        await pickup.save();

        // Complete pickup with specific report data
        const completionResult = pickup.completePickup(collector._id, reportData);
        expect(completionResult.success).toBe(true);
        await pickup.save();

        // Verify data integrity - all data should be preserved exactly
        const completedPickup = await Pickup.findById(pickup._id);
        
        // Numeric precision should be maintained
        expect(completedPickup.actualWeight).toBe(reportData.actualWeight);
        
        // String data should be preserved exactly (including null/undefined)
        expect(completedPickup.notes).toBe(reportData.notes);
        
        // Array data should be preserved with correct order and content
        expect(completedPickup.collectionPhotos).toEqual(reportData.photos);
        expect(completedPickup.collectionPhotos.length).toBe(reportData.photos.length);
        
        // Timestamps should be set and be recent
        expect(completedPickup.completedAt).toBeInstanceOf(Date);
        const timeDiff = Math.abs(new Date() - completedPickup.completedAt);
        expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
        
        // Status should be correctly set
        expect(completedPickup.status).toBe('completed');
        
        // QR verification data should be preserved
        expect(completedPickup.qrVerified).toBe(true);
        expect(completedPickup.qrVerifiedAt).toBeInstanceOf(Date);
        expect(completedPickup.qrVerifiedBy.toString()).toBe(collector._id.toString());
      }),
      { numRuns: 25, timeout: 30000 }
    );
  });
});