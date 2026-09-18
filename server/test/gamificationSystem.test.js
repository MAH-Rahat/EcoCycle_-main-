import { jest } from '@jest/globals';
import fc from 'fast-check';
import mongoose from 'mongoose';
import Achievement from '../models/Achievement.js';
import UserAchievement from '../models/UserAchievement.js';
import Challenge from '../models/Challenge.js';
import UserChallenge from '../models/UserChallenge.js';
import Leaderboard from '../models/Leaderboard.js';
import EcoPointsWallet from '../models/EcoPointsWallet.js';
import ImpactDashboard from '../models/ImpactDashboard.js';
import User from '../models/User.js';
import GamificationService from '../services/gamificationService.js';

// Feature: ecocycle-platform, Property 39: Challenge Completion Rewards
// **Validates: Requirements 10.4**

describe('Gamification System Tests', () => {
    let testCitizenId;
    let testChallenge;
    let testAchievement;

    beforeEach(async () => {
        // Clean up collections
        await Promise.all([
            Achievement.deleteMany({}),
            UserAchievement.deleteMany({}),
            Challenge.deleteMany({}),
            UserChallenge.deleteMany({}),
            Leaderboard.deleteMany({}),
            EcoPointsWallet.deleteMany({}),
            ImpactDashboard.deleteMany({}),
            User.deleteMany({})
        ]);

        testCitizenId = new mongoose.Types.ObjectId();

        // Create test user
        await User.create({
            _id: testCitizenId,
            name: 'Test User',
            username: 'testuser',
            email: 'test@example.com',
            password: 'hashedpassword',
            role: 'citizen',
            profile: {
                firstName: 'Test',
                lastName: 'User',
                addresses: [{
                    street: '123 Test St',
                    city: 'Test City',
                    zipCode: '12345',
                    coordinates: {
                        type: 'Point',
                        coordinates: [-74.0060, 40.7128] // [longitude, latitude]
                    },
                    isDefault: true
                }],
                preferences: {
                    privacy: {
                        showInLeaderboard: true,
                        showFullName: true
                    }
                }
            },
            isActive: true
        });

        // Create test challenge
        testChallenge = await Challenge.create({
            title: 'Test Weekly Challenge',
            description: 'Recycle 10kg of waste this week',
            type: 'weekly',
            target: {
                metric: 'weight',
                value: 10,
                wasteTypes: []
            },
            reward: {
                points: 100,
                badge: 'Weekly Champion'
            },
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
            endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
            isActive: true,
            participants: [testCitizenId],
            area: undefined // Explicitly avoid area field to prevent geospatial issues
        });

        // Create test achievement
        testAchievement = await Achievement.create({
            name: 'Test Achievement',
            description: 'Test achievement for recycling',
            icon: '🏆',
            rarity: 'common',
            category: 'waste',
            criteria: {
                type: 'weight',
                value: 5
            },
            reward: {
                points: 50,
                badge: 'Recycler'
            },
            isActive: true
        });

        // Create user challenge
        await UserChallenge.create({
            citizenId: testCitizenId,
            challengeId: testChallenge._id,
            progress: 0,
            progressDetails: {
                totalWeight: 0,
                totalPickups: 0,
                totalPoints: 0,
                currentStreak: 0,
                wasteTypeBreakdown: []
            }
        });

        // Create wallet and dashboard
        await EcoPointsWallet.create({
            citizenId: testCitizenId,
            balance: 0,
            totalEarned: 0,
            totalSpent: 0,
            transactions: []
        });

        await ImpactDashboard.create({
            citizenId: testCitizenId,
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
    });

    afterEach(async () => {
        await Promise.all([
            Achievement.deleteMany({}),
            UserAchievement.deleteMany({}),
            Challenge.deleteMany({}),
            UserChallenge.deleteMany({}),
            Leaderboard.deleteMany({}),
            EcoPointsWallet.deleteMany({}),
            ImpactDashboard.deleteMany({}),
            User.deleteMany({})
        ]);
    });

    describe('Property 39: Challenge Completion Rewards', () => {
        test('should award bonus EcoPoints and update achievements when challenge is completed', 
            async () => {
                await fc.assert(
                    fc.asyncProperty(
                        fc.float({ min: 10, max: 100 }), // weight that completes challenge
                        fc.constantFrom('Plastic', 'paper', 'glass', 'metal', 'organic', 'electronic', 'hazardous'), // waste type
                        async (completionWeight, wasteType) => {
                            // Create a fresh challenge for this test iteration to avoid state pollution
                            const iterationChallenge = await Challenge.create({
                                title: `Test Challenge ${Date.now()}`,
                                description: 'Recycle 10kg of waste',
                                type: 'weekly',
                                target: {
                                    metric: 'weight',
                                    value: 10
                                },
                                reward: {
                                    points: 100,
                                    badge: 'Test Champion'
                                },
                                startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
                                endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
                                isActive: true,
                                participants: [testCitizenId]
                            });

                            // Create fresh user challenge
                            const iterationUserChallenge = await UserChallenge.create({
                                citizenId: testCitizenId,
                                challengeId: iterationChallenge._id,
                                progress: 0,
                                progressDetails: {
                                    totalWeight: 0,
                                    totalPickups: 0,
                                    totalPoints: 0,
                                    currentStreak: 0,
                                    wasteTypeBreakdown: []
                                }
                            });

                            // Process activity that completes the challenge
                            const activityData = {
                                type: 'waste_logged',
                                wasteType: wasteType,
                                weight: completionWeight,
                                points: Math.floor(completionWeight * 2)
                            };

                            const initialWallet = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                            const initialBalance = initialWallet.balance;

                            // Award regular points for waste logging first (simulating the normal flow)
                            if (activityData.points > 0) {
                                await initialWallet.addPoints(
                                    activityData.points,
                                    `Waste logged: ${activityData.weight}kg of ${activityData.wasteType}`,
                                    null,
                                    'waste'
                                );
                            }

                            // Process the activity for gamification (challenges, achievements)
                            await GamificationService.processUserActivity(testCitizenId, activityData);

                            // Verify challenge completion
                            const updatedUserChallenge = await UserChallenge.findOne({
                                citizenId: testCitizenId,
                                challengeId: iterationChallenge._id
                            });

                            if (completionWeight >= iterationChallenge.target.value) {
                                // Challenge should be completed
                                expect(updatedUserChallenge.completed).toBe(true);
                                expect(updatedUserChallenge.completedAt).toBeDefined();

                                // Verify bonus points were awarded
                                const updatedWallet = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                                
                                // Check for challenge completion bonus transaction
                                const bonusTransaction = updatedWallet.transactions.find(
                                    t => t.type === 'bonus' && 
                                         t.description.includes('Challenge completed') &&
                                         t.relatedId && t.relatedId.equals(iterationChallenge._id)
                                );
                                expect(bonusTransaction).toBeDefined();
                                expect(bonusTransaction.amount).toBe(iterationChallenge.reward.points);
                                expect(bonusTransaction.relatedType).toBe('challenge');

                                // Verify wallet balance increased
                                expect(updatedWallet.balance).toBeGreaterThan(initialBalance);

                                // Verify achievement was added if badge is awarded
                                if (iterationChallenge.reward.badge) {
                                    const updatedDashboard = await ImpactDashboard.findOne({ citizenId: testCitizenId });
                                    const challengeAchievement = updatedDashboard.achievements.find(
                                        a => a.name === iterationChallenge.reward.badge &&
                                             a.description.includes(iterationChallenge.title)
                                    );
                                    expect(challengeAchievement).toBeDefined();
                                    expect(challengeAchievement.icon).toBe('trophy');
                                    expect(challengeAchievement.unlockedAt).toBeDefined();
                                    expect(['common', 'rare', 'epic', 'legendary']).toContain(challengeAchievement.rarity);
                                }
                            } else {
                                // Challenge should not be completed yet
                                expect(updatedUserChallenge.completed).toBe(false);
                                expect(updatedUserChallenge.completedAt).toBeUndefined();

                                // No challenge completion bonus should be awarded
                                const updatedWallet = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                                const challengeBonusTransactions = updatedWallet.transactions.filter(
                                    t => t.type === 'bonus' && 
                                         t.description.includes('Challenge completed') &&
                                         t.relatedId && t.relatedId.equals(iterationChallenge._id)
                                );
                                expect(challengeBonusTransactions.length).toBe(0);

                                // Should still have regular points
                                const expectedBalance = initialBalance + activityData.points;
                                expect(updatedWallet.balance).toBe(expectedBalance);
                            }

                            // Progress should be updated regardless
                            expect(updatedUserChallenge.progress).toBeGreaterThanOrEqual(0);
                            expect(updatedUserChallenge.progress).toBe(completionWeight);

                            // Clean up iteration-specific data
                            await Challenge.findByIdAndDelete(iterationChallenge._id);
                            await UserChallenge.findByIdAndDelete(iterationUserChallenge._id);
                        }
                    ),
                    { numRuns: 5 }
                );
            },
            10000 // Increase timeout for property-based test
        );

        test('should handle multiple challenge completions correctly',
            async () => {
                // Create additional challenge
                const secondChallenge = await Challenge.create({
                    title: 'Pickup Challenge',
                    description: 'Complete 3 pickups',
                    type: 'weekly',
                    target: {
                        metric: 'pickups',
                        value: 3
                    },
                    reward: {
                        points: 75,
                        badge: 'Pickup Master'
                    },
                    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
                    isActive: true,
                    participants: [testCitizenId]
                });

                await UserChallenge.create({
                    citizenId: testCitizenId,
                    challengeId: secondChallenge._id,
                    progress: 0,
                    progressDetails: {
                        totalWeight: 0,
                        totalPickups: 0,
                        totalPoints: 0,
                        currentStreak: 0,
                        wasteTypeBreakdown: []
                    }
                });

                const initialWallet = await EcoPointsWallet.findOne({ citizenId: testCitizenId });

                // Complete weight challenge with regular points
                const wasteActivity = {
                    type: 'waste_logged',
                    wasteType: 'Plastic',
                    weight: 15, // Completes weight challenge
                    points: 30
                };

                await initialWallet.addPoints(
                    wasteActivity.points,
                    `Waste logged: ${wasteActivity.weight}kg of ${wasteActivity.wasteType}`,
                    null,
                    'waste'
                );

                await GamificationService.processUserActivity(testCitizenId, wasteActivity);

                // Complete pickup challenge
                for (let i = 0; i < 3; i++) {
                    const pickupActivity = {
                        type: 'pickup_completed',
                        pickupId: new mongoose.Types.ObjectId(),
                        weight: 5,
                        points: 10
                    };

                    const currentWallet = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                    await currentWallet.addPoints(
                        pickupActivity.points,
                        `Pickup completed: ${pickupActivity.weight}kg collected`,
                        pickupActivity.pickupId,
                        'pickup'
                    );

                    await GamificationService.processUserActivity(testCitizenId, pickupActivity);
                }

                // Verify both challenges completed
                const completedChallenges = await UserChallenge.find({
                    citizenId: testCitizenId,
                    completed: true
                });

                expect(completedChallenges.length).toBe(2);

                // Verify total bonus points from challenges only
                const finalWallet = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                const totalBonusExpected = testChallenge.reward.points + secondChallenge.reward.points;
                
                const bonusTransactions = finalWallet.transactions.filter(
                    t => t.type === 'bonus' && t.description.includes('Challenge completed')
                );
                
                const totalBonusReceived = bonusTransactions.reduce((sum, t) => sum + t.amount, 0);
                expect(totalBonusReceived).toBe(totalBonusExpected);

                // Verify each challenge has its own bonus transaction
                const weightChallengeBonusTransactions = bonusTransactions.filter(
                    t => t.relatedId && t.relatedId.equals(testChallenge._id)
                );
                const pickupChallengeBonusTransactions = bonusTransactions.filter(
                    t => t.relatedId && t.relatedId.equals(secondChallenge._id)
                );

                expect(weightChallengeBonusTransactions.length).toBe(1);
                expect(pickupChallengeBonusTransactions.length).toBe(1);
                expect(weightChallengeBonusTransactions[0].amount).toBe(testChallenge.reward.points);
                expect(pickupChallengeBonusTransactions[0].amount).toBe(secondChallenge.reward.points);
            }
        );

        test('should correctly award different reward types for various challenge metrics', 
            async () => {
                await fc.assert(
                    fc.asyncProperty(
                        fc.constantFrom('weight', 'pickups', 'points', 'streak'),
                        fc.integer({ min: 50, max: 300 }), // reward points
                        fc.option(fc.string({ minLength: 5, maxLength: 20 })), // optional badge
                        async (metric, rewardPoints, badge) => {
                            // Create challenge with specific metric and reward
                            const dynamicChallenge = await Challenge.create({
                                title: `Dynamic ${metric} Challenge`,
                                description: `Test challenge for ${metric} metric`,
                                type: 'weekly',
                                target: {
                                    metric: metric,
                                    value: metric === 'streak' ? 3 : 5 // Lower value for streak
                                },
                                reward: {
                                    points: rewardPoints,
                                    badge: badge
                                },
                                startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
                                endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
                                isActive: true,
                                participants: [testCitizenId]
                            });

                            // Create user challenge
                            await UserChallenge.create({
                                citizenId: testCitizenId,
                                challengeId: dynamicChallenge._id,
                                progress: 0,
                                progressDetails: {
                                    totalWeight: 0,
                                    totalPickups: 0,
                                    totalPoints: 0,
                                    currentStreak: 0,
                                    wasteTypeBreakdown: []
                                }
                            });

                            const initialWallet = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                            const initialDashboard = await ImpactDashboard.findOne({ citizenId: testCitizenId });
                            const initialAchievementCount = initialDashboard.achievements.length;

                            // Complete challenge based on metric type
                            let activityData;
                            switch (metric) {
                                case 'weight':
                                    activityData = {
                                        type: 'waste_logged',
                                        wasteType: 'Plastic',
                                        weight: 10, // Exceeds target of 5
                                        points: 20
                                    };
                                    // Award regular points
                                    await initialWallet.addPoints(
                                        activityData.points,
                                        `Waste logged: ${activityData.weight}kg of ${activityData.wasteType}`,
                                        null,
                                        'waste'
                                    );
                                    await GamificationService.processUserActivity(testCitizenId, activityData);
                                    break;
                                case 'pickups':
                                    // Complete multiple pickups
                                    for (let i = 0; i < 6; i++) { // Exceeds target of 5
                                        const pickupActivity = {
                                            type: 'pickup_completed',
                                            pickupId: new mongoose.Types.ObjectId(),
                                            weight: 2,
                                            points: 5
                                        };
                                        const currentWallet = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                                        await currentWallet.addPoints(
                                            pickupActivity.points,
                                            `Pickup completed: ${pickupActivity.weight}kg collected`,
                                            pickupActivity.pickupId,
                                            'pickup'
                                        );
                                        await GamificationService.processUserActivity(testCitizenId, pickupActivity);
                                    }
                                    break;
                                case 'points':
                                    activityData = {
                                        type: 'waste_logged',
                                        wasteType: 'paper',
                                        weight: 3,
                                        points: 10 // Exceeds target of 5
                                    };
                                    // Award regular points
                                    await initialWallet.addPoints(
                                        activityData.points,
                                        `Waste logged: ${activityData.weight}kg of ${activityData.wasteType}`,
                                        null,
                                        'waste'
                                    );
                                    await GamificationService.processUserActivity(testCitizenId, activityData);
                                    break;
                                case 'streak':
                                    activityData = {
                                        type: 'streak_updated',
                                        streak: 5 // Exceeds target of 3
                                    };
                                    await GamificationService.processUserActivity(testCitizenId, activityData);
                                    break;
                            }

                            // Verify challenge completion
                            const completedUserChallenge = await UserChallenge.findOne({
                                citizenId: testCitizenId,
                                challengeId: dynamicChallenge._id
                            });

                            expect(completedUserChallenge.completed).toBe(true);
                            expect(completedUserChallenge.completedAt).toBeDefined();

                            // Verify bonus points awarded
                            const finalWallet = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                            const challengeBonusTransaction = finalWallet.transactions.find(
                                t => t.type === 'bonus' && 
                                     t.relatedId && t.relatedId.equals(dynamicChallenge._id) &&
                                     t.relatedType === 'challenge'
                            );

                            expect(challengeBonusTransaction).toBeDefined();
                            expect(challengeBonusTransaction.amount).toBe(rewardPoints);
                            expect(challengeBonusTransaction.description).toContain(dynamicChallenge.title);

                            // Verify badge achievement if provided
                            if (badge) {
                                const finalDashboard = await ImpactDashboard.findOne({ citizenId: testCitizenId });
                                expect(finalDashboard.achievements.length).toBeGreaterThan(initialAchievementCount);
                                
                                const badgeAchievement = finalDashboard.achievements.find(
                                    a => a.name === badge && a.description.includes(dynamicChallenge.title)
                                );
                                expect(badgeAchievement).toBeDefined();
                                expect(badgeAchievement.icon).toBe('trophy');
                                expect(badgeAchievement.unlockedAt).toBeDefined();
                            }

                            // Clean up dynamic challenge
                            await Challenge.findByIdAndDelete(dynamicChallenge._id);
                            await UserChallenge.deleteMany({ challengeId: dynamicChallenge._id });
                        }
                    ),
                    { numRuns: 5 }
                );
            }
        );

        test('should maintain transaction integrity and prevent duplicate rewards', 
            async () => {
                await fc.assert(
                    fc.asyncProperty(
                        fc.float({ min: 10, max: 50 }), // completion weight
                        async (completionWeight) => {
                            const initialWallet = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                            const initialTransactionCount = initialWallet.transactions.length;

                            // Award regular points and complete challenge
                            const activityData = {
                                type: 'waste_logged',
                                wasteType: 'Plastic',
                                weight: completionWeight,
                                points: Math.floor(completionWeight * 2)
                            };

                            // Award regular points first
                            await initialWallet.addPoints(
                                activityData.points,
                                `Waste logged: ${activityData.weight}kg of ${activityData.wasteType}`,
                                null,
                                'waste'
                            );

                            // Process gamification
                            await GamificationService.processUserActivity(testCitizenId, activityData);

                            // Try to process additional activity (should not duplicate challenge rewards)
                            const additionalActivity = {
                                type: 'waste_logged',
                                wasteType: 'glass',
                                weight: 1, // Small additional weight
                                points: 2
                            };

                            const walletAfterFirst = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                            await walletAfterFirst.addPoints(
                                additionalActivity.points,
                                `Waste logged: ${additionalActivity.weight}kg of ${additionalActivity.wasteType}`,
                                null,
                                'waste'
                            );

                            await GamificationService.processUserActivity(testCitizenId, additionalActivity);

                            const finalWallet = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                            
                            // Count challenge completion bonus transactions
                            const challengeBonusTransactions = finalWallet.transactions.filter(
                                t => t.type === 'bonus' && 
                                     t.description.includes('Challenge completed') &&
                                     t.relatedId && t.relatedId.equals(testChallenge._id)
                            );

                            if (completionWeight >= testChallenge.target.value) {
                                // Should have exactly one challenge completion bonus
                                expect(challengeBonusTransactions.length).toBe(1);
                                expect(challengeBonusTransactions[0].amount).toBe(testChallenge.reward.points);
                                
                                // Verify wallet balance consistency
                                const totalEarned = finalWallet.transactions
                                    .filter(t => t.type === 'earned' || t.type === 'bonus')
                                    .reduce((sum, t) => sum + t.amount, 0);
                                const totalSpent = finalWallet.transactions
                                    .filter(t => t.type === 'spent')
                                    .reduce((sum, t) => sum + t.amount, 0);
                                
                                expect(finalWallet.balance).toBe(totalEarned - totalSpent);
                                expect(finalWallet.totalEarned).toBe(totalEarned);
                                expect(finalWallet.totalSpent).toBe(totalSpent);
                            } else {
                                // Should have no challenge completion bonus
                                expect(challengeBonusTransactions.length).toBe(0);
                            }

                            // Verify transaction count increased appropriately (at least 2 new transactions for regular points)
                            expect(finalWallet.transactions.length).toBeGreaterThanOrEqual(initialTransactionCount + 2);
                        }
                    ),
                    { numRuns: 5 }
                );
            }
        );
    });

    describe('Property 40: Leaderboard Privacy Protection', () => {
        /**
         * **Validates: Requirements 10.5**
         * Property 40: Leaderboard Privacy Protection
         * For any leaderboard display, user privacy settings should be respected and private information should not be exposed
         */
        
        // Custom generators for property-based testing
        const privacySettingsGen = fc.record({
            showInLeaderboard: fc.boolean(),
            showFullName: fc.boolean(),
            shareImpactData: fc.boolean()
        });

        const userDataGen = fc.record({
            firstName: fc.oneof(
                fc.constantFrom('John', 'Jane', 'Alice', 'Bob', 'Charlie', 'Diana'),
                fc.string({ minLength: 2, maxLength: 10 }).filter(s => /^[A-Za-z]+$/.test(s))
            ),
            lastName: fc.oneof(
                fc.constantFrom('Smith', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller'),
                fc.string({ minLength: 2, maxLength: 10 }).filter(s => /^[A-Za-z]+$/.test(s))
            ),
            score: fc.integer({ min: 10, max: 1000 }),
            zipCode: fc.oneof(
                fc.integer({ min: 10000, max: 99999 }).map(n => n.toString()),
                fc.constantFrom('12345', '54321', '67890', '11111', '22222')
            ),
            city: fc.constantFrom('New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix')
        });

        const leaderboardTypeGen = fc.constantFrom('global', 'area', 'challenge');
        const periodGen = fc.constantFrom('weekly', 'monthly', 'all_time');

        test('Property 40.1: Users with showInLeaderboard=false should never appear in any leaderboard',
            async () => {
                await fc.assert(
                    fc.asyncProperty(
                        fc.array(fc.record({
                            userData: userDataGen,
                            privacy: privacySettingsGen
                        }), { minLength: 3, maxLength: 8 }),
                        leaderboardTypeGen,
                        periodGen,
                        async (users, leaderboardType, period) => {
                            // Create users with various privacy settings
                            const createdUsers = [];
                            for (let i = 0; i < users.length; i++) {
                                const { userData, privacy } = users[i];
                                const uniqueId = `${i}_${Math.random().toString(36).substr(2, 4)}`;
                                
                                const user = await User.create({
                                    name: `${userData.firstName} ${userData.lastName}`,
                                    username: `test_${uniqueId}`,
                                    email: `test_${uniqueId}@example.com`,
                                    password: 'hashedpassword123',
                                    role: 'citizen',
                                    profile: {
                                        firstName: userData.firstName,
                                        lastName: userData.lastName,
                                        addresses: [{
                                            street: '123 Test St',
                                            city: userData.city,
                                            zipCode: userData.zipCode,
                                            coordinates: {
                                                type: 'Point',
                                                coordinates: [-74.0060 + Math.random() * 0.1, 40.7128 + Math.random() * 0.1]
                                            },
                                            isDefault: true
                                        }],
                                        preferences: {
                                            privacy: privacy
                                        }
                                    }
                                });
                                
                                // Process activity to generate leaderboard entries
                                await GamificationService.processUserActivity(user._id, {
                                    type: 'waste_logged',
                                    wasteType: 'Plastic',
                                    weight: userData.score / 10,
                                    points: userData.score
                                });
                                
                                // Ensure wallet and dashboard exist for proper stats
                                let wallet = await EcoPointsWallet.findOne({ citizenId: user._id });
                                if (!wallet) {
                                    wallet = await EcoPointsWallet.create({
                                        citizenId: user._id,
                                        balance: userData.score,
                                        totalEarned: userData.score,
                                        totalSpent: 0,
                                        transactions: [{
                                            type: 'earned',
                                            amount: userData.score,
                                            description: 'Waste logging points',
                                            createdAt: new Date()
                                        }]
                                    });
                                }
                                
                                let dashboard = await ImpactDashboard.findOne({ citizenId: user._id });
                                if (!dashboard) {
                                    dashboard = await ImpactDashboard.create({
                                        citizenId: user._id,
                                        totalWasteRecycled: userData.score / 10,
                                        co2Saved: (userData.score / 10) * 2.3,
                                        ecoPointsEarned: userData.score,
                                        pickupsCompleted: 1,
                                        currentStreak: 1,
                                        longestStreak: 1,
                                        wasteBreakdown: [{
                                            type: 'Plastic',
                                            weight: userData.score / 10,
                                            percentage: 100
                                        }],
                                        monthlyTrends: [],
                                        achievements: []
                                    });
                                }
                                
                                createdUsers.push({ user, privacy, score: userData.score });
                            }

                            // Get appropriate leaderboard
                            let leaderboard;
                            if (leaderboardType === 'global') {
                                leaderboard = await Leaderboard.getGlobalLeaderboard(period, 50);
                            } else if (leaderboardType === 'area') {
                                const sampleUser = createdUsers[0];
                                const area = {
                                    zipCode: sampleUser.user.profile.addresses[0].zipCode,
                                    city: sampleUser.user.profile.addresses[0].city
                                };
                                leaderboard = await Leaderboard.getAreaLeaderboard(area, period, 50);
                            } else {
                                // For challenge leaderboard, create a test challenge
                                const challenge = await Challenge.create({
                                    title: `Test Challenge ${Math.random().toString(36).substr(2, 4)}`,
                                    description: 'Test challenge for privacy testing',
                                    type: 'weekly',
                                    target: { metric: 'weight', value: 10 },
                                    reward: { points: 100 },
                                    startDate: new Date(Date.now() - 86400000),
                                    endDate: new Date(Date.now() + 86400000),
                                    isActive: true
                                });
                                leaderboard = await Leaderboard.getChallengeLeaderboard(challenge._id, 50);
                            }

                            // Verify privacy compliance
                            const leaderboardUserIds = leaderboard.rankings.map(entry => 
                                entry.citizenId ? entry.citizenId._id.toString() : null
                            ).filter(Boolean);

                            // Users who opted out should NEVER appear in leaderboard
                            const usersWhoOptedOut = createdUsers.filter(({ privacy }) => 
                                privacy.showInLeaderboard === false
                            );

                            for (const { user } of usersWhoOptedOut) {
                                expect(leaderboardUserIds).not.toContain(user._id.toString());
                            }

                            // Users who opted in should appear (if they have activity)
                            const usersWhoOptedIn = createdUsers.filter(({ privacy }) => 
                                privacy.showInLeaderboard !== false
                            );

                            for (const { user } of usersWhoOptedIn) {
                                if (leaderboardUserIds.includes(user._id.toString())) {
                                    // If user appears, verify their privacy settings are respected
                                    const entry = leaderboard.rankings.find(e => 
                                        e.citizenId && e.citizenId._id.toString() === user._id.toString()
                                    );
                                    expect(entry).toBeDefined();
                                }
                            }
                        }
                    ),
                    { numRuns: 5, timeout: 15000 }
                );
            }, 20000);

        test('Property 40.2: Display names should respect showFullName privacy setting',
            async () => {
                await fc.assert(
                    fc.asyncProperty(
                        fc.array(fc.record({
                            userData: userDataGen,
                            showFullName: fc.boolean()
                        }), { minLength: 2, maxLength: 5 }),
                        periodGen,
                        async (users, period) => {
                            // Create users with different name privacy settings
                            const createdUsers = [];
                            for (let i = 0; i < users.length; i++) {
                                const { userData, showFullName } = users[i];
                                const uniqueId = `${i}_${Math.random().toString(36).substr(2, 4)}`;
                                
                                const user = await User.create({
                                    name: `${userData.firstName} ${userData.lastName}`,
                                    username: `test_${uniqueId}`,
                                    email: `test_${uniqueId}@example.com`,
                                    password: 'hashedpassword123',
                                    role: 'citizen',
                                    profile: {
                                        firstName: userData.firstName,
                                        lastName: userData.lastName,
                                        addresses: [{
                                            street: '123 Test St',
                                            city: userData.city,
                                            zipCode: userData.zipCode,
                                            coordinates: {
                                                type: 'Point',
                                                coordinates: [-74.0060, 40.7128]
                                            },
                                            isDefault: true
                                        }],
                                        preferences: {
                                            privacy: {
                                                showInLeaderboard: true, // Ensure they appear
                                                showFullName: showFullName
                                            }
                                        }
                                    }
                                });
                                
                                // Process activity to generate leaderboard entries
                                await GamificationService.processUserActivity(user._id, {
                                    type: 'waste_logged',
                                    wasteType: 'Plastic',
                                    weight: userData.score / 10,
                                    points: userData.score
                                });
                                
                                // Ensure wallet and dashboard exist for proper stats
                                let wallet = await EcoPointsWallet.findOne({ citizenId: user._id });
                                if (!wallet) {
                                    wallet = await EcoPointsWallet.create({
                                        citizenId: user._id,
                                        balance: userData.score,
                                        totalEarned: userData.score,
                                        totalSpent: 0,
                                        transactions: [{
                                            type: 'earned',
                                            amount: userData.score,
                                            description: 'Waste logging points',
                                            createdAt: new Date()
                                        }]
                                    });
                                }
                                
                                let dashboard = await ImpactDashboard.findOne({ citizenId: user._id });
                                if (!dashboard) {
                                    dashboard = await ImpactDashboard.create({
                                        citizenId: user._id,
                                        totalWasteRecycled: userData.score / 10,
                                        co2Saved: (userData.score / 10) * 2.3,
                                        ecoPointsEarned: userData.score,
                                        pickupsCompleted: 1,
                                        currentStreak: 1,
                                        longestStreak: 1,
                                        wasteBreakdown: [{
                                            type: 'Plastic',
                                            weight: userData.score / 10,
                                            percentage: 100
                                        }],
                                        monthlyTrends: [],
                                        achievements: []
                                    });
                                }
                                
                                createdUsers.push({ user, showFullName, userData });
                            }

                            // Get global leaderboard
                            const leaderboard = await Leaderboard.getGlobalLeaderboard(period, 50);

                            // Verify display name privacy compliance
                            for (const { user, showFullName, userData } of createdUsers) {
                                const entry = leaderboard.rankings.find(e => 
                                    e.citizenId && e.citizenId._id.toString() === user._id.toString()
                                );

                                if (entry) {
                                    if (showFullName) {
                                        // Full name should be displayed
                                        expect(entry.displayName).toContain(userData.firstName);
                                        expect(entry.displayName).toContain(userData.lastName);
                                    } else {
                                        // Only first name and last initial should be displayed
                                        expect(entry.displayName).toContain(userData.firstName);
                                        expect(entry.displayName).toMatch(new RegExp(`${userData.firstName}\\s+${userData.lastName.charAt(0)}\\.`));
                                        expect(entry.displayName).not.toContain(userData.lastName.substring(1));
                                    }
                                }
                            }
                        }
                    ),
                    { numRuns: 5, timeout: 15000 }
                );
            }, 20000);

        test('Property 40.3: Privacy settings changes should immediately affect leaderboard visibility',
            async () => {
                await fc.assert(
                    fc.asyncProperty(
                        userDataGen,
                        fc.boolean(), // initial showInLeaderboard setting
                        fc.boolean(), // final showInLeaderboard setting
                        async (userData, initialSetting, finalSetting) => {
                            const uniqueId = Math.random().toString(36).substr(2, 6);
                            
                            // Create user with initial privacy setting
                            const user = await User.create({
                                name: `${userData.firstName} ${userData.lastName}`,
                                username: `test_${uniqueId}`,
                                email: `test_${uniqueId}@example.com`,
                                password: 'hashedpassword123',
                                role: 'citizen',
                                profile: {
                                    firstName: userData.firstName,
                                    lastName: userData.lastName,
                                    addresses: [{
                                        street: '123 Test St',
                                        city: userData.city,
                                        zipCode: userData.zipCode,
                                        coordinates: {
                                            type: 'Point',
                                            coordinates: [-74.0060, 40.7128]
                                        },
                                        isDefault: true
                                    }],
                                    preferences: {
                                        privacy: {
                                            showInLeaderboard: initialSetting
                                        }
                                    }
                                }
                            });

                            // Process activity to generate leaderboard entry
                            await GamificationService.processUserActivity(user._id, {
                                type: 'waste_logged',
                                wasteType: 'Plastic',
                                weight: userData.score / 10,
                                points: userData.score
                            });

                            // Ensure wallet and dashboard exist for proper stats
                            let wallet = await EcoPointsWallet.findOne({ citizenId: user._id });
                            if (!wallet) {
                                wallet = await EcoPointsWallet.create({
                                    citizenId: user._id,
                                    balance: userData.score,
                                    totalEarned: userData.score,
                                    totalSpent: 0,
                                    transactions: [{
                                        type: 'earned',
                                        amount: userData.score,
                                        description: 'Waste logging points',
                                        createdAt: new Date()
                                    }]
                                });
                            }
                            
                            let dashboard = await ImpactDashboard.findOne({ citizenId: user._id });
                            if (!dashboard) {
                                dashboard = await ImpactDashboard.create({
                                    citizenId: user._id,
                                    totalWasteRecycled: userData.score / 10,
                                    co2Saved: (userData.score / 10) * 2.3,
                                    ecoPointsEarned: userData.score,
                                    pickupsCompleted: 1,
                                    currentStreak: 1,
                                    longestStreak: 1,
                                    wasteBreakdown: [{
                                        type: 'Plastic',
                                        weight: userData.score / 10,
                                        percentage: 100
                                    }],
                                    monthlyTrends: [],
                                    achievements: []
                                });
                            }

                            // Check initial leaderboard state
                            let leaderboard = await Leaderboard.getGlobalLeaderboard('all_time', 50);
                            let userEntry = leaderboard.rankings.find(e => 
                                e.citizenId && e.citizenId._id.toString() === user._id.toString()
                            );

                            if (initialSetting) {
                                expect(userEntry).toBeDefined();
                            } else {
                                expect(userEntry).toBeUndefined();
                            }

                            // Change privacy setting
                            await User.findByIdAndUpdate(user._id, {
                                'profile.preferences.privacy.showInLeaderboard': finalSetting
                            });

                            // Update leaderboards to reflect privacy change
                            await GamificationService.updateUserLeaderboards(user._id);

                            // Check final leaderboard state
                            leaderboard = await Leaderboard.getGlobalLeaderboard('all_time', 50);
                            userEntry = leaderboard.rankings.find(e => 
                                e.citizenId && e.citizenId._id.toString() === user._id.toString()
                            );

                            if (finalSetting) {
                                // User should appear if they have activity (which they do)
                                if (userData.score > 0) {
                                    expect(userEntry).toBeDefined();
                                }
                            } else {
                                expect(userEntry).toBeUndefined();
                            }
                        }
                    ),
                    { numRuns: 5, timeout: 15000 }
                );
            }, 20000);

        test('Property 40.4: All leaderboard types (global, area, challenge) should respect privacy settings consistently',
            async () => {
                await fc.assert(
                    fc.asyncProperty(
                        fc.array(fc.record({
                            userData: userDataGen,
                            privacy: privacySettingsGen
                        }), { minLength: 3, maxLength: 6 }),
                        async (users) => {
                            // Create test challenge
                            const challenge = await Challenge.create({
                                title: `Privacy Test Challenge ${Math.random().toString(36).substr(2, 4)}`,
                                description: 'Test challenge for privacy compliance',
                                type: 'weekly',
                                target: { metric: 'weight', value: 5 },
                                reward: { points: 50 },
                                startDate: new Date(Date.now() - 86400000),
                                endDate: new Date(Date.now() + 86400000),
                                isActive: true
                            });

                            // Create users and process activities
                            const createdUsers = [];
                            for (let i = 0; i < users.length; i++) {
                                const { userData, privacy } = users[i];
                                const uniqueId = `${i}_${Math.random().toString(36).substr(2, 4)}`;
                                
                                const user = await User.create({
                                    name: `${userData.firstName} ${userData.lastName}`,
                                    username: `test_${uniqueId}`,
                                    email: `test_${uniqueId}@example.com`,
                                    password: 'hashedpassword123',
                                    role: 'citizen',
                                    profile: {
                                        firstName: userData.firstName,
                                        lastName: userData.lastName,
                                        addresses: [{
                                            street: '123 Test St',
                                            city: userData.city,
                                            zipCode: userData.zipCode,
                                            coordinates: {
                                                type: 'Point',
                                                coordinates: [-74.0060, 40.7128]
                                            },
                                            isDefault: true
                                        }],
                                        preferences: {
                                            privacy: privacy
                                        }
                                    }
                                });

                                // Enroll in challenge
                                await UserChallenge.create({
                                    citizenId: user._id,
                                    challengeId: challenge._id,
                                    progress: 0
                                });

                                // Process activity
                                await GamificationService.processUserActivity(user._id, {
                                    type: 'waste_logged',
                                    wasteType: 'Plastic',
                                    weight: userData.score / 10,
                                    points: userData.score
                                });
                                
                                // Ensure wallet and dashboard exist for proper stats
                                let wallet = await EcoPointsWallet.findOne({ citizenId: user._id });
                                if (!wallet) {
                                    wallet = await EcoPointsWallet.create({
                                        citizenId: user._id,
                                        balance: userData.score,
                                        totalEarned: userData.score,
                                        totalSpent: 0,
                                        transactions: [{
                                            type: 'earned',
                                            amount: userData.score,
                                            description: 'Waste logging points',
                                            createdAt: new Date()
                                        }]
                                    });
                                }
                                
                                let dashboard = await ImpactDashboard.findOne({ citizenId: user._id });
                                if (!dashboard) {
                                    dashboard = await ImpactDashboard.create({
                                        citizenId: user._id,
                                        totalWasteRecycled: userData.score / 10,
                                        co2Saved: (userData.score / 10) * 2.3,
                                        ecoPointsEarned: userData.score,
                                        pickupsCompleted: 1,
                                        currentStreak: 1,
                                        longestStreak: 1,
                                        wasteBreakdown: [{
                                            type: 'Plastic',
                                            weight: userData.score / 10,
                                            percentage: 100
                                        }],
                                        monthlyTrends: [],
                                        achievements: []
                                    });
                                }
                                
                                createdUsers.push({ user, privacy });
                            }

                            // Get all leaderboard types
                            const sampleUser = createdUsers[0];
                            const area = {
                                zipCode: sampleUser.user.profile.addresses[0].zipCode,
                                city: sampleUser.user.profile.addresses[0].city
                            };

                            const [globalLeaderboard, areaLeaderboard, challengeLeaderboard] = await Promise.all([
                                Leaderboard.getGlobalLeaderboard('all_time', 50),
                                Leaderboard.getAreaLeaderboard(area, 'all_time', 50),
                                Leaderboard.getChallengeLeaderboard(challenge._id, 50)
                            ]);

                            const leaderboards = [
                                { type: 'global', data: globalLeaderboard },
                                { type: 'area', data: areaLeaderboard },
                                { type: 'challenge', data: challengeLeaderboard }
                            ];

                            // Verify privacy compliance across all leaderboard types
                            for (const { user, privacy } of createdUsers) {
                                for (const { type, data } of leaderboards) {
                                    const userEntry = data.rankings.find(e => 
                                        e.citizenId && e.citizenId._id.toString() === user._id.toString()
                                    );

                                    if (privacy.showInLeaderboard === false) {
                                        // User should not appear in any leaderboard type
                                        expect(userEntry).toBeUndefined();
                                    } else if (userEntry) {
                                        // If user appears, verify name privacy is respected
                                        if (privacy.showFullName === false) {
                                            expect(userEntry.displayName).toMatch(/\w+\s+\w\./);
                                        }
                                    }
                                }
                            }
                        }
                    ),
                    { numRuns: 5, timeout: 20000 }
                );
            }, 25000);

        test('Property 40.5: Leaderboard API endpoints should filter users based on privacy settings',
            async () => {
                await fc.assert(
                    fc.asyncProperty(
                        fc.array(fc.record({
                            userData: userDataGen,
                            showInLeaderboard: fc.boolean()
                        }), { minLength: 4, maxLength: 7 }),
                        async (users) => {
                            // Create users with different privacy settings
                            const createdUsers = [];
                            for (let i = 0; i < users.length; i++) {
                                const { userData, showInLeaderboard } = users[i];
                                const uniqueId = `${i}_${Math.random().toString(36).substr(2, 4)}`;
                                
                                const user = await User.create({
                                    name: `${userData.firstName} ${userData.lastName}`,
                                    username: `test_${uniqueId}`,
                                    email: `test_${uniqueId}@example.com`,
                                    password: 'hashedpassword123',
                                    role: 'citizen',
                                    profile: {
                                        firstName: userData.firstName,
                                        lastName: userData.lastName,
                                        addresses: [{
                                            street: '123 Test St',
                                            city: userData.city,
                                            zipCode: userData.zipCode,
                                            coordinates: {
                                                type: 'Point',
                                                coordinates: [-74.0060, 40.7128]
                                            },
                                            isDefault: true
                                        }],
                                        preferences: {
                                            privacy: {
                                                showInLeaderboard: showInLeaderboard
                                            }
                                        }
                                    }
                                });
                                
                                // Process activity
                                await GamificationService.processUserActivity(user._id, {
                                    type: 'waste_logged',
                                    wasteType: 'Plastic',
                                    weight: userData.score / 10,
                                    points: userData.score
                                });
                                
                                // Ensure wallet and dashboard exist for proper stats
                                let wallet = await EcoPointsWallet.findOne({ citizenId: user._id });
                                if (!wallet) {
                                    wallet = await EcoPointsWallet.create({
                                        citizenId: user._id,
                                        balance: userData.score,
                                        totalEarned: userData.score,
                                        totalSpent: 0,
                                        transactions: [{
                                            type: 'earned',
                                            amount: userData.score,
                                            description: 'Waste logging points',
                                            createdAt: new Date()
                                        }]
                                    });
                                }
                                
                                let dashboard = await ImpactDashboard.findOne({ citizenId: user._id });
                                if (!dashboard) {
                                    dashboard = await ImpactDashboard.create({
                                        citizenId: user._id,
                                        totalWasteRecycled: userData.score / 10,
                                        co2Saved: (userData.score / 10) * 2.3,
                                        ecoPointsEarned: userData.score,
                                        pickupsCompleted: 1,
                                        currentStreak: 1,
                                        longestStreak: 1,
                                        wasteBreakdown: [{
                                            type: 'Plastic',
                                            weight: userData.score / 10,
                                            percentage: 100
                                        }],
                                        monthlyTrends: [],
                                        achievements: []
                                    });
                                }
                                
                                createdUsers.push({ user, showInLeaderboard });
                            }

                            // Test static methods that are used by API endpoints
                            const globalLeaderboard = await Leaderboard.getGlobalLeaderboard('all_time', 50);
                            
                            const sampleUser = createdUsers[0];
                            const area = {
                                zipCode: sampleUser.user.profile.addresses[0].zipCode,
                                city: sampleUser.user.profile.addresses[0].city
                            };
                            const areaLeaderboard = await Leaderboard.getAreaLeaderboard(area, 'all_time', 50);

                            // Verify that API-level filtering works correctly
                            const usersWhoOptedOut = createdUsers.filter(({ showInLeaderboard }) => 
                                showInLeaderboard === false
                            );
                            const usersWhoOptedIn = createdUsers.filter(({ showInLeaderboard }) => 
                                showInLeaderboard !== false
                            );

                            // Check global leaderboard filtering
                            const globalUserIds = globalLeaderboard.rankings.map(e => 
                                e.citizenId ? e.citizenId._id.toString() : null
                            ).filter(Boolean);

                            for (const { user } of usersWhoOptedOut) {
                                expect(globalUserIds).not.toContain(user._id.toString());
                            }

                            // Check area leaderboard filtering
                            const areaUserIds = areaLeaderboard.rankings.map(e => 
                                e.citizenId ? e.citizenId._id.toString() : null
                            ).filter(Boolean);

                            for (const { user } of usersWhoOptedOut) {
                                expect(areaUserIds).not.toContain(user._id.toString());
                            }

                            // Verify that users who opted in can appear (if they have activity)
                            if (usersWhoOptedIn.length > 0 && globalUserIds.length > 0) {
                                const someOptedInUsersPresent = usersWhoOptedIn.some(({ user }) => 
                                    globalUserIds.includes(user._id.toString())
                                );
                                expect(someOptedInUsersPresent).toBe(true);
                            }
                        }
                    ),
                    { numRuns: 5, timeout: 15000 }
                );
            }, 20000);
    });

    describe('Achievement System', () => {
        test('should award achievements when criteria are met',
            async () => {
                await fc.assert(
                    fc.asyncProperty(
                        fc.float({ min: 5, max: 20 }), // weight that meets achievement criteria
                        async (achievementWeight) => {
                            const initialUserAchievements = await UserAchievement.find({ citizenId: testCitizenId });
                            const initialCount = initialUserAchievements.length;

                            // Process activity that meets achievement criteria
                            await GamificationService.processUserActivity(testCitizenId, {
                                type: 'waste_logged',
                                wasteType: 'Plastic',
                                weight: achievementWeight,
                                points: achievementWeight * 2
                            });

                            const finalUserAchievements = await UserAchievement.find({ citizenId: testCitizenId });

                            if (achievementWeight >= testAchievement.criteria.value) {
                                // Achievement should be earned
                                expect(finalUserAchievements.length).toBeGreaterThan(initialCount);

                                const earnedAchievement = finalUserAchievements.find(
                                    ua => ua.achievementId.toString() === testAchievement._id.toString()
                                );
                                expect(earnedAchievement).toBeDefined();
                                expect(earnedAchievement.progress.current).toBeGreaterThanOrEqual(testAchievement.criteria.value);

                                // Verify reward points were awarded
                                const wallet = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                                const achievementBonus = wallet.transactions.find(
                                    t => t.type === 'bonus' && t.description.includes('Achievement unlocked')
                                );
                                expect(achievementBonus).toBeDefined();
                            }
                        }
                    ),
                    { numRuns: 5 }
                );
            }
        );
    });

    describe('Leaderboard Updates', () => {
        test('should update leaderboard rankings correctly',
            async () => {
                // Create multiple users for leaderboard testing
                const users = [];
                for (let i = 0; i < 3; i++) {
                    const userId = new mongoose.Types.ObjectId();
                    await User.create({
                        _id: userId,
                        name: `User${i} Test`,
                        username: `user${i}`,
                        email: `user${i}@example.com`,
                        password: 'hashedpassword',
                        role: 'citizen',
                        profile: {
                            firstName: `User${i}`,
                            lastName: 'Test',
                            addresses: [{
                                street: `${i} Test St`,
                                city: 'Test City',
                                zipCode: '12345',
                                coordinates: {
                                    type: 'Point',
                                    coordinates: [-74.0060, 40.7128] // [longitude, latitude]
                                },
                                isDefault: true
                            }],
                            preferences: {
                                privacy: {
                                    showInLeaderboard: true,
                                    showFullName: true
                                }
                            }
                        },
                        isActive: true
                    });

                    await EcoPointsWallet.create({
                        citizenId: userId,
                        balance: 0,
                        totalEarned: 0,
                        totalSpent: 0,
                        transactions: []
                    });

                    await ImpactDashboard.create({
                        citizenId: userId,
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

                    users.push(userId);
                }

                // Generate different scores for each user
                const scores = [100, 200, 150];
                for (let i = 0; i < users.length; i++) {
                    await GamificationService.processUserActivity(users[i], {
                        type: 'waste_logged',
                        wasteType: 'Plastic',
                        weight: scores[i] / 10,
                        points: scores[i]
                    });
                }

                // Check leaderboard rankings
                const globalLeaderboard = await Leaderboard.findOne({
                    type: 'global',
                    period: 'all_time'
                });

                expect(globalLeaderboard).toBeDefined();
                expect(globalLeaderboard.rankings.length).toBeGreaterThanOrEqual(3);

                // Verify rankings are in correct order (highest score first)
                for (let i = 0; i < globalLeaderboard.rankings.length - 1; i++) {
                    expect(globalLeaderboard.rankings[i].score)
                        .toBeGreaterThanOrEqual(globalLeaderboard.rankings[i + 1].score);
                    expect(globalLeaderboard.rankings[i].rank).toBe(i + 1);
                }
            }
        );
    });
});
