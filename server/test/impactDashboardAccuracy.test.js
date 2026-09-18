import fc from 'fast-check';
import mongoose from 'mongoose';
import ImpactDashboard from '../models/ImpactDashboard.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';
import { Waste } from '../models/Waste.js';
import User from '../models/User.js';
import { updateDashboardForWasteLog } from '../controllers/impactDashboardController.js';

// Feature: ecocycle-platform, Property 33: Impact Dashboard Accuracy
describe('Impact Dashboard Accuracy Property-Based Tests', () => {
    let testCitizen;
    let wasteTypeConfigs;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
        }
    });

    beforeEach(async () => {
        await ImpactDashboard.deleteMany({});
        await WasteTypeConfig.deleteMany({});
        await Waste.deleteMany({});
        await User.deleteMany({});
        
        // Create test citizen
        testCitizen = new User({
            name: 'Test Citizen',
            username: 'testcitizen',
            email: 'citizen@test.com',
            password: 'hashedpassword',
            role: 'citizen'
        });
        await testCitizen.save();

        // Initialize test waste type configurations with known values
        wasteTypeConfigs = [
            {
                type: 'plastic',
                pointsPerKg: 10,
                co2SavedPerKg: 2.0,
                description: 'Plastic materials',
                recyclingTips: ['Clean before recycling'],
                isActive: true
            },
            {
                type: 'paper',
                pointsPerKg: 8,
                co2SavedPerKg: 1.5,
                description: 'Paper materials',
                recyclingTips: ['Keep dry'],
                isActive: true
            },
            {
                type: 'metal',
                pointsPerKg: 15,
                co2SavedPerKg: 3.0,
                description: 'Metal materials',
                recyclingTips: ['Rinse containers'],
                isActive: true
            },
            {
                type: 'glass',
                pointsPerKg: 12,
                co2SavedPerKg: 2.5,
                description: 'Glass materials',
                recyclingTips: ['Remove caps'],
                isActive: true
            }
        ];

        await WasteTypeConfig.insertMany(wasteTypeConfigs);
    });

    afterEach(async () => {
        await ImpactDashboard.deleteMany({});
        await WasteTypeConfig.deleteMany({});
        await Waste.deleteMany({});
        await User.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    // Custom generators for Impact Dashboard testing
    const validWasteTypeGen = () => fc.constantFrom('plastic', 'paper', 'metal', 'glass');
    
    const validWeightGen = () => fc.float({ min: Math.fround(0.1), max: Math.fround(100) });
    
    const wasteLogGen = () => fc.record({
        material: validWasteTypeGen(),
        weight: validWeightGen(),
        description: fc.string({ minLength: 5, maxLength: 100 })
    });

    // Property 33: Impact Dashboard Accuracy
    describe('Property 33: Impact Dashboard Accuracy', () => {
        test('For any citizen dashboard access, CO₂ saved calculations should be displayed accurately based on their waste logs', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(wasteLogGen(), { minLength: 1, maxLength: 10 }),
                async (wasteLogs) => {
                    let expectedTotalWeight = 0;
                    let expectedTotalCO2 = 0;
                    let expectedTotalPoints = 0;

                    // Create waste logs and update dashboard
                    for (const wasteLogData of wasteLogs) {
                        const wasteLog = new Waste({
                            citizenId: testCitizen._id,
                            wasteType: wasteLogData.material,
                            weight: wasteLogData.weight,
                            description: wasteLogData.description,
                            status: 'verified',
                            photos: []
                        });
                        await wasteLog.save();

                        // Calculate expected values
                        const config = wasteTypeConfigs.find(c => c.type === wasteLogData.material);
                        const pointsEarned = Math.round(config.pointsPerKg * wasteLogData.weight);
                        const co2Saved = config.co2SavedPerKg * wasteLogData.weight;

                        expectedTotalWeight += wasteLogData.weight;
                        expectedTotalCO2 += co2Saved;
                        expectedTotalPoints += pointsEarned;

                        // Update dashboard
                        await updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);
                    }

                    // Verify dashboard accuracy
                    const dashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });
                    expect(dashboard).toBeTruthy();

                    // Check CO2 saved calculation accuracy (within floating point precision)
                    expect(Math.abs(dashboard.co2Saved - expectedTotalCO2)).toBeLessThan(0.001);
                    
                    // Check total waste recycled accuracy
                    expect(Math.abs(dashboard.totalWasteRecycled - expectedTotalWeight)).toBeLessThan(0.001);
                    
                    // Check EcoPoints accuracy
                    expect(dashboard.ecoPointsEarned).toBe(expectedTotalPoints);

                    // Verify waste breakdown accuracy
                    const wasteTypeGroups = {};
                    for (const wasteLog of wasteLogs) {
                        if (!wasteTypeGroups[wasteLog.material]) {
                            wasteTypeGroups[wasteLog.material] = { weight: 0, points: 0 };
                        }
                        const config = wasteTypeConfigs.find(c => c.type === wasteLog.material);
                        wasteTypeGroups[wasteLog.material].weight += wasteLog.weight;
                        wasteTypeGroups[wasteLog.material].points += Math.round(config.pointsPerKg * wasteLog.weight);
                    }

                    for (const [wasteType, expected] of Object.entries(wasteTypeGroups)) {
                        const breakdown = dashboard.wasteBreakdown.find(b => b.type.toLowerCase() === wasteType);
                        expect(breakdown).toBeTruthy();
                        expect(Math.abs(breakdown.weight - expected.weight)).toBeLessThan(0.001);
                        expect(breakdown.pointsEarned).toBe(expected.points);
                        
                        // Check percentage calculation
                        const expectedPercentage = (expected.weight / expectedTotalWeight) * 100;
                        expect(Math.abs(breakdown.percentage - expectedPercentage)).toBeLessThan(0.01);
                    }
                }
            ), { numRuns: 7 });
        });

        test('For any waste processing, recycling statistics should be updated in real-time', () => {
            return fc.assert(fc.asyncProperty(
                wasteLogGen(),
                async (wasteLogData) => {
                    // Get initial dashboard state
                    const initialDashboard = await ImpactDashboard.getOrCreateDashboard(testCitizen._id);
                    const initialWeight = initialDashboard.totalWasteRecycled;
                    const initialCO2 = initialDashboard.co2Saved;
                    const initialPoints = initialDashboard.ecoPointsEarned;

                    // Create and process waste log
                    const wasteLog = new Waste({
                        citizenId: testCitizen._id,
                        wasteType: wasteLogData.material,
                        weight: wasteLogData.weight,
                        description: wasteLogData.description,
                        status: 'verified',
                        photos: []
                    });
                    await wasteLog.save();

                    // Calculate expected changes
                    const config = wasteTypeConfigs.find(c => c.type === wasteLogData.material);
                    const pointsEarned = Math.round(config.pointsPerKg * wasteLogData.weight);
                    const co2Saved = config.co2SavedPerKg * wasteLogData.weight;

                    // Update dashboard
                    await updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);

                    // Verify real-time updates
                    const updatedDashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });
                    
                    expect(Math.abs(updatedDashboard.totalWasteRecycled - (initialWeight + wasteLogData.weight))).toBeLessThan(0.001);
                    expect(Math.abs(updatedDashboard.co2Saved - (initialCO2 + co2Saved))).toBeLessThan(0.001);
                    expect(updatedDashboard.ecoPointsEarned).toBe(initialPoints + pointsEarned);

                    // Verify timestamp is updated
                    expect(updatedDashboard.updatedAt.getTime()).toBeGreaterThan(initialDashboard.updatedAt.getTime());
                }
            ), { numRuns: 12 });
        });

        test('For any dashboard calculation, all metrics should remain consistent with each other', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(wasteLogGen(), { minLength: 1, maxLength: 15 }),
                async (wasteLogs) => {
                    // Process all waste logs
                    for (const wasteLogData of wasteLogs) {
                        const wasteLog = new Waste({
                            citizenId: testCitizen._id,
                            wasteType: wasteLogData.material,
                            weight: wasteLogData.weight,
                            description: wasteLogData.description,
                            status: 'verified',
                            photos: []
                        });
                        await wasteLog.save();

                        const config = wasteTypeConfigs.find(c => c.type === wasteLogData.material);
                        const pointsEarned = Math.round(config.pointsPerKg * wasteLogData.weight);
                        const co2Saved = config.co2SavedPerKg * wasteLogData.weight;

                        await updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);
                    }

                    // Verify consistency
                    const dashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });
                    
                    // Total weight should equal sum of breakdown weights
                    const breakdownTotalWeight = dashboard.wasteBreakdown.reduce((sum, b) => sum + b.weight, 0);
                    expect(Math.abs(dashboard.totalWasteRecycled - breakdownTotalWeight)).toBeLessThan(0.001);

                    // Total points should equal sum of breakdown points
                    const breakdownTotalPoints = dashboard.wasteBreakdown.reduce((sum, b) => sum + b.pointsEarned, 0);
                    expect(dashboard.ecoPointsEarned).toBe(breakdownTotalPoints);

                    // Percentages should sum to 100% (within floating point precision)
                    const totalPercentage = dashboard.wasteBreakdown.reduce((sum, b) => sum + b.percentage, 0);
                    expect(Math.abs(totalPercentage - 100)).toBeLessThan(0.1);

                    // Monthly trends should be consistent
                    const monthlyTotalWeight = dashboard.monthlyTrends.reduce((sum, t) => sum + t.weight, 0);
                    const monthlyTotalPoints = dashboard.monthlyTrends.reduce((sum, t) => sum + t.points, 0);
                    const monthlyTotalCO2 = dashboard.monthlyTrends.reduce((sum, t) => sum + t.co2Saved, 0);

                    expect(Math.abs(dashboard.totalWasteRecycled - monthlyTotalWeight)).toBeLessThan(0.001);
                    expect(dashboard.ecoPointsEarned).toBe(monthlyTotalPoints);
                    expect(Math.abs(dashboard.co2Saved - monthlyTotalCO2)).toBeLessThan(0.001);
                }
            ), { numRuns: 6 });
        });

        test('For any dashboard refresh operation, recalculated values should match original calculations', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(wasteLogGen(), { minLength: 1, maxLength: 8 }),
                async (wasteLogs) => {
                    // Create waste logs first
                    const createdWasteLogs = [];
                    for (const wasteLogData of wasteLogs) {
                        const wasteLog = new Waste({
                            citizenId: testCitizen._id,
                            wasteType: wasteLogData.material,
                            weight: wasteLogData.weight,
                            description: wasteLogData.description,
                            status: 'verified',
                            photos: []
                        });
                        await wasteLog.save();
                        createdWasteLogs.push(wasteLog);
                    }

                    // Update dashboard incrementally
                    for (const wasteLog of createdWasteLogs) {
                        const config = wasteTypeConfigs.find(c => c.type === wasteLog.wasteType);
                        const pointsEarned = Math.round(config.pointsPerKg * wasteLog.weight);
                        const co2Saved = config.co2SavedPerKg * wasteLog.weight;

                        await updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);
                    }

                    // Get dashboard state after incremental updates
                    const incrementalDashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });

                    // Reset and recalculate from scratch
                    await ImpactDashboard.deleteOne({ citizenId: testCitizen._id });
                    const freshDashboard = await ImpactDashboard.getOrCreateDashboard(testCitizen._id);

                    // Recalculate all at once
                    for (const wasteLog of createdWasteLogs) {
                        const config = wasteTypeConfigs.find(c => c.type === wasteLog.wasteType);
                        const pointsEarned = Math.round(config.pointsPerKg * wasteLog.weight);
                        const co2Saved = config.co2SavedPerKg * wasteLog.weight;

                        await freshDashboard.updateWithWasteLog(wasteLog, pointsEarned, co2Saved);
                    }

                    // Compare results
                    expect(Math.abs(freshDashboard.totalWasteRecycled - incrementalDashboard.totalWasteRecycled)).toBeLessThan(0.001);
                    expect(Math.abs(freshDashboard.co2Saved - incrementalDashboard.co2Saved)).toBeLessThan(0.001);
                    expect(freshDashboard.ecoPointsEarned).toBe(incrementalDashboard.ecoPointsEarned);

                    // Compare waste breakdown
                    expect(freshDashboard.wasteBreakdown.length).toBe(incrementalDashboard.wasteBreakdown.length);
                    for (const freshBreakdown of freshDashboard.wasteBreakdown) {
                        const incrementalBreakdown = incrementalDashboard.wasteBreakdown.find(b => b.type === freshBreakdown.type);
                        expect(incrementalBreakdown).toBeTruthy();
                        expect(Math.abs(freshBreakdown.weight - incrementalBreakdown.weight)).toBeLessThan(0.001);
                        expect(freshBreakdown.pointsEarned).toBe(incrementalBreakdown.pointsEarned);
                        expect(Math.abs(freshBreakdown.percentage - incrementalBreakdown.percentage)).toBeLessThan(0.01);
                    }
                }
            ), { numRuns: 5 });
        });
    });

    // Property: Dashboard Data Integrity
    describe('Property: Dashboard Data Integrity', () => {
        test('For any dashboard operations, citizen ID should remain consistent and valid', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(wasteLogGen(), { minLength: 1, maxLength: 5 }),
                async (wasteLogs) => {
                    for (const wasteLogData of wasteLogs) {
                        const wasteLog = new Waste({
                            citizenId: testCitizen._id,
                            wasteType: wasteLogData.material,
                            weight: wasteLogData.weight,
                            description: wasteLogData.description,
                            status: 'verified',
                            photos: []
                        });
                        await wasteLog.save();

                        const config = wasteTypeConfigs.find(c => c.type === wasteLogData.material);
                        const pointsEarned = Math.round(config.pointsPerKg * wasteLogData.weight);
                        const co2Saved = config.co2SavedPerKg * wasteLogData.weight;

                        await updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);
                    }

                    const dashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });
                    expect(dashboard.citizenId.toString()).toBe(testCitizen._id.toString());
                    expect(mongoose.Types.ObjectId.isValid(dashboard.citizenId)).toBe(true);
                }
            ), { numRuns: 7 });
        });

        test('For any dashboard metrics, all values should be non-negative', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(wasteLogGen(), { minLength: 1, maxLength: 10 }),
                async (wasteLogs) => {
                    for (const wasteLogData of wasteLogs) {
                        const wasteLog = new Waste({
                            citizenId: testCitizen._id,
                            wasteType: wasteLogData.material,
                            weight: wasteLogData.weight,
                            description: wasteLogData.description,
                            status: 'verified',
                            photos: []
                        });
                        await wasteLog.save();

                        const config = wasteTypeConfigs.find(c => c.type === wasteLogData.material);
                        const pointsEarned = Math.round(config.pointsPerKg * wasteLogData.weight);
                        const co2Saved = config.co2SavedPerKg * wasteLogData.weight;

                        await updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);
                    }

                    const dashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });
                    
                    expect(dashboard.totalWasteRecycled).toBeGreaterThanOrEqual(0);
                    expect(dashboard.co2Saved).toBeGreaterThanOrEqual(0);
                    expect(dashboard.ecoPointsEarned).toBeGreaterThanOrEqual(0);
                    expect(dashboard.pickupsCompleted).toBeGreaterThanOrEqual(0);
                    expect(dashboard.currentStreak).toBeGreaterThanOrEqual(0);
                    expect(dashboard.longestStreak).toBeGreaterThanOrEqual(0);

                    // Check waste breakdown values
                    dashboard.wasteBreakdown.forEach(breakdown => {
                        expect(breakdown.weight).toBeGreaterThanOrEqual(0);
                        expect(breakdown.percentage).toBeGreaterThanOrEqual(0);
                        expect(breakdown.percentage).toBeLessThanOrEqual(100);
                        expect(breakdown.pointsEarned).toBeGreaterThanOrEqual(0);
                    });

                    // Check monthly trends values
                    dashboard.monthlyTrends.forEach(trend => {
                        expect(trend.weight).toBeGreaterThanOrEqual(0);
                        expect(trend.points).toBeGreaterThanOrEqual(0);
                        expect(trend.co2Saved).toBeGreaterThanOrEqual(0);
                        expect(trend.pickupsCompleted).toBeGreaterThanOrEqual(0);
                    });
                }
            ), { numRuns: 6 });
        });
    });
});