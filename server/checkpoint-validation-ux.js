#!/usr/bin/env node

/**
 * EcoCycle Platform - User Experience Features Checkpoint Validation
 * 
 * This script validates that all gamification and notification features work correctly
 * as part of Task 17: Checkpoint - User Experience Features
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Challenge from './models/Challenge.js';
import UserChallenge from './models/UserChallenge.js';
import Achievement from './models/Achievement.js';
import UserAchievement from './models/UserAchievement.js';
import Leaderboard from './models/Leaderboard.js';
import EcoPointsWallet from './models/EcoPointsWallet.js';
import ImpactDashboard from './models/ImpactDashboard.js';
import Notification from './models/Notification.js';
import GamificationService from './services/gamificationService.js';
import notificationService from './services/notificationService.js';

// Load environment variables
dotenv.config();

class UXFeaturesValidator {
    constructor() {
        this.results = {
            gamification: {
                challengeCompletion: false,
                achievementSystem: false,
                leaderboardPrivacy: false,
                pointsCalculation: false
            },
            notifications: {
                pickupStatusNotifications: false,
                proximityNotifications: false,
                rewardNotifications: false,
                preferenceRespect: false,
                realTimeDelivery: false
            },
            overall: false
        };
        this.testUsers = [];
        this.testChallenges = [];
    }

    async connect() {
        try {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecocycle-test');
            console.log('✅ Connected to MongoDB');
            return true;
        } catch (error) {
            console.error('❌ MongoDB connection failed:', error.message);
            return false;
        }
    }

    async cleanup() {
        try {
            // Clean up test data
            await Promise.all([
                User.deleteMany({ email: { $regex: /^test.*@checkpoint\.com$/ } }),
                Challenge.deleteMany({ title: { $regex: /^Checkpoint Test/ } }),
                UserChallenge.deleteMany({}),
                UserAchievement.deleteMany({}),
                Leaderboard.deleteMany({ type: { $in: ['global', 'area'] } }),
                EcoPointsWallet.deleteMany({}),
                ImpactDashboard.deleteMany({}),
                Notification.deleteMany({ type: { $regex: /^test/ } })
            ]);
            console.log('🧹 Cleaned up test data');
        } catch (error) {
            console.error('⚠️  Cleanup warning:', error.message);
        }
    }

    async createTestUsers() {
        try {
            const users = [];
            for (let i = 1; i <= 3; i++) {
                const user = await User.create({
                    name: `Test User ${i}`,
                    username: `testuser${i}`,
                    email: `test${i}@checkpoint.com`,
                    password: 'hashedpassword123',
                    role: 'citizen',
                    profile: {
                        firstName: `Test${i}`,
                        lastName: 'User',
                        addresses: [{
                            street: `${i}00 Test St`,
                            city: 'Test City',
                            zipCode: '12345',
                            coordinates: {
                                type: 'Point',
                                coordinates: [-74.0060 + (i * 0.01), 40.7128 + (i * 0.01)]
                            },
                            isDefault: true
                        }],
                        preferences: {
                            notifications: {
                                pickup: i <= 2, // First 2 users allow pickup notifications
                                rewards: true,
                                challenges: true
                            },
                            privacy: {
                                showInLeaderboard: i !== 3, // Third user opts out of leaderboards
                                showFullName: i === 1 // Only first user shows full name
                            }
                        }
                    },
                    isActive: true
                });

                // Create wallet and dashboard for each user
                await EcoPointsWallet.create({
                    citizenId: user._id,
                    balance: 0,
                    totalEarned: 0,
                    totalSpent: 0,
                    transactions: []
                });

                await ImpactDashboard.create({
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

                users.push(user);
            }

            this.testUsers = users;
            console.log(`✅ Created ${users.length} test users`);
            return true;
        } catch (error) {
            console.error('❌ Failed to create test users:', error.message);
            return false;
        }
    }

    async validateGamificationFeatures() {
        console.log('\n🎮 Validating Gamification Features...');

        try {
            // Test 1: Challenge Completion and Rewards
            await this.validateChallengeCompletion();

            // Test 2: Achievement System
            await this.validateAchievementSystem();

            // Test 3: Leaderboard Privacy Protection
            await this.validateLeaderboardPrivacy();

            // Test 4: Points Calculation Accuracy
            await this.validatePointsCalculation();

            const gamificationPassed = Object.values(this.results.gamification).every(result => result);
            console.log(`\n🎮 Gamification Features: ${gamificationPassed ? '✅ PASSED' : '❌ FAILED'}`);
            
            return gamificationPassed;
        } catch (error) {
            console.error('❌ Gamification validation failed:', error.message);
            return false;
        }
    }

    async validateChallengeCompletion() {
        try {
            console.log('  📋 Testing challenge completion and rewards...');

            // Create a test challenge
            const challenge = await Challenge.create({
                title: 'Checkpoint Test Challenge',
                description: 'Test challenge for validation',
                type: 'weekly',
                target: {
                    metric: 'weight',
                    value: 10
                },
                reward: {
                    points: 100,
                    badge: 'Test Champion'
                },
                startDate: new Date(Date.now() - 86400000),
                endDate: new Date(Date.now() + 86400000),
                isActive: true,
                participants: [this.testUsers[0]._id]
            });

            // Create user challenge
            await UserChallenge.create({
                citizenId: this.testUsers[0]._id,
                challengeId: challenge._id,
                progress: 0,
                progressDetails: {
                    totalWeight: 0,
                    totalPickups: 0,
                    totalPoints: 0,
                    currentStreak: 0,
                    wasteTypeBreakdown: []
                }
            });

            // Get initial wallet balance
            const initialWallet = await EcoPointsWallet.findOne({ citizenId: this.testUsers[0]._id });
            const initialBalance = initialWallet.balance;

            // Process activity that completes the challenge
            await GamificationService.processUserActivity(this.testUsers[0]._id, {
                type: 'waste_logged',
                wasteType: 'Plastic',
                weight: 15, // Exceeds challenge target of 10
                points: 30
            });

            // Verify challenge completion
            const completedChallenge = await UserChallenge.findOne({
                citizenId: this.testUsers[0]._id,
                challengeId: challenge._id
            });

            const finalWallet = await EcoPointsWallet.findOne({ citizenId: this.testUsers[0]._id });
            const bonusTransaction = finalWallet.transactions.find(
                t => t.type === 'bonus' && t.description.includes('Challenge completed')
            );

            if (completedChallenge.completed && bonusTransaction && bonusTransaction.amount === 100) {
                console.log('    ✅ Challenge completion and reward system working');
                this.results.gamification.challengeCompletion = true;
            } else {
                console.log('    ❌ Challenge completion or reward system failed');
            }

            this.testChallenges.push(challenge);
        } catch (error) {
            console.log('    ❌ Challenge completion test failed:', error.message);
        }
    }

    async validateAchievementSystem() {
        try {
            console.log('  🏆 Testing achievement system...');

            // Create a test achievement
            const achievement = await Achievement.create({
                name: 'Checkpoint Test Achievement',
                description: 'Test achievement for validation',
                icon: '🏆',
                rarity: 'common',
                category: 'waste',
                criteria: {
                    type: 'weight',
                    value: 5
                },
                reward: {
                    points: 50,
                    badge: 'Test Recycler'
                },
                isActive: true
            });

            // Process activity that meets achievement criteria
            await GamificationService.processUserActivity(this.testUsers[1]._id, {
                type: 'waste_logged',
                wasteType: 'Paper',
                weight: 8, // Exceeds achievement criteria of 5
                points: 16
            });

            // Check if achievement was awarded
            const userAchievement = await UserAchievement.findOne({
                citizenId: this.testUsers[1]._id,
                achievementId: achievement._id
            });

            const wallet = await EcoPointsWallet.findOne({ citizenId: this.testUsers[1]._id });
            const achievementBonus = wallet.transactions.find(
                t => t.type === 'bonus' && t.description.includes('Achievement unlocked')
            );

            if (userAchievement && achievementBonus) {
                console.log('    ✅ Achievement system working');
                this.results.gamification.achievementSystem = true;
            } else {
                console.log('    ❌ Achievement system failed');
            }
        } catch (error) {
            console.log('    ❌ Achievement system test failed:', error.message);
        }
    }

    async validateLeaderboardPrivacy() {
        try {
            console.log('  🔒 Testing leaderboard privacy protection...');

            // Process activities for all users to generate leaderboard entries
            for (let i = 0; i < this.testUsers.length; i++) {
                await GamificationService.processUserActivity(this.testUsers[i]._id, {
                    type: 'waste_logged',
                    wasteType: 'Glass',
                    weight: 5 + i,
                    points: (5 + i) * 2
                });
            }

            // Get global leaderboard
            const globalLeaderboard = await Leaderboard.getGlobalLeaderboard('all_time', 10);

            // Check privacy compliance
            const user3InLeaderboard = globalLeaderboard.rankings.find(
                entry => entry.citizenId && entry.citizenId._id.toString() === this.testUsers[2]._id.toString()
            );

            const user1Entry = globalLeaderboard.rankings.find(
                entry => entry.citizenId && entry.citizenId._id.toString() === this.testUsers[0]._id.toString()
            );

            // User 3 should not appear (opted out), User 1 should show full name
            if (!user3InLeaderboard && user1Entry && user1Entry.displayName.includes('Test1 User')) {
                console.log('    ✅ Leaderboard privacy protection working');
                this.results.gamification.leaderboardPrivacy = true;
            } else {
                console.log('    ❌ Leaderboard privacy protection failed');
            }
        } catch (error) {
            console.log('    ❌ Leaderboard privacy test failed:', error.message);
        }
    }

    async validatePointsCalculation() {
        try {
            console.log('  🔢 Testing points calculation accuracy...');

            const user = this.testUsers[0];
            const initialWallet = await EcoPointsWallet.findOne({ citizenId: user._id });
            const initialBalance = initialWallet.balance;

            // Process waste logging activity
            const wasteWeight = 5;
            const expectedPoints = wasteWeight * 2; // Assuming 2 points per kg

            await GamificationService.processUserActivity(user._id, {
                type: 'waste_logged',
                wasteType: 'Metal',
                weight: wasteWeight,
                points: expectedPoints
            });

            const finalWallet = await EcoPointsWallet.findOne({ citizenId: user._id });
            const pointsEarned = finalWallet.balance - initialBalance;

            if (pointsEarned >= expectedPoints) {
                console.log('    ✅ Points calculation accuracy verified');
                this.results.gamification.pointsCalculation = true;
            } else {
                console.log('    ❌ Points calculation inaccurate');
            }
        } catch (error) {
            console.log('    ❌ Points calculation test failed:', error.message);
        }
    }

    async validateNotificationFeatures() {
        console.log('\n📢 Validating Notification Features...');

        try {
            // Test 1: Pickup Status Notifications
            await this.validatePickupStatusNotifications();

            // Test 2: Proximity Notifications
            await this.validateProximityNotifications();

            // Test 3: Reward Notifications
            await this.validateRewardNotifications();

            // Test 4: Preference Respect
            await this.validatePreferenceRespect();

            // Test 5: Real-time Delivery
            await this.validateRealTimeDelivery();

            const notificationsPassed = Object.values(this.results.notifications).every(result => result);
            console.log(`\n📢 Notification Features: ${notificationsPassed ? '✅ PASSED' : '❌ FAILED'}`);
            
            return notificationsPassed;
        } catch (error) {
            console.error('❌ Notification validation failed:', error.message);
            return false;
        }
    }

    async validatePickupStatusNotifications() {
        try {
            console.log('  🚚 Testing pickup status notifications...');

            const pickupId = new mongoose.Types.ObjectId();
            const notification = await notificationService.sendPickupStatusNotification(
                pickupId,
                this.testUsers[0]._id,
                'pending',
                'assigned'
            );

            if (notification && notification.type === 'pickup_status_change') {
                console.log('    ✅ Pickup status notifications working');
                this.results.notifications.pickupStatusNotifications = true;
            } else {
                console.log('    ❌ Pickup status notifications failed');
            }
        } catch (error) {
            console.log('    ❌ Pickup status notification test failed:', error.message);
        }
    }

    async validateProximityNotifications() {
        try {
            console.log('  📍 Testing proximity notifications...');

            const collectorId = new mongoose.Types.ObjectId();
            const notification = await notificationService.sendProximityNotification(
                this.testUsers[0]._id,
                collectorId,
                500, // 500 meters
                5 // 5 minutes
            );

            if (notification && notification.type === 'collector_nearby') {
                console.log('    ✅ Proximity notifications working');
                this.results.notifications.proximityNotifications = true;
            } else {
                console.log('    ❌ Proximity notifications failed');
            }
        } catch (error) {
            console.log('    ❌ Proximity notification test failed:', error.message);
        }
    }

    async validateRewardNotifications() {
        try {
            console.log('  🎁 Testing reward notifications...');

            const mockReward = { _id: new mongoose.Types.ObjectId(), name: 'Test Reward' };
            const mockRedemption = {
                _id: new mongoose.Types.ObjectId(),
                pointsSpent: 100,
                redemptionCode: 'TEST123'
            };

            const notification = await notificationService.sendRedemptionNotification(
                this.testUsers[0]._id,
                mockRedemption,
                mockReward
            );

            if (notification && notification.type === 'reward_redemption_confirmation') {
                console.log('    ✅ Reward notifications working');
                this.results.notifications.rewardNotifications = true;
            } else {
                console.log('    ❌ Reward notifications failed');
            }
        } catch (error) {
            console.log('    ❌ Reward notification test failed:', error.message);
        }
    }

    async validatePreferenceRespect() {
        try {
            console.log('  ⚙️  Testing notification preference respect...');

            // Test with user who has pickup notifications disabled (user 3)
            const pickupId = new mongoose.Types.ObjectId();
            const notification = await notificationService.sendPickupStatusNotification(
                pickupId,
                this.testUsers[2]._id, // User 3 has pickup notifications disabled
                'pending',
                'assigned'
            );

            // Should return null because user has disabled pickup notifications
            if (notification === null) {
                console.log('    ✅ Notification preferences respected');
                this.results.notifications.preferenceRespect = true;
            } else {
                console.log('    ❌ Notification preferences not respected');
            }
        } catch (error) {
            console.log('    ❌ Preference respect test failed:', error.message);
        }
    }

    async validateRealTimeDelivery() {
        try {
            console.log('  ⚡ Testing real-time delivery...');

            const startTime = Date.now();
            
            const notification = await notificationService.createNotification({
                recipientId: this.testUsers[0]._id,
                type: 'test_notification',
                title: 'Real-time Test',
                message: 'Testing real-time delivery',
                data: { test: true },
                channels: ['push', 'in_app'],
                priority: 'high'
            });

            const deliveryTime = Date.now() - startTime;

            // Should be delivered within 5 seconds (generous for testing)
            if (notification && deliveryTime < 5000) {
                console.log('    ✅ Real-time delivery working');
                this.results.notifications.realTimeDelivery = true;
            } else {
                console.log('    ❌ Real-time delivery too slow or failed');
            }
        } catch (error) {
            console.log('    ❌ Real-time delivery test failed:', error.message);
        }
    }

    async generateReport() {
        console.log('\n📊 CHECKPOINT VALIDATION REPORT');
        console.log('=====================================');

        console.log('\n🎮 GAMIFICATION FEATURES:');
        console.log(`  Challenge Completion: ${this.results.gamification.challengeCompletion ? '✅' : '❌'}`);
        console.log(`  Achievement System: ${this.results.gamification.achievementSystem ? '✅' : '❌'}`);
        console.log(`  Leaderboard Privacy: ${this.results.gamification.leaderboardPrivacy ? '✅' : '❌'}`);
        console.log(`  Points Calculation: ${this.results.gamification.pointsCalculation ? '✅' : '❌'}`);

        console.log('\n📢 NOTIFICATION FEATURES:');
        console.log(`  Pickup Status Notifications: ${this.results.notifications.pickupStatusNotifications ? '✅' : '❌'}`);
        console.log(`  Proximity Notifications: ${this.results.notifications.proximityNotifications ? '✅' : '❌'}`);
        console.log(`  Reward Notifications: ${this.results.notifications.rewardNotifications ? '✅' : '❌'}`);
        console.log(`  Preference Respect: ${this.results.notifications.preferenceRespect ? '✅' : '❌'}`);
        console.log(`  Real-time Delivery: ${this.results.notifications.realTimeDelivery ? '✅' : '❌'}`);

        const gamificationPassed = Object.values(this.results.gamification).every(result => result);
        const notificationsPassed = Object.values(this.results.notifications).every(result => result);
        this.results.overall = gamificationPassed && notificationsPassed;

        console.log('\n🎯 OVERALL RESULT:');
        console.log(`  User Experience Features: ${this.results.overall ? '✅ PASSED' : '❌ FAILED'}`);

        if (this.results.overall) {
            console.log('\n🎉 All user experience features are working correctly!');
            console.log('   The gamification and notification systems are ready for production.');
        } else {
            console.log('\n⚠️  Some user experience features need attention.');
            console.log('   Please review the failed tests above.');
        }

        return this.results.overall;
    }

    async run() {
        console.log('🚀 Starting User Experience Features Checkpoint Validation...\n');

        try {
            // Connect to database
            if (!(await this.connect())) {
                return false;
            }

            // Clean up any existing test data
            await this.cleanup();

            // Create test users
            if (!(await this.createTestUsers())) {
                return false;
            }

            // Validate gamification features
            const gamificationPassed = await this.validateGamificationFeatures();

            // Validate notification features
            const notificationsPassed = await this.validateNotificationFeatures();

            // Generate final report
            const overallPassed = await this.generateReport();

            // Clean up test data
            await this.cleanup();

            return overallPassed;
        } catch (error) {
            console.error('❌ Validation failed with error:', error.message);
            return false;
        } finally {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const validator = new UXFeaturesValidator();
    
    validator.run()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Validation script failed:', error);
            process.exit(1);
        });
}

export default UXFeaturesValidator;