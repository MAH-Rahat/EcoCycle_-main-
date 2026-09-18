import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import notificationService from '../services/notificationService.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

describe('Notification System Integration Tests', () => {
    let mongoServer;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        await User.deleteMany({});
        await Notification.deleteMany({});
        // Clear notification service queue
        notificationService.deliveryQueue = [];
    });

    describe('Basic Notification Creation', () => {
        test('should create and send pickup status notification', async () => {
            // Create test user
            const user = new User({
                name: 'Test User',
                email: 'test@example.com',
                username: 'testuser',
                password: 'hashedpassword',
                role: 'citizen',
                profile: {
                    firstName: 'Test',
                    lastName: 'User',
                    preferences: {
                        notifications: {
                            pickup: true,
                            rewards: true,
                            challenges: true
                        }
                    }
                }
            });
            await user.save();

            // Send pickup status notification
            const notification = await notificationService.sendPickupStatusNotification(
                'pickup123',
                user._id,
                'pending',
                'assigned',
                { collectorId: 'collector123' }
            );

            expect(notification).toBeTruthy();
            expect(notification.recipientId.toString()).toBe(user._id.toString());
            expect(notification.type).toBe('pickup_status_change');
            expect(notification.data.oldStatus).toBe('pending');
            expect(notification.data.newStatus).toBe('assigned');
            expect(notification.channels).toContain('push');
            expect(notification.channels).toContain('in_app');
        });

        test('should respect user notification preferences', async () => {
            // Create user with pickup notifications disabled
            const user = new User({
                name: 'Test User',
                email: 'test2@example.com',
                username: 'testuser2',
                password: 'hashedpassword',
                role: 'citizen',
                profile: {
                    firstName: 'Test',
                    lastName: 'User',
                    preferences: {
                        notifications: {
                            pickup: false,
                            rewards: true,
                            challenges: true
                        }
                    }
                }
            });
            await user.save();

            // Try to send pickup status notification
            const notification = await notificationService.sendPickupStatusNotification(
                'pickup123',
                user._id,
                'pending',
                'assigned'
            );

            // Should return null because user has disabled pickup notifications
            expect(notification).toBeNull();
        });

        test('should send proximity notification', async () => {
            // Create test user
            const user = new User({
                name: 'Test User',
                email: 'test3@example.com',
                username: 'testuser3',
                password: 'hashedpassword',
                role: 'citizen',
                profile: {
                    firstName: 'Test',
                    lastName: 'User',
                    preferences: {
                        notifications: {
                            pickup: true,
                            rewards: true,
                            challenges: true
                        }
                    }
                }
            });
            await user.save();

            // Send proximity notification
            const notification = await notificationService.sendProximityNotification(
                user._id,
                'collector123',
                500,
                10
            );

            expect(notification).toBeTruthy();
            expect(notification.type).toBe('collector_nearby');
            expect(notification.data.distance).toBe(500);
            expect(notification.data.estimatedArrival).toBe(10);
            expect(notification.data.opportunityType).toBe('proximity');
        });

        test('should send reward redemption notification', async () => {
            // Create test user
            const user = new User({
                name: 'Test User',
                email: 'test4@example.com',
                username: 'testuser4',
                password: 'hashedpassword',
                role: 'citizen',
                profile: {
                    firstName: 'Test',
                    lastName: 'User',
                    preferences: {
                        notifications: {
                            pickup: true,
                            rewards: true,
                            challenges: true
                        }
                    }
                }
            });
            await user.save();

            // Mock redemption and reward
            const redemption = {
                _id: new mongoose.Types.ObjectId(),
                citizenId: user._id,
                pointsSpent: 100,
                redemptionCode: 'TEST123'
            };

            const reward = {
                _id: new mongoose.Types.ObjectId(),
                name: 'Test Reward'
            };

            // Send redemption notification
            const notification = await notificationService.sendRedemptionNotification(
                user._id,
                redemption,
                reward
            );

            expect(notification).toBeTruthy();
            expect(notification.type).toBe('reward_redemption_confirmation');
            expect(notification.data.pointsSpent).toBe(100);
            expect(notification.data.rewardName).toBe('Test Reward');
            expect(notification.priority).toBe('high');
            expect(notification.channels).toContain('email');
        });
    });

    describe('Notification Management', () => {
        test('should schedule notification for future delivery', async () => {
            // Create test user
            const user = new User({
                name: 'Test User',
                email: 'test5@example.com',
                username: 'testuser5',
                password: 'hashedpassword',
                role: 'citizen',
                profile: {
                    firstName: 'Test',
                    lastName: 'User'
                }
            });
            await user.save();

            // Schedule notification for 1 hour from now
            const scheduledTime = new Date(Date.now() + 60 * 60 * 1000);
            
            const notification = await notificationService.scheduleNotification({
                recipientId: user._id,
                type: 'system_announcement',
                title: 'Scheduled Test',
                message: 'This is a scheduled notification',
                channels: ['push', 'in_app'],
                priority: 'medium'
            }, scheduledTime);

            expect(notification).toBeTruthy();
            expect(notification.status).toBe('pending');
            expect(notification.scheduledFor.getTime()).toBe(scheduledTime.getTime());
        });

        test('should cancel scheduled notification', async () => {
            // Create test user
            const user = new User({
                name: 'Test User',
                email: 'test6@example.com',
                username: 'testuser6',
                password: 'hashedpassword',
                role: 'citizen',
                profile: {
                    firstName: 'Test',
                    lastName: 'User'
                }
            });
            await user.save();

            // Create a pending notification
            const notification = new Notification({
                recipientId: user._id,
                type: 'system_announcement',
                title: 'Test Notification',
                message: 'This will be cancelled',
                channels: ['push'],
                status: 'pending'
            });
            await notification.save();

            // Cancel the notification
            const cancelledNotification = await notificationService.cancelNotification(notification._id);

            expect(cancelledNotification.status).toBe('cancelled');
        });

        test('should send bulk notifications', async () => {
            // Create test users
            const users = [];
            for (let i = 0; i < 3; i++) {
                const user = new User({
                    name: `Test User ${i}`,
                    email: `test${i}@bulk.com`,
                    username: `testuser${i}`,
                    password: 'hashedpassword',
                    role: 'citizen',
                    profile: {
                        firstName: 'Test',
                        lastName: `User ${i}`
                    }
                });
                await user.save();
                users.push(user);
            }

            // Prepare bulk notifications
            const notifications = users.map(user => ({
                recipientId: user._id,
                type: 'system_announcement',
                title: 'Bulk Test',
                message: `Hello ${user.profile.firstName}!`,
                channels: ['push', 'in_app'],
                priority: 'medium'
            }));

            // Send bulk notifications
            const results = await notificationService.sendBulkNotifications(notifications);

            expect(results).toHaveLength(3);
            expect(results.every(r => r.success)).toBe(true);
            expect(results.every(r => r.notification)).toBeTruthy();
        });
    });

    describe('Notification Retrieval', () => {
        test('should get user notifications with pagination', async () => {
            // Create test user
            const user = new User({
                name: 'Test User',
                email: 'test7@example.com',
                username: 'testuser7',
                password: 'hashedpassword',
                role: 'citizen',
                profile: {
                    firstName: 'Test',
                    lastName: 'User'
                }
            });
            await user.save();

            // Create multiple notifications
            for (let i = 0; i < 5; i++) {
                const notification = new Notification({
                    recipientId: user._id,
                    type: 'system_announcement',
                    title: `Test Notification ${i}`,
                    message: `Message ${i}`,
                    channels: ['push'],
                    status: 'delivered'
                });
                await notification.save();
            }

            // Get notifications with pagination
            const result = await notificationService.getUserNotifications(user._id, {
                page: 1,
                limit: 3
            });

            expect(result.notifications).toHaveLength(3);
            expect(result.pagination.total).toBe(5);
            expect(result.pagination.pages).toBe(2);
        });

        test('should get notification statistics', async () => {
            // Create test user
            const user = new User({
                name: 'Test User',
                email: 'test8@example.com',
                username: 'testuser8',
                password: 'hashedpassword',
                role: 'citizen',
                profile: {
                    firstName: 'Test',
                    lastName: 'User'
                }
            });
            await user.save();

            // Create notifications with different statuses
            const statuses = ['delivered', 'delivered', 'read', 'failed'];
            for (let i = 0; i < statuses.length; i++) {
                const notification = new Notification({
                    recipientId: user._id,
                    type: 'system_announcement',
                    title: `Test Notification ${i}`,
                    message: `Message ${i}`,
                    channels: ['push'],
                    status: statuses[i]
                });
                await notification.save();
            }

            // Get notification statistics
            const stats = await notificationService.getUserNotificationStats(user._id);

            expect(stats.total).toBe(4);
            expect(stats.unread).toBe(2); // delivered notifications are unread
            expect(stats.read).toBe(1);
            expect(stats.failed).toBe(1);
        });
    });
});