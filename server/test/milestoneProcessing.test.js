import fc from 'fast-check';
import mongoose from 'mongoose';
import ImpactDashboard from '../models/ImpactDashboard.js';
import { Waste } from '../models/Waste.js';
import User from '../models/User.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';
import { updateDashboardForWasteLog, updateDashboardForPickup } from '../controllers/impactDashboardController.js';

// Feature: ecocycle-platform, Property 35: Milestone Processing
describe('Milestone Processing Property-Based Tests', () => {
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

    // Custom generators for milestone testing
    const validWasteTypeGen = () => fc.constantFrom('plastic', 'paper', 'metal');
    
    const smallWeightGen = () => fc.float({ min: Math.fround(0.1), max: Math.fround(2) }); // For gradual progress
    const mediumWeightGen = () => fc.float({ min: Math.fround(2), max: Math.fround(10) }); // For moderate progress
    const largeWeightGen = () => fc.float({ min: Math.fround(10), max: Math.fround(50) }); // For significant progress

    const wasteLogGen = (weightGen = smallWeightGen) => fc.record({
        material: validWasteTypeGen(),
        weight: weightGen()
    });

    // Property 35: Milestone Processing
    describe('Property 35: Milestone Processing', () => {
        test('For any citizen reaching an impact milestone, bonus EcoPoints should be awarded correctly', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(wasteLogGen(mediumWeightGen), { minLength: 1, maxLength: 15 }),
                async (wasteLogs) => {
                    let totalWeight = 0;
                    let totalPoints = 0;
                    let totalCO2 = 0;
                    const milestonesReached = new Set();

                    // Process waste logs and track milestones
                    for (const wasteLogData of wasteLogs) {
                        const wasteLog = new Waste({
                            citizenId: testCitizen._id,
                            wasteType: wasteLogData.material,
                            weight: wasteLogData.weight,
                            description: 'Test waste',
                            status: 'verified',
                            photos: []
                        });
                        await wasteLog.save();

                        const config = wasteTypeConfigs.find(c => c.type === wasteLogData.material);
                        const pointsEarned = Math.round(config.pointsPerKg * wasteLogData.weight);
                        const co2Saved = config.co2SavedPerKg * wasteLogData.weight;

                        totalWeight += wasteLogData.weight;
                        totalPoints += pointsEarned;
                        totalCO2 += co2Saved;

                        // Check which milestones should be reached
                        if (totalWeight >= 10 && !milestonesReached.has('first10kg')) {
                            milestonesReached.add('first10kg');
                        }
                        if (totalWeight >= 50 && !milestonesReached.has('first50kg')) {
                            milestonesReached.add('first50kg');
                        }
                        if (totalWeight >= 100 && !milestonesReached.has('first100kg')) {
                            milestonesReached.add('first100kg');
                        }
                        if (totalWeight >= 500 && !milestonesReached.has('ecoWarrior')) {
                            milestonesReached.add('ecoWarrior');
                        }
                        if (totalCO2 >= 100 && !milestonesReached.has('carbonSaver')) {
                            milestonesReached.add('carbonSaver');
                        }

                        await updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);
                    }

                    // Verify milestones are correctly marked as achieved
                    const dashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });
                    expect(dashboard).toBeTruthy();

                    // Check weight milestones
                    if (milestonesReached.has('first10kg')) {
                        expect(dashboard.milestones.first10kg.achieved).toBe(true);
                        expect(dashboard.milestones.first10kg.achievedAt).toBeInstanceOf(Date);
                    } else {
                        expect(dashboard.milestones.first10kg.achieved).toBe(false);
                    }

                    if (milestonesReached.has('first50kg')) {
                        expect(dashboard.milestones.first50kg.achieved).toBe(true);
                        expect(dashboard.milestones.first50kg.achievedAt).toBeInstanceOf(Date);
                    } else {
                        expect(dashboard.milestones.first50kg.achieved).toBe(false);
                    }

                    if (milestonesReached.has('first100kg')) {
                        expect(dashboard.milestones.first100kg.achieved).toBe(true);
                        expect(dashboard.milestones.first100kg.achievedAt).toBeInstanceOf(Date);
                    } else {
                        expect(dashboard.milestones.first100kg.achieved).toBe(false);
                    }

                    if (milestonesReached.has('ecoWarrior')) {
                        expect(dashboard.milestones.ecoWarrior.achieved).toBe(true);
                        expect(dashboard.milestones.ecoWarrior.achievedAt).toBeInstanceOf(Date);
                    } else {
                        expect(dashboard.milestones.ecoWarrior.achieved).toBe(false);
                    }

                    // Check CO2 milestone
                    if (milestonesReached.has('carbonSaver')) {
                        expect(dashboard.milestones.carbonSaver.achieved).toBe(true);
                        expect(dashboard.milestones.carbonSaver.achievedAt).toBeInstanceOf(Date);
                    } else {
                        expect(dashboard.milestones.carbonSaver.achieved).toBe(false);
                    }

                    // Verify achievements are created for reached milestones
                    if (totalWeight > 0) {
                        // First waste logged milestone should always be achieved
                        expect(dashboard.milestones.firstWasteLogged.achieved).toBe(true);
                        expect(dashboard.achievements.length).toBeGreaterThanOrEqual(1);
                    }
                }
            ), { numRuns: 7 });
        });

        test('For any milestone achievement, congratulatory notifications should be sent appropriately', () => {
            return fc.assert(fc.asyncProperty(
                fc.record({
                    targetWeight: fc.constantFrom(10, 50, 100, 500), // Milestone thresholds
                    wasteType: validWasteTypeGen()
                }),
                async ({ targetWeight, wasteType }) => {
                    // Create a waste log that will reach the milestone
                    const wasteLog = new Waste({
                        citizenId: testCitizen._id,
                        wasteType: wasteType,
                        weight: targetWeight,
                        description: 'Milestone test waste',
                        status: 'verified',
                        photos: []
                    });
                    await wasteLog.save();

                    const config = wasteTypeConfigs.find(c => c.type === wasteType);
                    const pointsEarned = Math.round(config.pointsPerKg * targetWeight);
                    const co2Saved = config.co2SavedPerKg * targetWeight;

                    // Update dashboard and check for new achievements
                    const dashboard = await ImpactDashboard.getOrCreateDashboard(testCitizen._id);
                    const initialAchievements = dashboard.achievements.length;

                    const newAchievements = await dashboard.updateWithWasteLog(wasteLog, pointsEarned, co2Saved);

                    // Verify new achievements were created
                    expect(newAchievements).toBeInstanceOf(Array);
                    expect(dashboard.achievements.length).toBeGreaterThan(initialAchievements);

                    // Verify achievement properties
                    newAchievements.forEach(achievement => {
                        expect(achievement.name).toBeTruthy();
                        expect(achievement.description).toBeTruthy();
                        expect(achievement.icon).toBeTruthy();
                        expect(['common', 'rare', 'epic', 'legendary']).toContain(achievement.rarity);
                        expect(achievement.unlockedAt).toBeInstanceOf(Date);
                    });

                    // Verify milestone-specific achievements
                    const milestoneAchievements = newAchievements.filter(a => 
                        ['Getting Started', 'Eco Enthusiast', 'Recycling Champion', 'Eco Warrior'].includes(a.name)
                    );

                    if (targetWeight >= 10) {
                        expect(milestoneAchievements.some(a => a.name === 'Getting Started')).toBe(true);
                    }
                    if (targetWeight >= 50) {
                        expect(milestoneAchievements.some(a => a.name === 'Eco Enthusiast')).toBe(true);
                    }
                    if (targetWeight >= 100) {
                        expect(milestoneAchievements.some(a => a.name === 'Recycling Champion')).toBe(true);
                    }
                    if (targetWeight >= 500) {
                        expect(milestoneAchievements.some(a => a.name === 'Eco Warrior')).toBe(true);
                    }
                }
            ), { numRuns: 5 });
        });

        test('For any pickup completion milestones, achievements should be awarded correctly', () => {
            return fc.assert(fc.asyncProperty(
                fc.integer({ min: 1, max: 60 }), // Number of pickups to simulate
                async (numPickups) => {
                    const dashboard = await ImpactDashboard.getOrCreateDashboard(testCitizen._id);
                    let totalAchievements = 0;

                    // Simulate pickup completions
                    for (let i = 1; i <= numPickups; i++) {
                        const mockPickup = { _id: new mongoose.Types.ObjectId() };
                        const newAchievements = await dashboard.updateWithPickup(mockPickup);
                        totalAchievements += newAchievements.length;

                        // Check milestone achievements at specific thresholds
                        if (i === 10) {
                            expect(dashboard.milestones.first10Pickups.achieved).toBe(true);
                            expect(dashboard.milestones.first10Pickups.achievedAt).toBeInstanceOf(Date);
                            expect(newAchievements.some(a => a.name === 'Pickup Pro')).toBe(true);
                        }
                        
                        if (i === 50) {
                            expect(dashboard.milestones.first50Pickups.achieved).toBe(true);
                            expect(dashboard.milestones.first50Pickups.achievedAt).toBeInstanceOf(Date);
                            expect(newAchievements.some(a => a.name === 'Collection Master')).toBe(true);
                        }
                    }

                    // Verify final state
                    expect(dashboard.pickupsCompleted).toBe(numPickups);
                    
                    if (numPickups >= 10) {
                        expect(dashboard.milestones.first10Pickups.achieved).toBe(true);
                    }
                    if (numPickups >= 50) {
                        expect(dashboard.milestones.first50Pickups.achieved).toBe(true);
                    }

                    // Verify achievements were created
                    expect(dashboard.achievements.length).toBeGreaterThanOrEqual(totalAchievements);
                }
            ), { numRuns: 6 });
        });

        test('For any streak milestones, achievements should be awarded based on consecutive activity', () => {
            return fc.assert(fc.asyncProperty(
                fc.integer({ min: 1, max: 40 }), // Days of activity
                async (streakDays) => {
                    const dashboard = await ImpactDashboard.getOrCreateDashboard(testCitizen._id);
                    const baseDate = new Date();

                    // Simulate consecutive daily activity
                    for (let day = 0; day < streakDays; day++) {
                        const activityDate = new Date(baseDate.getTime() - (streakDays - day - 1) * 24 * 60 * 60 * 1000);
                        
                        const wasteLog = new Waste({
                            citizenId: testCitizen._id,
                            wasteType: 'plastic',
                            weight: 1.0,
                            description: 'Daily activity',
                            status: 'verified',
                            photos: [],
                            createdAt: activityDate
                        });
                        await wasteLog.save();

                        const config = wasteTypeConfigs.find(c => c.type === 'plastic');
                        const pointsEarned = Math.round(config.pointsPerKg * 1.0);
                        const co2Saved = config.co2SavedPerKg * 1.0;

                        await dashboard.updateWithWasteLog(wasteLog, pointsEarned, co2Saved);
                    }

                    // Verify streak calculation
                    expect(dashboard.currentStreak).toBeLessThanOrEqual(streakDays);
                    expect(dashboard.longestStreak).toBeLessThanOrEqual(streakDays);

                    // Check streak milestones
                    if (streakDays >= 7) {
                        expect(dashboard.milestones.weekStreak.achieved).toBe(true);
                        expect(dashboard.milestones.weekStreak.achievedAt).toBeInstanceOf(Date);
                        expect(dashboard.achievements.some(a => a.name === 'Week Warrior')).toBe(true);
                    }

                    if (streakDays >= 30) {
                        expect(dashboard.milestones.monthStreak.achieved).toBe(true);
                        expect(dashboard.milestones.monthStreak.achievedAt).toBeInstanceOf(Date);
                        expect(dashboard.achievements.some(a => a.name === 'Consistency King')).toBe(true);
                    }
                }
            ), { numRuns: 5 });
        });
    });

    // Property: Milestone State Management
    describe('Property: Milestone State Management', () => {
        test('For any milestone achievement, the milestone should only be awarded once', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(wasteLogGen(largeWeightGen), { minLength: 2, maxLength: 8 }),
                async (wasteLogs) => {
                    const dashboard = await ImpactDashboard.getOrCreateDashboard(testCitizen._id);
                    const milestoneTracker = {};

                    // Process waste logs and track milestone achievements
                    for (const wasteLogData of wasteLogs) {
                        const wasteLog = new Waste({
                            citizenId: testCitizen._id,
                            wasteType: wasteLogData.material,
                            weight: wasteLogData.weight,
                            description: 'Test waste',
                            status: 'verified',
                            photos: []
                        });
                        await wasteLog.save();

                        const config = wasteTypeConfigs.find(c => c.type === wasteLogData.material);
                        const pointsEarned = Math.round(config.pointsPerKg * wasteLogData.weight);
                        const co2Saved = config.co2SavedPerKg * wasteLogData.weight;

                        const newAchievements = await dashboard.updateWithWasteLog(wasteLog, pointsEarned, co2Saved);

                        // Track when milestones are first achieved
                        newAchievements.forEach(achievement => {
                            if (!milestoneTracker[achievement.name]) {
                                milestoneTracker[achievement.name] = 1;
                            } else {
                                milestoneTracker[achievement.name]++;
                            }
                        });
                    }

                    // Verify each milestone achievement appears only once
                    Object.entries(milestoneTracker).forEach(([achievementName, count]) => {
                        expect(count).toBe(1);
                    });

                    // Verify milestone flags remain true once achieved
                    if (dashboard.totalWasteRecycled >= 10) {
                        expect(dashboard.milestones.first10kg.achieved).toBe(true);
                    }
                    if (dashboard.totalWasteRecycled >= 50) {
                        expect(dashboard.milestones.first50kg.achieved).toBe(true);
                    }
                    if (dashboard.totalWasteRecycled >= 100) {
                        expect(dashboard.milestones.first100kg.achieved).toBe(true);
                    }
                }
            ), { numRuns: 6 });
        });

        test('For any milestone processing, achievement timestamps should be accurate and chronological', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(
                    fc.record({
                        material: validWasteTypeGen(),
                        weight: fc.float({ min: Math.fround(15), max: Math.fround(30) }), // Weights that will trigger milestones
                        delay: fc.integer({ min: 10, max: 100 }) // Milliseconds delay between operations
                    }),
                    { minLength: 2, maxLength: 5 }
                ),
                async (wasteOperations) => {
                    const dashboard = await ImpactDashboard.getOrCreateDashboard(testCitizen._id);
                    const achievementTimes = [];

                    // Process operations with delays
                    for (const operation of wasteOperations) {
                        const wasteLog = new Waste({
                            citizenId: testCitizen._id,
                            wasteType: operation.material,
                            weight: operation.weight,
                            description: 'Timed test waste',
                            status: 'verified',
                            photos: []
                        });
                        await wasteLog.save();

                        const config = wasteTypeConfigs.find(c => c.type === operation.material);
                        const pointsEarned = Math.round(config.pointsPerKg * operation.weight);
                        const co2Saved = config.co2SavedPerKg * operation.weight;

                        const beforeTime = new Date();
                        const newAchievements = await dashboard.updateWithWasteLog(wasteLog, pointsEarned, co2Saved);
                        const afterTime = new Date();

                        // Record achievement times
                        newAchievements.forEach(achievement => {
                            achievementTimes.push({
                                name: achievement.name,
                                time: achievement.unlockedAt,
                                beforeTime,
                                afterTime
                            });
                        });

                        // Add delay between operations
                        await new Promise(resolve => setTimeout(resolve, operation.delay));
                    }

                    // Verify timestamps are within expected ranges
                    achievementTimes.forEach(({ time, beforeTime, afterTime }) => {
                        expect(time.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
                        expect(time.getTime()).toBeLessThanOrEqual(afterTime.getTime());
                    });

                    // Verify chronological order if multiple achievements
                    if (achievementTimes.length > 1) {
                        for (let i = 1; i < achievementTimes.length; i++) {
                            expect(achievementTimes[i].time.getTime()).toBeGreaterThanOrEqual(
                                achievementTimes[i - 1].time.getTime()
                            );
                        }
                    }

                    // Verify milestone timestamps match achievement timestamps
                    if (dashboard.milestones.first10kg.achieved) {
                        const achievement = dashboard.achievements.find(a => a.name === 'Getting Started');
                        if (achievement) {
                            expect(dashboard.milestones.first10kg.achievedAt.getTime()).toBe(
                                achievement.unlockedAt.getTime()
                            );
                        }
                    }
                }
            ), { numRuns: 5 });
        });
    });

    // Property: Milestone Data Integrity
    describe('Property: Milestone Data Integrity', () => {
        test('For any milestone system, all milestone data should be consistent and valid', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(wasteLogGen(mediumWeightGen), { minLength: 1, maxLength: 10 }),
                async (wasteLogs) => {
                    // Process waste logs
                    for (const wasteLogData of wasteLogs) {
                        const wasteLog = new Waste({
                            citizenId: testCitizen._id,
                            wasteType: wasteLogData.material,
                            weight: wasteLogData.weight,
                            description: 'Test waste',
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

                    // Verify milestone structure integrity
                    expect(dashboard.milestones).toBeTruthy();
                    expect(typeof dashboard.milestones).toBe('object');

                    // Check all expected milestones exist
                    const expectedMilestones = [
                        'firstWasteLogged', 'first10kg', 'first50kg', 'first100kg',
                        'first10Pickups', 'first50Pickups', 'weekStreak', 'monthStreak',
                        'ecoWarrior', 'carbonSaver'
                    ];

                    expectedMilestones.forEach(milestone => {
                        expect(dashboard.milestones[milestone]).toBeTruthy();
                        expect(typeof dashboard.milestones[milestone].achieved).toBe('boolean');
                        
                        if (dashboard.milestones[milestone].achieved) {
                            expect(dashboard.milestones[milestone].achievedAt).toBeInstanceOf(Date);
                        }
                    });

                    // Verify achievement array integrity
                    expect(Array.isArray(dashboard.achievements)).toBe(true);
                    
                    dashboard.achievements.forEach(achievement => {
                        expect(achievement.name).toBeTruthy();
                        expect(achievement.description).toBeTruthy();
                        expect(achievement.icon).toBeTruthy();
                        expect(['common', 'rare', 'epic', 'legendary']).toContain(achievement.rarity);
                        expect(achievement.unlockedAt).toBeInstanceOf(Date);
                    });

                    // Verify logical consistency
                    if (dashboard.milestones.first50kg.achieved) {
                        expect(dashboard.milestones.first10kg.achieved).toBe(true);
                    }
                    if (dashboard.milestones.first100kg.achieved) {
                        expect(dashboard.milestones.first50kg.achieved).toBe(true);
                        expect(dashboard.milestones.first10kg.achieved).toBe(true);
                    }
                    if (dashboard.milestones.ecoWarrior.achieved) {
                        expect(dashboard.milestones.first100kg.achieved).toBe(true);
                    }
                }
            ), { numRuns: 7 });
        });

        test('For any milestone achievement, the system should handle concurrent updates correctly', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(wasteLogGen(largeWeightGen), { minLength: 2, maxLength: 4 }),
                async (wasteLogs) => {
                    // Create all waste logs first
                    const createdWasteLogs = [];
                    for (const wasteLogData of wasteLogs) {
                        const wasteLog = new Waste({
                            citizenId: testCitizen._id,
                            wasteType: wasteLogData.material,
                            weight: wasteLogData.weight,
                            description: 'Concurrent test waste',
                            status: 'verified',
                            photos: []
                        });
                        await wasteLog.save();
                        createdWasteLogs.push(wasteLog);
                    }

                    // Process updates concurrently
                    const updatePromises = createdWasteLogs.map(async (wasteLog) => {
                        const config = wasteTypeConfigs.find(c => c.type === wasteLog.wasteType);
                        const pointsEarned = Math.round(config.pointsPerKg * wasteLog.weight);
                        const co2Saved = config.co2SavedPerKg * wasteLog.weight;

                        return updateDashboardForWasteLog(testCitizen._id, wasteLog, pointsEarned, co2Saved);
                    });

                    await Promise.all(updatePromises);

                    // Verify final state is consistent
                    const dashboard = await ImpactDashboard.findOne({ citizenId: testCitizen._id });
                    
                    // Calculate expected totals
                    const expectedWeight = wasteLogs.reduce((sum, w) => sum + w.weight, 0);
                    const expectedPoints = wasteLogs.reduce((sum, w) => {
                        const config = wasteTypeConfigs.find(c => c.type === w.material);
                        return sum + Math.round(config.pointsPerKg * w.weight);
                    }, 0);

                    expect(Math.abs(dashboard.totalWasteRecycled - expectedWeight)).toBeLessThan(0.001);
                    expect(dashboard.ecoPointsEarned).toBe(expectedPoints);

                    // Verify milestones are correctly achieved
                    if (expectedWeight >= 10) {
                        expect(dashboard.milestones.first10kg.achieved).toBe(true);
                    }
                    if (expectedWeight >= 50) {
                        expect(dashboard.milestones.first50kg.achieved).toBe(true);
                    }
                    if (expectedWeight >= 100) {
                        expect(dashboard.milestones.first100kg.achieved).toBe(true);
                    }

                    // Verify no duplicate achievements
                    const achievementNames = dashboard.achievements.map(a => a.name);
                    const uniqueNames = [...new Set(achievementNames)];
                    expect(achievementNames.length).toBe(uniqueNames.length);
                }
            ), { numRuns: 5 });
        });
    });
});