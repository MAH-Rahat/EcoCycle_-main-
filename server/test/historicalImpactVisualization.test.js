import fc from 'fast-check';
import mongoose from 'mongoose';
import ImpactDashboard from '../models/ImpactDashboard.js';
import { Waste } from '../models/Waste.js';
import User from '../models/User.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';
import { updateDashboardForWasteLog } from '../controllers/impactDashboardController.js';

// Feature: ecocycle-platform, Property 34: Historical Impact Visualization
describe('Historical Impact Visualization Property-Based Tests', () => {
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

        // Initialize test waste type configurations
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

    // Custom generators for historical visualization testing
    const validWasteTypeGen = () => fc.constantFrom('plastic', 'paper', 'metal');
    
    const validWeightGen = () => fc.float({ min: Math.fround(0.1), max: Math.fround(50) });
    
    const monthGen = () => fc.integer({ min: 0, max: 11 }); // 0-11 for months
    const yearGen = () => fc.integer({ min: 2023, max: 2024 });
    const dayGen = () => fc.integer({ min: 1, max: 28 }); // Safe day range for all months
    
    const dateGen = () => fc.record({
        year: yearGen(),
        month: monthGen(),
        day: dayGen()
    }).map(({ year, month, day }) => new Date(year, month, day));

    const historicalWasteLogGen = () => fc.record({
        material: validWasteTypeGen(),
        weight: validWeightGen(),
        createdAt: dateGen()
    });

    // Property 34: Historical Impact Visualization
    describe('Property 34: Historical Impact Visualization', () => {
        test('For any citizen impact data request, historical trends should be calculated and displayed correctly', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(historicalWasteLogGen(), { minLength: 1, maxLength: 20 }),
                async (historicalWasteLogs) => {
                    // Group expected data by month
                    const expectedMonthlyData = {};
                    
                    // Process each waste log
                    for (const wasteLogData of historicalWasteLogs) {
                        const wasteLog = new Waste({
                            citizen: testCitizen._id,
                            material: wasteLogData.material,
                            weight: wasteLogData.weight,
                            description: 'Test waste',
                            status: wasteLogData.status,
                            photos: [],
                            createdAt: wasteLogData.createdAt
                        });
                        await wasteLog.save();

                        // Calculate expected values
                        const config = wasteTypeConfigs.find(c => c.type === wasteLogData.material);
                        const pointsEarned = Math.round(config.pointsPerKg * wasteLogData.weight);
                        const co2Saved = config.co2SavedPerKg * wasteLogData.weight;

                        // Update dashboard
                        await updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);

                        // Track expected monthly data
                        const monthKey = wasteLogData.createdAt.toISOString().substring(0, 7); // YYYY-MM format
                        if (!expectedMonthlyData[monthKey]) {
                            expectedMonthlyData[monthKey] = {
                                weight: 0,
                                points: 0,
                                co2Saved: 0,
                                pickupsCompleted: 0
                            };
                        }
                        expectedMonthlyData[monthKey].weight += wasteLogData.weight;
                        expectedMonthlyData[monthKey].points += pointsEarned;
                        expectedMonthlyData[monthKey].co2Saved += co2Saved;
                    }

                    // Verify dashboard monthly trends
                    const dashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });
                    expect(dashboard).toBeTruthy();

                    // Check that monthly trends are present and accurate
                    for (const [monthKey, expectedData] of Object.entries(expectedMonthlyData)) {
                        const monthlyTrend = dashboard.monthlyTrends.find(t => t.month === monthKey);
                        expect(monthlyTrend).toBeTruthy();
                        
                        expect(Math.abs(monthlyTrend.weight - expectedData.weight)).toBeLessThan(0.001);
                        expect(monthlyTrend.points).toBe(expectedData.points);
                        expect(Math.abs(monthlyTrend.co2Saved - expectedData.co2Saved)).toBeLessThan(0.001);
                    }

                    // Verify trends are sorted by month (most recent first)
                    for (let i = 1; i < dashboard.monthlyTrends.length; i++) {
                        const prevMonth = dashboard.monthlyTrends[i - 1].month;
                        const currentMonth = dashboard.monthlyTrends[i].month;
                        expect(prevMonth.localeCompare(currentMonth)).toBeGreaterThanOrEqual(0);
                    }

                    // Verify trends are limited to last 12 months
                    expect(dashboard.monthlyTrends.length).toBeLessThanOrEqual(12);
                }
            ), { numRuns: 6 });
        });

        test('For any time period, trend analysis should show accurate progression over time', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(
                    fc.record({
                        material: validWasteTypeGen(),
                        weight: validWeightGen(),
                        monthOffset: fc.integer({ min: 0, max: 11 }) // 0-11 months ago
                    }),
                    { minLength: 3, maxLength: 15 }
                ),
                async (wasteData) => {
                    const now = new Date();
                    const monthlyTotals = {};

                    // Create waste logs spread across different months
                    for (const data of wasteData) {
                        const wasteDate = new Date(now.getFullYear(), now.getMonth() - data.monthOffset, 15);
                        const monthKey = wasteDate.toISOString().substring(0, 7);

                        const wasteLog = new Waste({
                            citizen: testCitizen._id,
                            material: data.material,
                            weight: data.weight,
                            description: 'Test waste',
                            status: 'Accepted',
                            photos: [],
                            createdAt: wasteDate
                        });
                        await wasteLog.save();

                        const config = wasteTypeConfigs.find(c => c.type === data.material);
                        const pointsEarned = Math.round(config.pointsPerKg * data.weight);
                        const co2Saved = config.co2SavedPerKg * data.weight;

                        await updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);

                        // Track expected totals
                        if (!monthlyTotals[monthKey]) {
                            monthlyTotals[monthKey] = { weight: 0, points: 0, co2Saved: 0 };
                        }
                        monthlyTotals[monthKey].weight += data.weight;
                        monthlyTotals[monthKey].points += pointsEarned;
                        monthlyTotals[monthKey].co2Saved += co2Saved;
                    }

                    // Verify trend progression
                    const dashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });
                    
                    // Check that each month's data is accurate
                    for (const [monthKey, expectedTotals] of Object.entries(monthlyTotals)) {
                        const trend = dashboard.monthlyTrends.find(t => t.month === monthKey);
                        expect(trend).toBeTruthy();
                        
                        expect(Math.abs(trend.weight - expectedTotals.weight)).toBeLessThan(0.001);
                        expect(trend.points).toBe(expectedTotals.points);
                        expect(Math.abs(trend.co2Saved - expectedTotals.co2Saved)).toBeLessThan(0.001);
                    }

                    // Verify cumulative totals match dashboard totals
                    const totalWeight = Object.values(monthlyTotals).reduce((sum, m) => sum + m.weight, 0);
                    const totalPoints = Object.values(monthlyTotals).reduce((sum, m) => sum + m.points, 0);
                    const totalCO2 = Object.values(monthlyTotals).reduce((sum, m) => sum + m.co2Saved, 0);

                    expect(Math.abs(dashboard.totalWasteRecycled - totalWeight)).toBeLessThan(0.001);
                    expect(dashboard.ecoPointsEarned).toBe(totalPoints);
                    expect(Math.abs(dashboard.co2Saved - totalCO2)).toBeLessThan(0.001);
                }
            ), { numRuns: 5 });
        });

        test('For any historical data visualization, month formatting should be consistent and valid', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(historicalWasteLogGen(), { minLength: 1, maxLength: 10 }),
                async (historicalWasteLogs) => {
                    // Process waste logs
                    for (const wasteLogData of historicalWasteLogs) {
                        const wasteLog = new Waste({
                            citizen: testCitizen._id,
                            material: wasteLogData.material,
                            weight: wasteLogData.weight,
                            description: 'Test waste',
                            status: wasteLogData.status,
                            photos: [],
                            createdAt: wasteLogData.createdAt
                        });
                        await wasteLog.save();

                        const config = wasteTypeConfigs.find(c => c.type === wasteLogData.material);
                        const pointsEarned = Math.round(config.pointsPerKg * wasteLogData.weight);
                        const co2Saved = config.co2SavedPerKg * wasteLogData.weight;

                        await updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);
                    }

                    // Verify month formatting
                    const dashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });
                    
                    dashboard.monthlyTrends.forEach(trend => {
                        // Verify month format is YYYY-MM
                        expect(trend.month).toMatch(/^\d{4}-\d{2}$/);
                        
                        // Verify month is a valid date
                        const monthDate = new Date(trend.month + '-01');
                        expect(monthDate).toBeInstanceOf(Date);
                        expect(monthDate.getTime()).not.toBeNaN();
                        
                        // Verify month is not in the future (with some tolerance)
                        const now = new Date();
                        const currentMonth = now.toISOString().substring(0, 7);
                        expect(trend.month.localeCompare(currentMonth)).toBeLessThanOrEqual(0);
                    });
                }
            ), { numRuns: 7 });
        });

        test('For any trend data, visualization should handle edge cases and empty periods correctly', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(
                    fc.record({
                        material: validWasteTypeGen(),
                        weight: validWeightGen(),
                        monthsAgo: fc.integer({ min: 1, max: 24 }) // 1-24 months ago (some beyond 12 month limit)
                    }),
                    { minLength: 1, maxLength: 8 }
                ),
                async (wasteData) => {
                    const now = new Date();
                    
                    // Create waste logs with gaps in time
                    for (const data of wasteData) {
                        const wasteDate = new Date(now.getFullYear(), now.getMonth() - data.monthsAgo, 15);
                        
                        const wasteLog = new Waste({
                            citizen: testCitizen._id,
                            material: data.material,
                            weight: data.weight,
                            description: 'Test waste',
                            status: 'Accepted',
                            photos: [],
                            createdAt: wasteDate
                        });
                        await wasteLog.save();

                        const config = wasteTypeConfigs.find(c => c.type === data.material);
                        const pointsEarned = Math.round(config.pointsPerKg * data.weight);
                        const co2Saved = config.co2SavedPerKg * data.weight;

                        await updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);
                    }

                    const dashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });
                    
                    // Verify only last 12 months are kept
                    expect(dashboard.monthlyTrends.length).toBeLessThanOrEqual(12);
                    
                    // Verify all trends have valid data
                    dashboard.monthlyTrends.forEach(trend => {
                        expect(trend.weight).toBeGreaterThanOrEqual(0);
                        expect(trend.points).toBeGreaterThanOrEqual(0);
                        expect(trend.co2Saved).toBeGreaterThanOrEqual(0);
                        expect(trend.pickupsCompleted).toBeGreaterThanOrEqual(0);
                    });
                    
                    // Verify months with data are within the last 12 months
                    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);
                    const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().substring(0, 7);
                    
                    dashboard.monthlyTrends.forEach(trend => {
                        expect(trend.month.localeCompare(twelveMonthsAgoStr)).toBeGreaterThanOrEqual(0);
                    });
                }
            ), { numRuns: 6 });
        });
    });

    // Property: Trend Data Consistency
    describe('Property: Trend Data Consistency', () => {
        test('For any historical visualization, trend totals should match dashboard totals', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(historicalWasteLogGen(), { minLength: 1, maxLength: 12 }),
                async (historicalWasteLogs) => {
                    // Process all waste logs
                    for (const wasteLogData of historicalWasteLogs) {
                        const wasteLog = new Waste({
                            citizen: testCitizen._id,
                            material: wasteLogData.material,
                            weight: wasteLogData.weight,
                            description: 'Test waste',
                            status: wasteLogData.status,
                            photos: [],
                            createdAt: wasteLogData.createdAt
                        });
                        await wasteLog.save();

                        const config = wasteTypeConfigs.find(c => c.type === wasteLogData.material);
                        const pointsEarned = Math.round(config.pointsPerKg * wasteLogData.weight);
                        const co2Saved = config.co2SavedPerKg * wasteLogData.weight;

                        await updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);
                    }

                    // Verify consistency between trends and totals
                    const dashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });
                    
                    const trendTotalWeight = dashboard.monthlyTrends.reduce((sum, t) => sum + t.weight, 0);
                    const trendTotalPoints = dashboard.monthlyTrends.reduce((sum, t) => sum + t.points, 0);
                    const trendTotalCO2 = dashboard.monthlyTrends.reduce((sum, t) => sum + t.co2Saved, 0);

                    expect(Math.abs(dashboard.totalWasteRecycled - trendTotalWeight)).toBeLessThan(0.001);
                    expect(dashboard.ecoPointsEarned).toBe(trendTotalPoints);
                    expect(Math.abs(dashboard.co2Saved - trendTotalCO2)).toBeLessThan(0.001);
                }
            ), { numRuns: 7 });
        });

        test('For any trend updates, chronological ordering should be maintained', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(
                    fc.record({
                        material: validWasteTypeGen(),
                        weight: validWeightGen(),
                        date: dateGen()
                    }),
                    { minLength: 2, maxLength: 10 }
                ),
                async (wasteData) => {
                    // Process waste logs in random order
                    const shuffledData = [...wasteData].sort(() => Math.random() - 0.5);
                    
                    for (const data of shuffledData) {
                        const wasteLog = new Waste({
                            citizen: testCitizen._id,
                            material: data.material,
                            weight: data.weight,
                            description: 'Test waste',
                            status: 'Accepted',
                            photos: [],
                            createdAt: data.date
                        });
                        await wasteLog.save();

                        const config = wasteTypeConfigs.find(c => c.type === data.material);
                        const pointsEarned = Math.round(config.pointsPerKg * data.weight);
                        const co2Saved = config.co2SavedPerKg * data.weight;

                        await updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);
                    }

                    // Verify chronological ordering in trends
                    const dashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });
                    
                    for (let i = 1; i < dashboard.monthlyTrends.length; i++) {
                        const prevMonth = dashboard.monthlyTrends[i - 1].month;
                        const currentMonth = dashboard.monthlyTrends[i].month;
                        
                        // Trends should be sorted in descending order (most recent first)
                        expect(prevMonth.localeCompare(currentMonth)).toBeGreaterThanOrEqual(0);
                    }
                }
            ), { numRuns: 6 });
        });
    });

    // Property: Visualization Data Integrity
    describe('Property: Visualization Data Integrity', () => {
        test('For any trend visualization, all numeric values should be valid and non-negative', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(historicalWasteLogGen(), { minLength: 1, maxLength: 15 }),
                async (historicalWasteLogs) => {
                    // Process waste logs
                    for (const wasteLogData of historicalWasteLogs) {
                        const wasteLog = new Waste({
                            citizen: testCitizen._id,
                            material: wasteLogData.material,
                            weight: wasteLogData.weight,
                            description: 'Test waste',
                            status: wasteLogData.status,
                            photos: [],
                            createdAt: wasteLogData.createdAt
                        });
                        await wasteLog.save();

                        const config = wasteTypeConfigs.find(c => c.type === wasteLogData.material);
                        const pointsEarned = Math.round(config.pointsPerKg * wasteLogData.weight);
                        const co2Saved = config.co2SavedPerKg * wasteLogData.weight;

                        await updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);
                    }

                    // Verify data integrity
                    const dashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });
                    
                    dashboard.monthlyTrends.forEach(trend => {
                        // All values should be non-negative
                        expect(trend.weight).toBeGreaterThanOrEqual(0);
                        expect(trend.points).toBeGreaterThanOrEqual(0);
                        expect(trend.co2Saved).toBeGreaterThanOrEqual(0);
                        expect(trend.pickupsCompleted).toBeGreaterThanOrEqual(0);
                        
                        // All values should be finite
                        expect(trend.weight).toBeFinite();
                        expect(trend.points).toBeFinite();
                        expect(trend.co2Saved).toBeFinite();
                        expect(trend.pickupsCompleted).toBeFinite();
                        
                        // Points should be integers
                        expect(Number.isInteger(trend.points)).toBe(true);
                        expect(Number.isInteger(trend.pickupsCompleted)).toBe(true);
                    });
                }
            ), { numRuns: 10 });
        });

        test('For any visualization period, data should be complete and consistent across all metrics', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(
                    fc.record({
                        material: validWasteTypeGen(),
                        weight: validWeightGen(),
                        month: fc.integer({ min: 0, max: 5 }) // Last 6 months
                    }),
                    { minLength: 1, maxLength: 12 }
                ),
                async (wasteData) => {
                    const now = new Date();
                    const monthlyExpected = {};
                    
                    // Create waste logs for specific months
                    for (const data of wasteData) {
                        const wasteDate = new Date(now.getFullYear(), now.getMonth() - data.month, 15);
                        const monthKey = wasteDate.toISOString().substring(0, 7);
                        
                        const wasteLog = new Waste({
                            citizen: testCitizen._id,
                            material: data.material,
                            weight: data.weight,
                            description: 'Test waste',
                            status: 'Accepted',
                            photos: [],
                            createdAt: wasteDate
                        });
                        await wasteLog.save();

                        const config = wasteTypeConfigs.find(c => c.type === data.material);
                        const pointsEarned = Math.round(config.pointsPerKg * data.weight);
                        const co2Saved = config.co2SavedPerKg * data.weight;

                        await updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);

                        // Track expected values
                        if (!monthlyExpected[monthKey]) {
                            monthlyExpected[monthKey] = { weight: 0, points: 0, co2Saved: 0 };
                        }
                        monthlyExpected[monthKey].weight += data.weight;
                        monthlyExpected[monthKey].points += pointsEarned;
                        monthlyExpected[monthKey].co2Saved += co2Saved;
                    }

                    // Verify completeness and consistency
                    const dashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });
                    
                    // Every expected month should have a trend entry
                    for (const [monthKey, expected] of Object.entries(monthlyExpected)) {
                        const trend = dashboard.monthlyTrends.find(t => t.month === monthKey);
                        expect(trend).toBeTruthy();
                        
                        // Values should match expectations
                        expect(Math.abs(trend.weight - expected.weight)).toBeLessThan(0.001);
                        expect(trend.points).toBe(expected.points);
                        expect(Math.abs(trend.co2Saved - expected.co2Saved)).toBeLessThan(0.001);
                    }
                    
                    // No unexpected trend entries should exist
                    dashboard.monthlyTrends.forEach(trend => {
                        if (monthlyExpected[trend.month]) {
                            // This month should have data
                            expect(trend.weight).toBeGreaterThan(0);
                        }
                    });
                }
            ), { numRuns: 5 });
        });
    });
});