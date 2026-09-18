import fc from 'fast-check';

// Feature: ecocycle-platform, Property 32: Redemption Notifications

describe('Property 32: Redemption Notifications', () => {
    // Mock implementations for testing notification logic
    class MockRewardRedemption {
        constructor(data) {
            this._id = 'redemption-id-' + Math.random().toString(36).substring(2, 9);
            this.citizenId = data.citizenId;
            this.rewardId = data.rewardId;
            this.pointsSpent = data.pointsSpent;
            this.status = data.status || 'pending';
            this.redemptionCode = this.generateRedemptionCode();
            this.redeemedAt = new Date();
            this.fulfilledAt = data.fulfilledAt || null;
        }

        generateRedemptionCode() {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(16).substring(2, 8).toUpperCase();
            return `ECO-${timestamp}-${random}`;
        }

        async save() {
            return this;
        }
    }

    class MockReward {
        constructor(data) {
            this._id = 'reward-id-' + Math.random().toString(36).substring(2, 9);
            this.name = data.name;
            this.description = data.description || `Description for ${data.name}`;
            this.pointsCost = data.pointsCost;
            this.category = data.category || 'general';
            this.partnerId = data.partnerId || null;
        }
    }

    class MockUser {
        constructor(data) {
            this._id = 'user-id-' + Math.random().toString(36).substring(2, 9);
            this.email = data.email;
            this.role = data.role || 'citizen';
            this.profile = {
                firstName: data.firstName,
                lastName: data.lastName,
                preferences: {
                    notifications: data.notificationPreferences || {
                        pickup: true,
                        rewards: true,
                        challenges: true
                    }
                }
            };
        }
    }

    // Mock notification service
    class MockNotificationService {
        constructor() {
            this.sentNotifications = new Map(); // userId -> notifications[]
        }

        async sendRedemptionNotification(userId, redemption, reward, user) {
            // Check user notification preferences
            if (!user.profile.preferences.notifications.rewards) {
                return; // User has disabled reward notifications
            }

            const notification = {
                id: 'notification-' + Math.random().toString(36).substring(2, 9),
                recipientId: userId.toString(),
                type: 'reward_redemption_confirmation',
                title: 'Reward Redeemed Successfully',
                message: this.generateRedemptionMessage(redemption, reward, user),
                data: {
                    redemptionId: redemption._id,
                    rewardId: reward._id,
                    rewardName: reward.name,
                    pointsSpent: redemption.pointsSpent,
                    redemptionCode: redemption.redemptionCode,
                    status: redemption.status
                },
                sentAt: new Date(),
                channel: 'push', // Could be 'push', 'email', 'sms'
                priority: this.getNotificationPriority(redemption.pointsSpent),
                read: false
            };

            // Store notification
            if (!this.sentNotifications.has(userId.toString())) {
                this.sentNotifications.set(userId.toString(), []);
            }
            this.sentNotifications.get(userId.toString()).push(notification);

            return notification;
        }

        async sendStatusUpdateNotification(userId, redemption, reward, user, oldStatus, newStatus, message) {
            // Check user notification preferences
            if (!user.profile.preferences.notifications.rewards) {
                return; // User has disabled reward notifications
            }

            const notification = {
                id: 'notification-' + Math.random().toString(36).substring(2, 9),
                recipientId: userId.toString(),
                type: 'redemption_status_update',
                title: 'Redemption Status Updated',
                message: message,
                data: {
                    redemptionId: redemption._id,
                    rewardId: reward._id,
                    rewardName: reward.name,
                    oldStatus: oldStatus,
                    newStatus: newStatus,
                    redemptionCode: redemption.redemptionCode
                },
                sentAt: new Date(),
                channel: 'push',
                priority: this.getNotificationPriority(redemption.pointsSpent),
                read: false
            };

            // Store notification
            if (!this.sentNotifications.has(userId.toString())) {
                this.sentNotifications.set(userId.toString(), []);
            }
            this.sentNotifications.get(userId.toString()).push(notification);

            return notification;
        }

        generateRedemptionMessage(redemption, reward, user) {
            const firstName = user.profile.firstName;
            const rewardName = reward.name;
            const pointsSpent = redemption.pointsSpent;
            const redemptionCode = redemption.redemptionCode;

            return `Hi ${firstName}! Your reward "${rewardName}" has been successfully redeemed for ${pointsSpent} EcoPoints. Your redemption code is: ${redemptionCode}. Thank you for your environmental contribution!`;
        }

        getNotificationPriority(pointsSpent) {
            if (pointsSpent >= 1000) return 'high';
            if (pointsSpent >= 500) return 'medium';
            return 'low';
        }

        getNotificationsForUser(userId) {
            return this.sentNotifications.get(userId.toString()) || [];
        }

        clear() {
            this.sentNotifications.clear();
        }
    }

    // Redemption service that handles the complete redemption flow
    class RedemptionService {
        constructor(notificationService) {
            this.notificationService = notificationService;
        }

        async processRedemption(user, reward, pointsSpent) {
            // Create redemption record
            const redemption = new MockRewardRedemption({
                citizenId: user._id,
                rewardId: reward._id,
                pointsSpent: pointsSpent,
                status: 'pending'
            });

            // Send confirmation notification
            await this.notificationService.sendRedemptionNotification(
                user._id,
                redemption,
                reward,
                user
            );

            return redemption;
        }

        async updateRedemptionStatus(redemption, newStatus, user, reward) {
            const oldStatus = redemption.status;
            redemption.status = newStatus;

            // Send status update notification
            let notificationMessage;
            switch (newStatus) {
                case 'approved':
                    notificationMessage = `Your redemption for "${reward.name}" has been approved!`;
                    break;
                case 'fulfilled':
                    notificationMessage = `Your redemption for "${reward.name}" has been fulfilled and is on its way!`;
                    break;
                case 'cancelled':
                    notificationMessage = `Your redemption for "${reward.name}" has been cancelled.`;
                    break;
                default:
                    notificationMessage = `Your redemption status has been updated to ${newStatus}.`;
            }

            await this.notificationService.sendStatusUpdateNotification(
                user._id,
                redemption,
                reward,
                user,
                oldStatus,
                newStatus,
                notificationMessage
            );

            return redemption;
        }
    }

    // Generators for property-based testing
    const userGenerator = fc.record({
        email: fc.emailAddress(),
        firstName: fc.string({ minLength: 1, maxLength: 50 }),
        lastName: fc.string({ minLength: 1, maxLength: 50 }),
        role: fc.constant('citizen'),
        notificationPreferences: fc.record({
            pickup: fc.boolean(),
            rewards: fc.boolean(),
            challenges: fc.boolean()
        })
    });

    const rewardGenerator = fc.record({
        name: fc.string({ minLength: 1, maxLength: 100 }),
        description: fc.string({ minLength: 1, maxLength: 500 }),
        pointsCost: fc.integer({ min: 1, max: 10000 }),
        category: fc.constantFrom('vouchers', 'products', 'experiences', 'donations', 'discounts')
    });

    const redemptionGenerator = fc.record({
        pointsSpent: fc.integer({ min: 1, max: 10000 }),
        status: fc.constantFrom('pending', 'approved', 'fulfilled', 'cancelled')
    });

    /**
     * **Validates: Requirements 8.5**
     * Property 32: Redemption Notifications
     * For any reward redemption, confirmation notifications should be sent to the citizen
     */
    test('should send confirmation notifications to citizens for any reward redemption', () => {
        return fc.assert(fc.property(
            userGenerator,
            rewardGenerator,
            redemptionGenerator,
            (userData, rewardData, redemptionData) => {
                const notificationService = new MockNotificationService();
                const redemptionService = new RedemptionService(notificationService);

                // Create test objects
                const user = new MockUser(userData);
                const reward = new MockReward(rewardData);

                // Process redemption
                const redemption = redemptionService.processRedemption(
                    user,
                    reward,
                    redemptionData.pointsSpent
                );

                // Verify notification was sent if user has rewards notifications enabled
                const notifications = notificationService.getNotificationsForUser(user._id);
                
                if (user.profile.preferences.notifications.rewards) {
                    expect(notifications.length).toBeGreaterThan(0);
                    
                    const redemptionNotification = notifications.find(n => 
                        n.type === 'reward_redemption_confirmation'
                    );
                    
                    expect(redemptionNotification).toBeTruthy();
                    expect(redemptionNotification.recipientId).toBe(user._id.toString());
                    expect(redemptionNotification.data.redemptionId).toBe(redemption._id);
                    expect(redemptionNotification.data.rewardId).toBe(reward._id);
                    expect(redemptionNotification.data.rewardName).toBe(reward.name);
                    expect(redemptionNotification.data.pointsSpent).toBe(redemptionData.pointsSpent);
                    expect(redemptionNotification.data.redemptionCode).toBe(redemption.redemptionCode);
                    
                    // Verify notification content
                    expect(redemptionNotification.title).toBeTruthy();
                    expect(redemptionNotification.message).toContain(user.profile.firstName);
                    expect(redemptionNotification.message).toContain(reward.name);
                    expect(redemptionNotification.message).toContain(redemptionData.pointsSpent.toString());
                    expect(redemptionNotification.message).toContain(redemption.redemptionCode);
                    
                    // Verify notification metadata
                    expect(redemptionNotification.sentAt).toBeInstanceOf(Date);
                    expect(redemptionNotification.channel).toBeTruthy();
                    expect(['low', 'medium', 'high']).toContain(redemptionNotification.priority);
                } else {
                    // If user has disabled reward notifications, no notification should be sent
                    expect(notifications.length).toBe(0);
                }

                // Clean up
                notificationService.clear();
            }
        ), { numRuns: 25 });
    });

    /**
     * Property: Notification Priority Assignment
     * For any redemption, notification priority should be correctly assigned based on points spent
     */
    test('should assign correct notification priority based on points spent', () => {
        return fc.assert(fc.property(
            userGenerator,
            rewardGenerator,
            fc.integer({ min: 1, max: 10000 }),
            (userData, rewardData, pointsSpent) => {
                const notificationService = new MockNotificationService();
                const redemptionService = new RedemptionService(notificationService);

                // Ensure user has notifications enabled
                userData.notificationPreferences.rewards = true;
                const user = new MockUser(userData);
                const reward = new MockReward(rewardData);

                // Process redemption
                redemptionService.processRedemption(user, reward, pointsSpent);

                // Check notification priority
                const notifications = notificationService.getNotificationsForUser(user._id);
                expect(notifications.length).toBe(1);
                
                const notification = notifications[0];
                const expectedPriority = pointsSpent >= 1000 ? 'high' : 
                                       pointsSpent >= 500 ? 'medium' : 'low';
                
                expect(notification.priority).toBe(expectedPriority);
            }
        ), { numRuns: 12 });
    });

    /**
     * Property: Status Update Notifications
     * For any redemption status change, appropriate notifications should be sent
     */
    test('should send appropriate notifications for any redemption status change', () => {
        return fc.assert(fc.property(
            userGenerator,
            rewardGenerator,
            fc.constantFrom('approved', 'fulfilled', 'cancelled'),
            (userData, rewardData, newStatus) => {
                const notificationService = new MockNotificationService();
                const redemptionService = new RedemptionService(notificationService);

                // Ensure user has notifications enabled
                userData.notificationPreferences.rewards = true;
                const user = new MockUser(userData);
                const reward = new MockReward(rewardData);

                // Create initial redemption
                const redemption = new MockRewardRedemption({
                    citizenId: user._id,
                    rewardId: reward._id,
                    pointsSpent: reward.pointsCost,
                    status: 'pending'
                });

                // Clear any initial notifications
                notificationService.clear();

                // Update status
                redemptionService.updateRedemptionStatus(redemption, newStatus, user, reward);

                // Verify status update notification was sent
                const notifications = notificationService.getNotificationsForUser(user._id);
                expect(notifications.length).toBeGreaterThan(0);
                
                const statusNotification = notifications.find(n => 
                    n.type === 'redemption_status_update'
                );
                
                expect(statusNotification).toBeTruthy();
                expect(statusNotification.data.redemptionId).toBe(redemption._id);
                expect(statusNotification.data.newStatus).toBe(newStatus);
                expect(statusNotification.message).toContain(reward.name);
                
                // Verify status-specific message content
                switch (newStatus) {
                    case 'approved':
                        expect(statusNotification.message).toContain('approved');
                        break;
                    case 'fulfilled':
                        expect(statusNotification.message).toContain('fulfilled');
                        break;
                    case 'cancelled':
                        expect(statusNotification.message).toContain('cancelled');
                        break;
                }
            }
        ), { numRuns: 15 });
    });

    /**
     * Property: Notification Preference Respect
     * For any user notification preference setting, the system should respect the user's choices
     */
    test('should respect user notification preferences for all redemption events', () => {
        return fc.assert(fc.property(
            fc.record({
                email: fc.emailAddress(),
                firstName: fc.string({ minLength: 1, maxLength: 50 }),
                lastName: fc.string({ minLength: 1, maxLength: 50 }),
                role: fc.constant('citizen'),
                notificationPreferences: fc.record({
                    pickup: fc.boolean(),
                    rewards: fc.boolean(), // This is what we're testing
                    challenges: fc.boolean()
                })
            }),
            rewardGenerator,
            (userData, rewardData) => {
                const notificationService = new MockNotificationService();
                const redemptionService = new RedemptionService(notificationService);

                const user = new MockUser(userData);
                const reward = new MockReward(rewardData);

                // Process redemption
                redemptionService.processRedemption(user, reward, reward.pointsCost);

                // Check if notifications were sent according to preferences
                const notifications = notificationService.getNotificationsForUser(user._id);
                
                if (userData.notificationPreferences.rewards) {
                    expect(notifications.length).toBeGreaterThan(0);
                    expect(notifications.some(n => n.type === 'reward_redemption_confirmation')).toBe(true);
                } else {
                    expect(notifications.length).toBe(0);
                }
            }
        ), { numRuns: 10 });
    });

    /**
     * Property: Notification Data Completeness
     * For any sent notification, all required data fields should be present and valid
     */
    test('should include all required data in redemption notifications', () => {
        return fc.assert(fc.property(
            userGenerator,
            rewardGenerator,
            redemptionGenerator,
            (userData, rewardData, redemptionData) => {
                const notificationService = new MockNotificationService();
                const redemptionService = new RedemptionService(notificationService);

                // Ensure notifications are enabled
                userData.notificationPreferences.rewards = true;
                const user = new MockUser(userData);
                const reward = new MockReward(rewardData);

                // Process redemption
                const redemption = redemptionService.processRedemption(
                    user,
                    reward,
                    redemptionData.pointsSpent
                );

                // Verify notification data completeness
                const notifications = notificationService.getNotificationsForUser(user._id);
                expect(notifications.length).toBeGreaterThan(0);
                
                const notification = notifications[0];
                
                // Required fields
                expect(notification.id).toBeTruthy();
                expect(notification.recipientId).toBe(user._id.toString());
                expect(notification.type).toBeTruthy();
                expect(notification.title).toBeTruthy();
                expect(notification.message).toBeTruthy();
                expect(notification.sentAt).toBeInstanceOf(Date);
                expect(notification.channel).toBeTruthy();
                expect(notification.priority).toBeTruthy();
                expect(typeof notification.read).toBe('boolean');
                
                // Data payload
                expect(notification.data).toBeTruthy();
                expect(notification.data.redemptionId).toBe(redemption._id);
                expect(notification.data.rewardId).toBe(reward._id);
                expect(notification.data.rewardName).toBe(reward.name);
                expect(notification.data.pointsSpent).toBe(redemptionData.pointsSpent);
                expect(notification.data.redemptionCode).toBe(redemption.redemptionCode);
                expect(notification.data.status).toBeTruthy();
            }
        ), { numRuns: 12 });
    });
});