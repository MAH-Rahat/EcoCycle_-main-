import fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import notificationService from '../services/notificationService.js';
import socketService from '../services/socketService.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// Feature: ecocycle-platform, Property 41: Comprehensive Notification System (Real-time Delivery)

describe('Real-time Notification Delivery Tests', () => {
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
        // Clear notification service queues
        notificationService.deliveryQueue = [];
        notificationService.priorityQueue = [];
        notificationService.batchQueue = [];
        notificationService.activeDeliveries.clear();
        notificationService.deliveryHistory = [];
    });

    // Mock classes for testing
    class MockUser {
        constructor(data) {
            this._id = new mongoose.Types.ObjectId();
            this.name = `${data.firstName} ${data.lastName}`;
            this.email = data.email;
            this.username = data.email.split('@')[0] + Math.random().toString(36).substr(2, 5);
            this.password = 'hashedpassword123';
            this.role = data.role || 'citizen';
            this.profile = {
                firstName: data.firstName || 'Test',
                lastName: data.lastName || 'User',
                preferences: {
                    notifications: data.notificationPreferences || {
                        pickup: true,
                        rewards: true,
                        challenges: true
                    }
                }
            };
            this.isActive = data.isActive !== false;
        }

        async save() {
            const user = new User(this);
            return await user.save();
        }
    }

    // Generators for property-based testing
    const userGen = () => fc.record({
        email: fc.integer({ min: 1, max: 1000000 }).map(n => `user${n}@test${n}.com`),
        firstName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        lastName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        role: fc.constantFrom('citizen', 'collector', 'admin'),
        notificationPreferences: fc.record({
            pickup: fc.boolean(),
            rewards: fc.boolean(),
            challenges: fc.boolean()
        })
    });

    const priorityGen = () => fc.constantFrom('low', 'medium', 'high', 'urgent');
    const channelsGen = () => fc.subarray(['push', 'email', 'sms', 'in_app'], { minLength: 1 });

    // Property: Real-time delivery optimization
    test('should optimize delivery based on priority and user connectivity', async () => {
        await fc.assert(fc.asyncProperty(
            userGen(),
            priorityGen(),
            fc.string({ minLength: 1, maxLength: 100 }),
            fc.string({ minLength: 1, maxLength: 500 }),
            channelsGen(),
            async (userData, priority, title, message, channels) => {
                // Create user
                const mockUser = new MockUser(userData);
                const user = await mockUser.save();

                // Create notification
                const notification = await notificationService.createNotification({
                    recipientId: user._id,
                    type: 'system_announcement',
                    title,
                    message,
                    data: { test: true },
                    channels,
                    priority
                });

                if (notification) {
                    // Check priority queue handling
                    if (priority === 'urgent') {
                        expect(notificationService.priorityQueue.length).toBeGreaterThan(0);
                        const queueItem = notificationService.priorityQueue.find(
                            item => item.notification._id.toString() === notification._id.toString()
                        );
                        expect(queueItem).toBeTruthy();
                        expect(queueItem.priority).toBe(4); // urgent priority score
                    } else {
                        // Non-urgent notifications go to batch queue
                        expect(notificationService.batchQueue.length).toBeGreaterThan(0);
                    }

                    // Verify notification properties
                    expect(notification.recipientId.toString()).toBe(user._id.toString());
                    expect(notification.title).toBe(title);
                    expect(notification.message).toBe(message);
                    expect(notification.priority).toBe(priority);
                    expect(notification.channels).toEqual(expect.arrayContaining(channels));
                }
            }
        ), { numRuns: 7 });
    });

    // Property: Batch processing optimization
    test('should batch non-urgent notifications for the same recipient', async () => {
        await fc.assert(fc.asyncProperty(
            userGen(),
            fc.array(fc.record({
                title: fc.string({ minLength: 1, maxLength: 100 }),
                message: fc.string({ minLength: 1, maxLength: 500 }),
                priority: fc.constantFrom('low', 'medium')
            }), { minLength: 2, maxLength: 5 }),
            async (userData, notificationData) => {
                // Create user
                const mockUser = new MockUser(userData);
                const user = await mockUser.save();

                // Create multiple notifications for the same user
                const notifications = [];
                for (const data of notificationData) {
                    const notification = await notificationService.createNotification({
                        recipientId: user._id,
                        type: 'system_announcement',
                        title: data.title,
                        message: data.message,
                        data: { test: true },
                        channels: ['push', 'in_app'],
                        priority: data.priority
                    });
                    
                    if (notification) {
                        notifications.push(notification);
                    }
                }

                // All notifications should be in batch queue
                expect(notificationService.batchQueue.length).toBe(notifications.length);

                // Process batch queue
                await notificationService.processBatchQueue();

                // Should have fewer items in delivery queue due to batching
                if (notifications.length > 1) {
                    expect(notificationService.deliveryQueue.length).toBeLessThanOrEqual(notifications.length);
                }
            }
        ), { numRuns: 5 });
    });

    // Property: Delivery timing optimization
    test('should optimize delivery timing based on user activity and priority', async () => {
        await fc.assert(fc.asyncProperty(
            userGen(),
            priorityGen(),
            async (userData, priority) => {
                // Create user
                const mockUser = new MockUser(userData);
                const user = await mockUser.save();

                // Create notification
                const notification = new Notification({
                    recipientId: user._id,
                    type: 'system_announcement',
                    title: 'Test Notification',
                    message: 'Testing delivery optimization',
                    channels: ['push', 'in_app'],
                    priority
                });

                // Test delivery timing optimization
                const optimization = await notificationService.optimizeDeliveryTiming(notification);

                expect(optimization).toBeTruthy();
                expect(optimization.deliverNow).toBeDefined();
                expect(optimization.reason).toBeDefined();

                // High priority notifications should always deliver immediately
                if (priority === 'urgent' || priority === 'high') {
                    expect(optimization.deliverNow).toBe(true);
                    expect(optimization.reason).toBe('high_priority');
                }

                // Should have valid reason
                const validReasons = ['user_active', 'high_priority', 'business_hours', 'optimized_timing', 'fallback'];
                expect(validReasons).toContain(optimization.reason);
            }
        ), { numRuns: 7 });
    });

    // Property: Delivery statistics tracking
    test('should accurately track delivery statistics and history', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(userGen(), { minLength: 1, maxLength: 5 }),
            fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
            async (usersData, deliveryResults) => {
                // Create users
                const users = [];
                for (const userData of usersData) {
                    const mockUser = new MockUser(userData);
                    const user = await mockUser.save();
                    users.push(user);
                }

                const initialStats = notificationService.getDeliveryStats();
                const initialTotalSent = initialStats.totalSent;
                const initialTotalFailed = initialStats.totalFailed;

                // Simulate deliveries with different outcomes
                let expectedSuccesses = 0;
                let expectedFailures = 0;

                for (let i = 0; i < deliveryResults.length; i++) {
                    const user = users[i % users.length];
                    const success = deliveryResults[i];
                    
                    const deliveryItem = {
                        notification: {
                            _id: new mongoose.Types.ObjectId(),
                            recipientId: user._id,
                            type: 'system_announcement',
                            title: `Test ${i}`,
                            message: `Message ${i}`,
                            channels: ['push'],
                            priority: 'medium'
                        },
                        addedAt: new Date(),
                        attempts: 0,
                        priority: 2
                    };

                    const deliveryId = `test_${i}_${Date.now()}`;
                    
                    if (success) {
                        notificationService.recordDeliverySuccess(deliveryId, deliveryItem);
                        expectedSuccesses++;
                    } else {
                        notificationService.recordDeliveryFailure(deliveryId, deliveryItem, new Error('Test failure'));
                        expectedFailures++;
                    }
                }

                // Check updated statistics
                const finalStats = notificationService.getDeliveryStats();
                
                expect(finalStats.totalSent).toBe(initialTotalSent + expectedSuccesses);
                expect(finalStats.totalFailed).toBe(initialTotalFailed + expectedFailures);
                
                // Check success rate calculation
                const totalDeliveries = finalStats.totalSent + finalStats.totalFailed;
                if (totalDeliveries > 0) {
                    const expectedSuccessRate = (finalStats.totalSent / totalDeliveries) * 100;
                    expect(Math.abs(finalStats.successRate - expectedSuccessRate)).toBeLessThan(0.01);
                }

                // Check delivery history
                const history = notificationService.getDeliveryHistory();
                expect(history.length).toBeGreaterThanOrEqual(Math.min(deliveryResults.length, notificationService.maxHistorySize));
            }
        ), { numRuns: 5 });
    });

    // Property: Real-time status tracking
    test('should provide accurate real-time notification status', async () => {
        await fc.assert(fc.asyncProperty(
            userGen(),
            fc.array(fc.record({
                type: fc.constantFrom('system_announcement', 'pickup_status_change', 'reward_redemption_confirmation'),
                status: fc.constantFrom('pending', 'sent', 'delivered', 'read', 'failed')
            }), { minLength: 1, maxLength: 10 }),
            async (userData, notificationData) => {
                // Create user
                const mockUser = new MockUser(userData);
                const user = await mockUser.save();

                // Create notifications with different statuses
                const notifications = [];
                for (const data of notificationData) {
                    const notification = new Notification({
                        recipientId: user._id,
                        type: data.type,
                        title: 'Test Notification',
                        message: 'Test message',
                        channels: ['push', 'in_app'],
                        priority: 'medium',
                        status: data.status
                    });
                    
                    await notification.save();
                    notifications.push(notification);
                }

                // Get notification status
                const status = await notificationService.getNotificationStatus(user._id);

                expect(status).toBeTruthy();
                expect(status.unreadCount).toBeDefined();
                expect(status.recentNotifications).toBeDefined();
                expect(status.stats).toBeDefined();
                expect(status.isConnected).toBeDefined();
                expect(status.lastActivity).toBeDefined();

                // Verify unread count matches delivered/sent notifications
                const expectedUnreadCount = notifications.filter(n => 
                    n.status === 'delivered' || n.status === 'sent'
                ).length;
                expect(status.unreadCount).toBe(expectedUnreadCount);

                // Verify recent notifications are returned
                expect(Array.isArray(status.recentNotifications)).toBe(true);
                expect(status.recentNotifications.length).toBeLessThanOrEqual(5);
            }
        ), { numRuns: 6 });
    });

    // Property: Notification acknowledgment handling
    test('should handle notification acknowledgments correctly', async () => {
        await fc.assert(fc.asyncProperty(
            userGen(),
            fc.constantFrom('sent', 'delivered'),
            async (userData, initialStatus) => {
                // Create user
                const mockUser = new MockUser(userData);
                const user = await mockUser.save();

                // Create notification
                const notification = new Notification({
                    recipientId: user._id,
                    type: 'system_announcement',
                    title: 'Test Notification',
                    message: 'Test message',
                    channels: ['push', 'in_app'],
                    priority: 'medium',
                    status: initialStatus
                });
                
                await notification.save();

                // Handle acknowledgment
                const acknowledgedNotification = await notificationService.handleNotificationAcknowledgment(
                    notification._id,
                    user._id
                );

                expect(acknowledgedNotification).toBeTruthy();
                expect(acknowledgedNotification.status).toBe('read');
                expect(acknowledgedNotification.readAt).toBeTruthy();
                expect(acknowledgedNotification.readAt).toBeInstanceOf(Date);

                // Verify in database
                const updatedNotification = await Notification.findById(notification._id);
                expect(updatedNotification.status).toBe('read');
                expect(updatedNotification.readAt).toBeTruthy();
            }
        ), { numRuns: 5 });
    });

    // Property: Concurrent delivery handling
    test('should handle concurrent deliveries without conflicts', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(userGen(), { minLength: 2, maxLength: 5 }),
            fc.integer({ min: 5, max: 15 }),
            async (usersData, notificationCount) => {
                // Create users
                const users = [];
                for (const userData of usersData) {
                    const mockUser = new MockUser(userData);
                    const user = await mockUser.save();
                    users.push(user);
                }

                // Create multiple notifications concurrently
                const notificationPromises = [];
                for (let i = 0; i < notificationCount; i++) {
                    const user = users[i % users.length];
                    const promise = notificationService.createNotification({
                        recipientId: user._id,
                        type: 'system_announcement',
                        title: `Concurrent Test ${i}`,
                        message: `Message ${i}`,
                        data: { testIndex: i },
                        channels: ['push', 'in_app'],
                        priority: i % 2 === 0 ? 'medium' : 'high'
                    });
                    notificationPromises.push(promise);
                }

                // Wait for all notifications to be created
                const notifications = await Promise.all(notificationPromises);
                const validNotifications = notifications.filter(n => n !== null);

                // Verify all notifications were created successfully
                expect(validNotifications.length).toBeGreaterThan(0);

                // Check that queues contain the notifications
                const totalQueueSize = 
                    notificationService.priorityQueue.length + 
                    notificationService.batchQueue.length + 
                    notificationService.deliveryQueue.length;
                
                expect(totalQueueSize).toBe(validNotifications.length);

                // Verify no duplicate notifications
                const notificationIds = validNotifications.map(n => n._id.toString());
                const uniqueIds = [...new Set(notificationIds)];
                expect(uniqueIds.length).toBe(validNotifications.length);
            }
        ), { numRuns: 5 });
    });

    // Property: Performance under load
    test('should maintain performance under notification load', async () => {
        const startTime = Date.now();
        
        // Create a user
        const mockUser = new MockUser({
            email: 'loadtest@example.com',
            firstName: 'Load',
            lastName: 'Test',
            role: 'citizen'
        });
        const user = await mockUser.save();

        // Create many notifications rapidly
        const notificationCount = 50;
        const notifications = [];
        
        for (let i = 0; i < notificationCount; i++) {
            const notification = await notificationService.createNotification({
                recipientId: user._id,
                type: 'system_announcement',
                title: `Load Test ${i}`,
                message: `Message ${i}`,
                data: { testIndex: i },
                channels: ['push', 'in_app'],
                priority: i % 10 === 0 ? 'urgent' : 'medium'
            });
            
            if (notification) {
                notifications.push(notification);
            }
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        // Performance assertions
        expect(notifications.length).toBe(notificationCount);
        expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
        
        // Average time per notification should be reasonable
        const avgTimePerNotification = totalTime / notificationCount;
        expect(avgTimePerNotification).toBeLessThan(100); // Less than 100ms per notification

        // Verify queue distribution
        const stats = notificationService.getDeliveryStats();
        expect(stats.queueSizes.priority).toBeGreaterThan(0); // Should have urgent notifications
        expect(stats.queueSizes.batch).toBeGreaterThan(0); // Should have batched notifications
    });
});