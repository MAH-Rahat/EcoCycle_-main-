import fc from 'fast-check';
import mongoose from 'mongoose';
import notificationService from '../services/notificationService.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

// Feature: ecocycle-platform, Property 41: Comprehensive Notification System

describe('Property 41: Comprehensive Notification System', () => {
    beforeEach(async () => {
        // Clear notification service queues and stop background processes
        notificationService.deliveryQueue = [];
        notificationService.priorityQueue = [];
        notificationService.batchQueue = [];
        notificationService.isProcessing = false;
        notificationService.activeDeliveries.clear();
        
        // Clear database - ensure notifications are cleared first
        await Notification.deleteMany({});
        await User.deleteMany({});
    });

    afterEach(async () => {
        // Ensure all queues are cleared and processing is stopped
        notificationService.deliveryQueue = [];
        notificationService.priorityQueue = [];
        notificationService.batchQueue = [];
        notificationService.isProcessing = false;
        notificationService.activeDeliveries.clear();
    });

    // Helper function to generate unique email
    const generateUniqueEmail = () => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `test_${timestamp}_${random}@example.com`;
    };

    // Helper function to create a test user
    const createTestUser = async (preferences = { pickup: true, rewards: true, challenges: true }, role = 'citizen') => {
        const email = generateUniqueEmail();
        // Generate a shorter username to stay within 30 character limit
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        const username = `u${timestamp}${random}`.substr(0, 30); // Ensure max 30 chars
        
        const userData = {
            name: 'Test User', // Required legacy field
            email,
            username, // Required unique field
            password: 'hashedpassword123',
            role,
            profile: {
                firstName: 'Test',
                lastName: 'User',
                preferences: {
                    notifications: preferences,
                    privacy: {
                        showInLeaderboard: true,
                        shareImpactData: true
                    }
                },
                addresses: []
            },
            isActive: true
        };

        const user = new User(userData);
        return await user.save();
    };

    // Property 41.1: Notification Creation and Channel Support
    test('should create notifications with correct channels and respect user preferences', async () => {
        await fc.assert(fc.asyncProperty(
            fc.record({
                pickup: fc.boolean(),
                rewards: fc.boolean(),
                challenges: fc.boolean()
            }),
            fc.constantFrom(
                'pickup_status_change',
                'reward_redemption_confirmation',
                'challenge_completed',
                'system_announcement'
            ),
            fc.subarray(['push', 'email', 'sms', 'in_app'], { minLength: 1 }),
            fc.constantFrom('low', 'medium', 'high', 'urgent'),
            async (preferences, notificationType, channels, priority) => {
                // Create user with specific preferences
                const user = await createTestUser(preferences);

                // Create notification
                const notification = await notificationService.createNotification({
                    recipientId: user._id,
                    type: notificationType,
                    title: 'Test Notification',
                    message: 'This is a test notification',
                    data: { test: true },
                    channels,
                    priority
                });

                // Map notification types to preference keys
                const typePreferenceMap = {
                    'pickup_status_change': 'pickup',
                    'reward_redemption_confirmation': 'rewards',
                    'challenge_completed': 'challenges',
                    'system_announcement': true // Always allowed
                };

                const preferenceKey = typePreferenceMap[notificationType];
                const shouldReceive = preferenceKey === true || preferences[preferenceKey] === true;

                if (shouldReceive) {
                    // Notification should be created
                    expect(notification).toBeTruthy();
                    expect(notification.recipientId.toString()).toBe(user._id.toString());
                    expect(notification.type).toBe(notificationType);
                    expect(notification.title).toBe('Test Notification');
                    expect(notification.message).toBe('This is a test notification');
                    expect(notification.priority).toBe(priority);
                    expect(notification.status).toBe('pending');
                    
                    // Verify channels are correctly set
                    expect(notification.channels).toEqual(expect.arrayContaining(channels));
                    expect(notification.channels.length).toBe(channels.length);
                    
                    // Verify all channels are valid
                    const validChannels = ['push', 'email', 'sms', 'in_app'];
                    for (const channel of notification.channels) {
                        expect(validChannels).toContain(channel);
                    }
                    
                    // Verify timing properties
                    expect(notification.createdAt).toBeDefined();
                    expect(notification.scheduledFor).toBeDefined();
                    expect(new Date(notification.scheduledFor)).toBeInstanceOf(Date);
                } else {
                    // Notification should not be created due to user preferences
                    expect(notification).toBeNull();
                }
            }
        ), { numRuns: 12 });
    });

    // Property 41.2: Pickup Status Notifications
    test('should send pickup status notifications correctly', async () => {
        await fc.assert(fc.asyncProperty(
            fc.boolean(), // pickup preference
            fc.constantFrom('pending', 'assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled'),
            fc.constantFrom('pending', 'assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled'),
            async (pickupPreference, oldStatus, newStatus) => {
                // Skip if statuses are the same
                if (oldStatus === newStatus) return;

                // Create user with pickup preference
                const user = await createTestUser({ pickup: pickupPreference, rewards: true, challenges: true });
                const pickupId = new mongoose.Types.ObjectId();

                // Send pickup status notification
                const notification = await notificationService.sendPickupStatusNotification(
                    pickupId,
                    user._id,
                    oldStatus,
                    newStatus,
                    { testData: true }
                );

                if (pickupPreference) {
                    // User allows pickup notifications
                    expect(notification).toBeTruthy();
                    expect(notification.recipientId.toString()).toBe(user._id.toString());
                    expect(notification.type).toBe('pickup_status_change');
                    expect(notification.data.oldStatus).toBe(oldStatus);
                    expect(notification.data.newStatus).toBe(newStatus);
                    expect(notification.data.pickupId.toString()).toBe(pickupId.toString());
                    expect(notification.channels).toContain('push');
                    expect(notification.channels).toContain('in_app');
                    
                    // Priority should be high for completion
                    if (newStatus === 'completed') {
                        expect(notification.priority).toBe('high');
                    } else {
                        expect(notification.priority).toBe('medium');
                    }
                } else {
                    // User has disabled pickup notifications
                    expect(notification).toBeNull();
                }
            }
        ), { numRuns: 7 });
    });

    // Property 41.3: Proximity Notifications
    test('should send proximity notifications when collectors are nearby', async () => {
        await fc.assert(fc.asyncProperty(
            fc.boolean(), // pickup preference
            fc.float({ min: 100, max: 2000 }), // distance
            fc.integer({ min: 1, max: 30 }), // estimated arrival
            async (pickupPreference, distance, estimatedArrival) => {
                // Create citizen and collector
                const citizen = await createTestUser({ pickup: pickupPreference, rewards: true, challenges: true }, 'citizen');
                const collector = await createTestUser({ pickup: true, rewards: true, challenges: true }, 'collector');

                // Send proximity notification
                const notification = await notificationService.sendProximityNotification(
                    citizen._id,
                    collector._id,
                    distance,
                    estimatedArrival
                );

                if (pickupPreference) {
                    // Citizen allows pickup notifications
                    expect(notification).toBeTruthy();
                    expect(notification.recipientId.toString()).toBe(citizen._id.toString());
                    expect(notification.type).toBe('collector_nearby');
                    expect(notification.data.collectorId.toString()).toBe(collector._id.toString());
                    expect(notification.data.distance).toBe(Math.round(distance));
                    expect(notification.data.estimatedArrival).toBe(estimatedArrival);
                    expect(notification.data.opportunityType).toBe('proximity');
                    expect(notification.channels).toContain('push');
                    expect(notification.channels).toContain('in_app');
                    expect(notification.priority).toBe('medium');
                } else {
                    // Citizen has disabled pickup notifications
                    expect(notification).toBeNull();
                }
            }
        ), { numRuns: 6 });
    });

    // Property 41.4: Reward Redemption Notifications
    test('should send reward redemption notifications correctly', async () => {
        await fc.assert(fc.asyncProperty(
            fc.boolean(), // rewards preference
            fc.string({ minLength: 1, maxLength: 100 }), // reward name
            fc.integer({ min: 10, max: 10000 }), // points spent
            async (rewardsPreference, rewardName, pointsSpent) => {
                // Create user with rewards preference
                const user = await createTestUser({ pickup: true, rewards: rewardsPreference, challenges: true });

                // Create mock reward and redemption
                const reward = {
                    _id: new mongoose.Types.ObjectId(),
                    name: rewardName,
                    pointsCost: pointsSpent
                };

                const redemption = {
                    _id: new mongoose.Types.ObjectId(),
                    citizenId: user._id,
                    rewardId: reward._id,
                    pointsSpent,
                    status: 'pending',
                    redemptionCode: 'TEST123'
                };

                // Send redemption notification
                const notification = await notificationService.sendRedemptionNotification(
                    user._id,
                    redemption,
                    reward
                );

                if (rewardsPreference) {
                    // User allows reward notifications
                    expect(notification).toBeTruthy();
                    expect(notification.recipientId.toString()).toBe(user._id.toString());
                    expect(notification.type).toBe('reward_redemption_confirmation');
                    expect(notification.data.rewardName).toBe(rewardName);
                    expect(notification.data.pointsSpent).toBe(pointsSpent);
                    expect(notification.data.redemptionId.toString()).toBe(redemption._id.toString());
                    expect(notification.channels).toContain('push');
                    expect(notification.channels).toContain('email');
                    expect(notification.channels).toContain('in_app');
                    expect(notification.priority).toBe('high');
                } else {
                    // User has disabled reward notifications
                    expect(notification).toBeNull();
                }
            }
        ), { numRuns: 6 });
    });

    // Property 41.5: System Announcements Always Delivered
    test('should always deliver system announcements regardless of preferences', async () => {
        await fc.assert(fc.asyncProperty(
            fc.record({
                pickup: fc.boolean(),
                rewards: fc.boolean(),
                challenges: fc.boolean()
            }),
            fc.string({ minLength: 1, maxLength: 100 }), // title
            fc.string({ minLength: 1, maxLength: 500 }), // message
            fc.constantFrom('low', 'medium', 'high', 'urgent'), // priority
            async (preferences, title, message, priority) => {
                // Clear all users before creating a new one
                await User.deleteMany({});
                
                // Create user with any preferences
                const user = await createTestUser(preferences);

                // Send system announcement
                const notifications = await notificationService.sendSystemAnnouncement(
                    title,
                    message,
                    'all',
                    priority
                );

                // Should always receive system announcements
                expect(notifications).toHaveLength(1);
                
                const notification = notifications[0];
                expect(notification.recipientId.toString()).toBe(user._id.toString());
                expect(notification.type).toBe('system_announcement');
                expect(notification.title).toBe(title);
                expect(notification.message).toBe(message);
                expect(notification.priority).toBe(priority);
                expect(notification.data.targetAudience).toBe('all');
                expect(notification.channels).toContain('push');
                expect(notification.channels).toContain('in_app');
            }
        ), { numRuns: 5 });
    });

    // Property 41.6: Notification Timing and Performance
    test('should create notifications within acceptable time limits', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('system_announcement', 'pickup_status_change', 'reward_redemption_confirmation'),
            fc.string({ minLength: 1, maxLength: 100 }),
            fc.string({ minLength: 1, maxLength: 500 }),
            async (type, title, message) => {
                // Create user who accepts all notifications
                const user = await createTestUser({ pickup: true, rewards: true, challenges: true });

                const startTime = new Date();

                // Create notification
                const notification = await notificationService.createNotification({
                    recipientId: user._id,
                    type,
                    title,
                    message,
                    data: { test: true },
                    channels: ['push', 'in_app'],
                    priority: 'medium'
                });

                const endTime = new Date();
                const processingTime = endTime - startTime;

                // Should be created quickly (within 1 second for testing)
                expect(processingTime).toBeLessThan(1000);

                // Verify notification was created correctly
                expect(notification).toBeTruthy();
                expect(notification.recipientId.toString()).toBe(user._id.toString());
                expect(notification.type).toBe(type);
                expect(notification.title).toBe(title);
                expect(notification.message).toBe(message);
                expect(notification.status).toBe('pending');
                expect(notification.createdAt).toBeDefined();
                expect(notification.scheduledFor).toBeDefined();
            }
        ), { numRuns: 5 });
    });
});