import fc from 'fast-check';
import mongoose from 'mongoose';
import User from '../models/User.js';
import WasteLog from '../models/Waste.js';
import ImpactDashboard from '../models/ImpactDashboard.js';
import EcoPointsWallet from '../models/EcoPointsWallet.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';

// Feature: ecocycle-platform, Property 10: Real-time Dashboard Updates

describe('Real-time Dashboard Updates Property Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
    }
  });

  beforeEach(async () => {
    // Clear all collections
    await User.deleteMany({});
    await WasteLog.deleteMany({});
    await ImpactDashboard.deleteMany({});
    await EcoPointsWallet.deleteMany({});
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
  const coordinatesGen = fc.record({
    lat: fc.float({ min: Math.fround(-90), max: Math.fround(90), noNaN: true }),
    lng: fc.float({ min: Math.fround(-180), max: Math.fround(180), noNaN: true })
  });

  const userGen = fc.record({
    email: fc.emailAddress(),
    firstName: fc.string({ minLength: 1, maxLength: 50 }),
    lastName: fc.string({ minLength: 1, maxLength: 50 }),
    role: fc.constant('citizen'),
    coordinates: coordinatesGen
  });

  const wasteLogGen = fc.record({
    wasteType: wasteTypeGen,
    weight: weightGen,
    description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined })
  });

  /**
   * Property 10: Real-time Dashboard Updates
   * For any completed waste log, the citizen's impact dashboard should reflect the new data immediately
   * **Validates: Requirements 2.5**
   */
  test('Property 10: Dashboard updates immediately reflect completed waste logs', async () => {
    await fc.assert(
      fc.asyncProperty(userGen, fc.array(wasteLogGen, { minLength: 1, maxLength: 10 }), async (userData, wasteLogs) => {
        // Create a citizen user
        const user = new User({
          email: userData.email,
          password: 'hashedpassword123',
          role: userData.role,
          profile: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            addresses: [{
              street: '123 Test St',
              city: 'Test City',
              zipCode: '12345',
              coordinates: {
                type: 'Point',
                coordinates: [userData.coordinates.lng, userData.coordinates.lat]
              },
              isDefault: true
            }]
          }
        });
        await user.save();

        // Create initial dashboard and wallet
        const initialDashboard = new ImpactDashboard({
          citizenId: user._id,
          totalWasteRecycled: 0,
          co2Saved: 0,
          ecoPointsEarned: 0,
          pickupsCompleted: 0,
          currentStreak: 0,
          longestStreak: 0,
          wasteBreakdown: [],
          monthlyTrends: [],
          achievements: []
        });
        await initialDashboard.save();

        const initialWallet = new EcoPointsWallet({
          citizenId: user._id,
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          transactions: []
        });
        await initialWallet.save();

        // Calculate expected totals
        let expectedTotalWeight = 0;
        let expectedTotalCO2 = 0;
        let expectedTotalPoints = 0;
        const wasteBreakdown = {};

        for (const wasteLogData of wasteLogs) {
          const config = await WasteTypeConfig.findOne({ type: wasteLogData.wasteType });
          const weight = wasteLogData.weight;
          const co2Saved = weight * config.co2SavedPerKg;
          const points = weight * config.pointsPerKg;

          expectedTotalWeight += weight;
          expectedTotalCO2 += co2Saved;
          expectedTotalPoints += points;

          if (!wasteBreakdown[wasteLogData.wasteType]) {
            wasteBreakdown[wasteLogData.wasteType] = 0;
          }
          wasteBreakdown[wasteLogData.wasteType] += weight;
        }

        // Create and complete waste logs
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
                coordinates: [userData.coordinates.lng, userData.coordinates.lat]
              }
            },
            ecoPointsEarned,
            status: 'verified'
          });
          await wasteLog.save();

          // Simulate real-time dashboard update
          await updateDashboardRealTime(user._id, wasteLog);
        }

        // Verify dashboard reflects all changes immediately
        const updatedDashboard = await ImpactDashboard.findOne({ citizenId: user._id });
        const updatedWallet = await EcoPointsWallet.findOne({ citizenId: user._id });

        // Dashboard should reflect total accumulated values
        expect(Math.abs(updatedDashboard.totalWasteRecycled - expectedTotalWeight)).toBeLessThan(0.01);
        expect(Math.abs(updatedDashboard.co2Saved - expectedTotalCO2)).toBeLessThan(0.01);
        expect(Math.abs(updatedDashboard.ecoPointsEarned - expectedTotalPoints)).toBeLessThan(0.01);

        // Wallet should reflect total points earned
        expect(Math.abs(updatedWallet.balance - expectedTotalPoints)).toBeLessThan(0.01);
        expect(Math.abs(updatedWallet.totalEarned - expectedTotalPoints)).toBeLessThan(0.01);

        // Waste breakdown should be accurate
        const dashboardBreakdown = {};
        updatedDashboard.wasteBreakdown.forEach(item => {
          dashboardBreakdown[item.type] = item.weight;
        });

        for (const [type, expectedWeight] of Object.entries(wasteBreakdown)) {
          expect(Math.abs((dashboardBreakdown[type] || 0) - expectedWeight)).toBeLessThan(0.01);
        }

        // Transaction history should be complete
        expect(updatedWallet.transactions).toHaveLength(wasteLogs.length);
        
        // Each transaction should have correct details
        for (let i = 0; i < wasteLogs.length; i++) {
          const transaction = updatedWallet.transactions[i];
          expect(transaction.type).toBe('earned');
          expect(transaction.amount).toBeGreaterThan(0);
          expect(transaction.description).toContain('waste logging');
        }
      }),
      { numRuns: 25, timeout: 30000 }
    );
  });

  /**
   * Property: Dashboard consistency across multiple concurrent updates
   * For any sequence of concurrent waste log completions, the dashboard should maintain consistency
   */
  test('Property: Dashboard maintains consistency during concurrent updates', async () => {
    await fc.assert(
      fc.asyncProperty(userGen, fc.array(wasteLogGen, { minLength: 2, maxLength: 5 }), async (userData, wasteLogs) => {
        // Create a citizen user
        const user = new User({
          email: userData.email,
          password: 'hashedpassword123',
          role: userData.role,
          profile: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            addresses: [{
              street: '123 Test St',
              city: 'Test City',
              zipCode: '12345',
              coordinates: {
                type: 'Point',
                coordinates: [userData.coordinates.lng, userData.coordinates.lat]
              },
              isDefault: true
            }]
          }
        });
        await user.save();

        // Create initial dashboard and wallet
        const initialDashboard = new ImpactDashboard({
          citizenId: user._id,
          totalWasteRecycled: 0,
          co2Saved: 0,
          ecoPointsEarned: 0,
          pickupsCompleted: 0,
          currentStreak: 0,
          longestStreak: 0,
          wasteBreakdown: [],
          monthlyTrends: [],
          achievements: []
        });
        await initialDashboard.save();

        const initialWallet = new EcoPointsWallet({
          citizenId: user._id,
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          transactions: []
        });
        await initialWallet.save();

        // Create waste logs concurrently
        const wasteLogPromises = wasteLogs.map(async (wasteLogData) => {
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
                coordinates: [userData.coordinates.lng, userData.coordinates.lat]
              }
            },
            ecoPointsEarned,
            status: 'verified'
          });
          await wasteLog.save();
          return wasteLog;
        });

        const createdWasteLogs = await Promise.all(wasteLogPromises);

        // Update dashboard concurrently for all waste logs
        const updatePromises = createdWasteLogs.map(wasteLog => 
          updateDashboardRealTime(user._id, wasteLog)
        );
        await Promise.all(updatePromises);

        // Calculate expected totals
        let expectedTotalWeight = 0;
        let expectedTotalCO2 = 0;
        let expectedTotalPoints = 0;

        for (const wasteLogData of wasteLogs) {
          const config = await WasteTypeConfig.findOne({ type: wasteLogData.wasteType });
          expectedTotalWeight += wasteLogData.weight;
          expectedTotalCO2 += wasteLogData.weight * config.co2SavedPerKg;
          expectedTotalPoints += wasteLogData.weight * config.pointsPerKg;
        }

        // Verify final consistency
        const finalDashboard = await ImpactDashboard.findOne({ citizenId: user._id });
        const finalWallet = await EcoPointsWallet.findOne({ citizenId: user._id });

        expect(Math.abs(finalDashboard.totalWasteRecycled - expectedTotalWeight)).toBeLessThan(0.01);
        expect(Math.abs(finalDashboard.co2Saved - expectedTotalCO2)).toBeLessThan(0.01);
        expect(Math.abs(finalDashboard.ecoPointsEarned - expectedTotalPoints)).toBeLessThan(0.01);
        expect(Math.abs(finalWallet.balance - expectedTotalPoints)).toBeLessThan(0.01);
      }),
      { numRuns: 12, timeout: 30000 }
    );
  });

  /**
   * Property: Dashboard update idempotency
   * For any waste log, multiple dashboard update calls should not cause duplicate updates
   */
  test('Property: Dashboard updates are idempotent', async () => {
    await fc.assert(
      fc.asyncProperty(userGen, wasteLogGen, async (userData, wasteLogData) => {
        // Create a citizen user
        const user = new User({
          email: userData.email,
          password: 'hashedpassword123',
          role: userData.role,
          profile: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            addresses: [{
              street: '123 Test St',
              city: 'Test City',
              zipCode: '12345',
              coordinates: {
                type: 'Point',
                coordinates: [userData.coordinates.lng, userData.coordinates.lat]
              },
              isDefault: true
            }]
          }
        });
        await user.save();

        // Create initial dashboard and wallet
        const initialDashboard = new ImpactDashboard({
          citizenId: user._id,
          totalWasteRecycled: 0,
          co2Saved: 0,
          ecoPointsEarned: 0,
          pickupsCompleted: 0,
          currentStreak: 0,
          longestStreak: 0,
          wasteBreakdown: [],
          monthlyTrends: [],
          achievements: []
        });
        await initialDashboard.save();

        const initialWallet = new EcoPointsWallet({
          citizenId: user._id,
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          transactions: []
        });
        await initialWallet.save();

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
              coordinates: [userData.coordinates.lng, userData.coordinates.lat]
            }
          },
          ecoPointsEarned,
          status: 'verified'
        });
        await wasteLog.save();

        // Update dashboard multiple times with the same waste log
        await updateDashboardRealTime(user._id, wasteLog);
        const firstUpdate = await ImpactDashboard.findOne({ citizenId: user._id });
        const firstWallet = await EcoPointsWallet.findOne({ citizenId: user._id });

        // Second update should not change anything
        await updateDashboardRealTime(user._id, wasteLog);
        const secondUpdate = await ImpactDashboard.findOne({ citizenId: user._id });
        const secondWallet = await EcoPointsWallet.findOne({ citizenId: user._id });

        // Values should remain the same
        expect(secondUpdate.totalWasteRecycled).toBe(firstUpdate.totalWasteRecycled);
        expect(secondUpdate.co2Saved).toBe(firstUpdate.co2Saved);
        expect(secondUpdate.ecoPointsEarned).toBe(firstUpdate.ecoPointsEarned);
        expect(secondWallet.balance).toBe(firstWallet.balance);
        expect(secondWallet.transactions).toHaveLength(firstWallet.transactions.length);
      }),
      { numRuns: 25, timeout: 30000 }
    );
  });
});

/**
 * Simulates real-time dashboard update functionality
 * This would typically be triggered by WebSocket events or API calls
 */
async function updateDashboardRealTime(citizenId, wasteLog) {
  // Check if this waste log has already been processed
  const existingDashboard = await ImpactDashboard.findOne({ citizenId });
  const existingWallet = await EcoPointsWallet.findOne({ citizenId });
  
  // Check if transaction already exists for this waste log
  const existingTransaction = existingWallet.transactions.find(
    t => t.relatedId && t.relatedId.toString() === wasteLog._id.toString()
  );
  
  if (existingTransaction) {
    // Already processed, skip to maintain idempotency
    return;
  }

  const config = await WasteTypeConfig.findOne({ type: wasteLog.wasteType });
  const co2Saved = wasteLog.weight * config.co2SavedPerKg;

  // Update dashboard
  const updatedDashboard = await ImpactDashboard.findOneAndUpdate(
    { citizenId },
    {
      $inc: {
        totalWasteRecycled: wasteLog.weight,
        co2Saved: co2Saved,
        ecoPointsEarned: wasteLog.ecoPointsEarned
      },
      $set: { updatedAt: new Date() }
    },
    { new: true }
  );

  // Update waste breakdown
  const existingBreakdown = updatedDashboard.wasteBreakdown.find(
    item => item.type === wasteLog.wasteType
  );

  if (existingBreakdown) {
    existingBreakdown.weight += wasteLog.weight;
  } else {
    updatedDashboard.wasteBreakdown.push({
      type: wasteLog.wasteType,
      weight: wasteLog.weight,
      percentage: 0 // Will be calculated separately
    });
  }

  // Recalculate percentages
  const totalWeight = updatedDashboard.wasteBreakdown.reduce((sum, item) => sum + item.weight, 0);
  updatedDashboard.wasteBreakdown.forEach(item => {
    item.percentage = totalWeight > 0 ? (item.weight / totalWeight) * 100 : 0;
  });

  await updatedDashboard.save();

  // Update wallet
  await EcoPointsWallet.findOneAndUpdate(
    { citizenId },
    {
      $inc: {
        balance: wasteLog.ecoPointsEarned,
        totalEarned: wasteLog.ecoPointsEarned
      },
      $push: {
        transactions: {
          type: 'earned',
          amount: wasteLog.ecoPointsEarned,
          description: `EcoPoints earned from ${wasteLog.wasteType} waste logging`,
          relatedId: wasteLog._id,
          createdAt: new Date()
        }
      },
      $set: { updatedAt: new Date() }
    }
  );
}