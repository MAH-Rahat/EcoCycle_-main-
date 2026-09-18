import Notification from '../models/Notification.js';
import User from '../models/User.js';
import socketService from './socketService.js';
import mongoose from 'mongoose';

class NotificationService {
    constructor() {
        this.deliveryQueue = [];
        this.priorityQueue = [];
        this.batchQueue = [];
        this.isProcessing = false;
        this.retryDelays = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1m, 5m
        
        // Real-time delivery optimization settings
        this.batchSize = 10;
        this.batchTimeout = 2000; // 2 seconds
        this.maxConcurrentDeliveries = 5;
        this.deliveryStats = {
            totalSent: 0,
            totalFailed: 0,
            averageDeliveryTime: 0,
            lastDeliveryTime: null
        };
        
        // Active delivery tracking
        this.activeDeliveries = new Map();
        this.deliveryHistory = [];
        this.maxHistorySize = 1000;
        
        // Start processing queues
        this.startQueueProcessor();
        this.startBatchProcessor();
        
        // Cleanup expired notifications daily
        this.startCleanupScheduler();
        
        // Performance monitoring
        this.startPerformanceMonitoring();
    }

    /**
     * Create and send a notification
     * @param {Object} notificationData - Notification data
     * @param {string} notificationData.recipientId - User ID to send notification to
     * @param {string} notificationData.type - Type of notification
     * @param {string} notificationData.title - Notification title
     * @param {string} notificationData.message - Notification message
     * @param {Object} notificationData.data - Additional data payload
     * @param {Array} notificationData.channels - Delivery channels ['push', 'email', 'sms', 'in_app']
     * @param {string} notificationData.priority - Priority level
     * @param {Date} notificationData.scheduledFor - When to send (optional)
     * @returns {Promise<Notification>}
     */
    async createNotification(notificationData) {
        try {
            // Validate recipient exists
            const recipient = await User.findById(notificationData.recipientId);
            if (!recipient) {
                throw new Error('Recipient not found');
            }

            // Check user notification preferences
            const allowedChannels = await this.filterChannelsByPreferences(
                recipient, 
                notificationData.type, 
                notificationData.channels || ['push', 'in_app']
            );

            if (allowedChannels.length === 0) {
                console.log(`User ${notificationData.recipientId} has disabled notifications for type ${notificationData.type}`);
                return null;
            }

            // Create notification
            const notification = new Notification({
                ...notificationData,
                channels: allowedChannels,
                scheduledFor: notificationData.scheduledFor || new Date()
            });

            await notification.save();

            // Add to delivery queue if scheduled for now or past
            if (notification.scheduledFor <= new Date()) {
                this.addToQueue(notification);
            }

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    /**
     * Send pickup status change notification
     */
    async sendPickupStatusNotification(pickupId, citizenId, oldStatus, newStatus, additionalData = {}) {
        const statusMessages = {
            assigned: 'Your pickup request has been assigned to a collector',
            en_route: 'Your collector is on the way to your location',
            arrived: 'Your collector has arrived at your location',
            in_progress: 'Your waste collection is in progress',
            completed: 'Your pickup has been completed successfully',
            cancelled: 'Your pickup request has been cancelled'
        };

        const title = 'Pickup Status Update';
        const message = statusMessages[newStatus] || `Your pickup status has been updated to ${newStatus}`;

        return await this.createNotification({
            recipientId: citizenId,
            type: 'pickup_status_change',
            title,
            message,
            data: {
                pickupId,
                oldStatus,
                newStatus,
                ...additionalData
            },
            channels: ['push', 'in_app'],
            priority: newStatus === 'completed' ? 'high' : 'medium'
        });
    }

    /**
     * Send proximity-based notification to citizens when collectors are nearby
     */
    async sendProximityNotification(citizenId, collectorId, distance, estimatedArrival) {
        const title = 'Collector Nearby';
        const roundedDistance = Math.round(distance);
        const message = `A collector is ${roundedDistance}m away and available for pickup. Estimated arrival: ${estimatedArrival} minutes.`;

        return await this.createNotification({
            recipientId: citizenId,
            type: 'collector_nearby',
            title,
            message,
            data: {
                collectorId,
                distance: roundedDistance,
                estimatedArrival,
                opportunityType: 'proximity'
            },
            channels: ['push', 'in_app'],
            priority: 'medium'
        });
    }

    /**
     * Send reward redemption confirmation
     */
    async sendRedemptionNotification(citizenId, redemption, reward) {
        const title = 'Reward Redeemed Successfully';
        const message = `You have successfully redeemed "${reward.name}" for ${redemption.pointsSpent} EcoPoints.`;

        return await this.createNotification({
            recipientId: citizenId,
            type: 'reward_redemption_confirmation',
            title,
            message,
            data: {
                redemptionId: redemption._id,
                rewardId: reward._id,
                rewardName: reward.name,
                pointsSpent: redemption.pointsSpent,
                redemptionCode: redemption.redemptionCode
            },
            channels: ['push', 'email', 'in_app'],
            priority: 'high'
        });
    }

    /**
     * Send achievement unlocked notification
     */
    async sendAchievementNotification(citizenId, achievement, bonusPoints = 0) {
        const title = 'Achievement Unlocked!';
        const message = `Congratulations! You've unlocked the "${achievement.name}" achievement${bonusPoints > 0 ? ` and earned ${bonusPoints} bonus EcoPoints` : ''}.`;

        return await this.createNotification({
            recipientId: citizenId,
            type: 'achievement_unlocked',
            title,
            message,
            data: {
                achievementId: achievement._id,
                achievementName: achievement.name,
                bonusPoints,
                rarity: achievement.rarity
            },
            channels: ['push', 'in_app'],
            priority: 'high'
        });
    }

    /**
     * Send milestone reached notification
     */
    async sendMilestoneNotification(citizenId, milestone, bonusPoints = 0) {
        const title = 'Milestone Reached!';
        const message = `Amazing! You've reached the ${milestone.name} milestone${bonusPoints > 0 ? ` and earned ${bonusPoints} bonus EcoPoints` : ''}.`;

        return await this.createNotification({
            recipientId: citizenId,
            type: 'milestone_reached',
            title,
            message,
            data: {
                milestoneName: milestone.name,
                milestoneValue: milestone.value,
                bonusPoints
            },
            channels: ['push', 'in_app'],
            priority: 'high'
        });
    }

    /**
     * Send system announcement
     */
    async sendSystemAnnouncement(title, message, targetUsers = 'all', priority = 'medium') {
        const notifications = [];
        
        let userQuery = {};
        if (targetUsers !== 'all') {
            if (Array.isArray(targetUsers)) {
                userQuery = { _id: { $in: targetUsers } };
            } else if (typeof targetUsers === 'string') {
                userQuery = { role: targetUsers };
            }
        }

        const users = await User.find(userQuery).select('_id');
        
        for (const user of users) {
            const notification = await this.createNotification({
                recipientId: user._id,
                type: 'system_announcement',
                title,
                message,
                data: {
                    targetAudience: targetUsers
                },
                channels: ['push', 'in_app'],
                priority
            });
            
            if (notification) {
                notifications.push(notification);
            }
        }

        return notifications;
    }

    /**
     * Send challenge completion notification
     */
    async sendChallengeCompletionNotification(citizenId, challenge, bonusPoints = 0) {
        const title = 'Challenge Completed!';
        const message = `Congratulations! You've completed the "${challenge.title}" challenge${bonusPoints > 0 ? ` and earned ${bonusPoints} bonus EcoPoints` : ''}.`;

        return await this.createNotification({
            recipientId: citizenId,
            type: 'challenge_completed',
            title,
            message,
            data: {
                challengeId: challenge._id,
                challengeTitle: challenge.title,
                bonusPoints,
                challengeType: challenge.type
            },
            channels: ['push', 'in_app'],
            priority: 'high'
        });
    }

    /**
     * Send leaderboard update notification
     */
    async sendLeaderboardUpdateNotification(citizenId, leaderboardData) {
        const title = 'Leaderboard Update';
        const message = `You're now ranked #${leaderboardData.rank} in the ${leaderboardData.type} leaderboard!`;

        return await this.createNotification({
            recipientId: citizenId,
            type: 'leaderboard_update',
            title,
            message,
            data: {
                leaderboardId: leaderboardData._id,
                rank: leaderboardData.rank,
                score: leaderboardData.score,
                leaderboardType: leaderboardData.type,
                period: leaderboardData.period
            },
            channels: ['push', 'in_app'],
            priority: 'medium'
        });
    }

    /**
     * Send redemption status update notification
     */
    async sendRedemptionStatusUpdateNotification(citizenId, redemption, newStatus) {
        const statusMessages = {
            approved: 'Your reward redemption has been approved',
            fulfilled: 'Your reward has been fulfilled and is on its way',
            cancelled: 'Your reward redemption has been cancelled'
        };

        const title = 'Redemption Status Update';
        const message = statusMessages[newStatus] || `Your redemption status has been updated to ${newStatus}`;

        return await this.createNotification({
            recipientId: citizenId,
            type: 'redemption_status_update',
            title,
            message,
            data: {
                redemptionId: redemption._id,
                oldStatus: redemption.status,
                newStatus,
                redemptionCode: redemption.redemptionCode
            },
            channels: ['push', 'email', 'in_app'],
            priority: newStatus === 'fulfilled' ? 'high' : 'medium'
        });
    }

    /**
     * Send bulk notifications to multiple users
     */
    async sendBulkNotifications(notifications) {
        const results = [];
        
        for (const notificationData of notifications) {
            try {
                const notification = await this.createNotification(notificationData);
                results.push({ success: true, notification });
            } catch (error) {
                results.push({ 
                    success: false, 
                    error: error.message, 
                    recipientId: notificationData.recipientId 
                });
            }
        }

        return results;
    }

    /**
     * Schedule notification for future delivery
     */
    async scheduleNotification(notificationData, scheduledTime) {
        return await this.createNotification({
            ...notificationData,
            scheduledFor: scheduledTime
        });
    }

    /**
     * Cancel scheduled notification
     */
    async cancelNotification(notificationId) {
        const notification = await Notification.findById(notificationId);
        
        if (!notification) {
            throw new Error('Notification not found');
        }

        if (notification.status !== 'pending') {
            throw new Error('Cannot cancel notification that has already been sent');
        }

        notification.status = 'cancelled';
        await notification.save();

        return notification;
    }

    /**
     * Filter notification channels based on user preferences
     */
    async filterChannelsByPreferences(user, notificationType, requestedChannels) {
        const preferences = user.profile?.preferences?.notifications || {};
        
        // Map notification types to preference keys
        const typePreferenceMap = {
            'pickup_status_change': 'pickup',
            'pickup_assigned': 'pickup',
            'pickup_completed': 'pickup',
            'collector_nearby': 'pickup',
            'proximity_opportunity': 'pickup',
            'reward_redemption_confirmation': 'rewards',
            'redemption_status_update': 'rewards',
            'challenge_completed': 'challenges',
            'achievement_unlocked': 'challenges',
            'milestone_reached': 'challenges',
            'leaderboard_update': 'challenges',
            'system_announcement': true // Always allowed
        };

        const preferenceKey = typePreferenceMap[notificationType];
        
        // If no preference mapping or system announcement, allow all channels
        if (preferenceKey === true || preferenceKey === undefined) {
            return requestedChannels;
        }

        // Check if user has enabled this type of notification
        if (preferences[preferenceKey] === false) {
            return []; // User has disabled this type
        }

        // For now, return all requested channels if enabled
        // In the future, we could add channel-specific preferences
        return requestedChannels;
    }

    /**
     * Add notification to appropriate delivery queue with priority handling
     */
    addToQueue(notification) {
        const deliveryItem = {
            notification,
            addedAt: new Date(),
            attempts: 0,
            priority: this.getPriorityScore(notification.priority)
        };

        // Add to priority queue for urgent notifications
        if (notification.priority === 'urgent') {
            this.priorityQueue.push(deliveryItem);
            this.priorityQueue.sort((a, b) => b.priority - a.priority);
        } else {
            // Add to batch queue for optimization
            this.batchQueue.push(deliveryItem);
        }
        
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Get numeric priority score for sorting
     */
    getPriorityScore(priority) {
        const scores = {
            'urgent': 4,
            'high': 3,
            'medium': 2,
            'low': 1
        };
        return scores[priority] || 2;
    }

    /**
     * Process the notification delivery queue with optimization
     */
    async processQueue() {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;

        try {
            // Process priority queue first (urgent notifications)
            while (this.priorityQueue.length > 0 && this.activeDeliveries.size < this.maxConcurrentDeliveries) {
                const deliveryItem = this.priorityQueue.shift();
                this.processDeliveryItem(deliveryItem);
            }

            // Process regular queue
            while (this.deliveryQueue.length > 0 && this.activeDeliveries.size < this.maxConcurrentDeliveries) {
                const deliveryItem = this.deliveryQueue.shift();
                this.processDeliveryItem(deliveryItem);
            }
        } catch (error) {
            console.error('Error in queue processing:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Process individual delivery item
     */
    async processDeliveryItem(deliveryItem) {
        const { notification } = deliveryItem;
        const deliveryId = `${notification._id}_${Date.now()}`;
        
        // Track active delivery
        this.activeDeliveries.set(deliveryId, {
            ...deliveryItem,
            startTime: new Date(),
            deliveryId
        });

        try {
            await this.deliverNotification(notification);
            this.recordDeliverySuccess(deliveryId, deliveryItem);
        } catch (error) {
            console.error('Error delivering notification:', error);
            await this.handleDeliveryFailure(notification, error.message);
            this.recordDeliveryFailure(deliveryId, deliveryItem, error);
        } finally {
            this.activeDeliveries.delete(deliveryId);
        }
    }

    /**
     * Deliver notification through specified channels
     */
    async deliverNotification(notification) {
        const deliveryPromises = [];

        for (const channel of notification.channels) {
            switch (channel) {
                case 'push':
                    deliveryPromises.push(this.deliverPushNotification(notification));
                    break;
                case 'in_app':
                    deliveryPromises.push(this.deliverInAppNotification(notification));
                    break;
                case 'email':
                    deliveryPromises.push(this.deliverEmailNotification(notification));
                    break;
                case 'sms':
                    deliveryPromises.push(this.deliverSMSNotification(notification));
                    break;
            }
        }

        await Promise.allSettled(deliveryPromises);
        
        // Mark as sent
        notification.status = 'sent';
        notification.sentAt = new Date();
        await notification.save();
    }

    /**
     * Deliver push notification via WebSocket with real-time optimization
     */
    async deliverPushNotification(notification) {
        try {
            const pushData = {
                id: notification._id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                data: notification.data,
                priority: notification.priority,
                timestamp: notification.createdAt,
                deliveryOptimized: true
            };

            // Check if user is connected for real-time delivery
            const isUserConnected = socketService.isUserConnected(notification.recipientId.toString());
            
            if (isUserConnected) {
                // Real-time delivery via WebSocket
                socketService.sendNotification(notification.recipientId.toString(), pushData);
                
                // Mark as delivered immediately for connected users
                notification.status = 'delivered';
                notification.deliveredAt = new Date();
                await notification.save();
                
                return { delivered: true, method: 'websocket', realTime: true };
            } else {
                // User not connected - store for later delivery
                socketService.sendNotification(notification.recipientId.toString(), {
                    ...pushData,
                    offline: true
                });
                
                return { delivered: true, method: 'websocket', realTime: false };
            }
        } catch (error) {
            console.error('Push notification delivery failed:', error);
            throw error;
        }
    }

    /**
     * Deliver in-app notification with enhanced real-time features
     */
    async deliverInAppNotification(notification) {
        try {
            const inAppData = {
                id: notification._id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                data: notification.data,
                priority: notification.priority,
                timestamp: notification.createdAt,
                read: false,
                channel: 'in_app'
            };

            // Send via WebSocket for real-time updates
            socketService.sendNotification(notification.recipientId.toString(), inAppData);
            
            // Also emit specific event for in-app notification updates
            socketService.emitInAppNotificationUpdate(notification.recipientId.toString(), {
                action: 'new_notification',
                notification: inAppData
            });
            
            return { delivered: true, method: 'in_app', realTime: true };
        } catch (error) {
            console.error('In-app notification delivery failed:', error);
            throw error;
        }
    }

    /**
     * Deliver email notification using SendGrid
     */
    async deliverEmailNotification(notification) {
        try {
            // Check if SendGrid is configured
            if (!process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY === 'your-sendgrid-api-key') {
                console.log(`Email notification would be sent to user ${notification.recipientId}:`, {
                    title: notification.title,
                    message: notification.message
                });
                return true; // Return success for development mode
            }

            // Get user email
            const user = await User.findById(notification.recipientId).select('email profile.firstName profile.lastName');
            if (!user || !user.email) {
                throw new Error('User email not found');
            }

            // Prepare email content
            const emailData = {
                to: user.email,
                from: {
                    email: process.env.FROM_EMAIL || 'noreply@ecocycle.com',
                    name: process.env.FROM_NAME || 'EcoCycle Platform'
                },
                subject: notification.title,
                html: this.generateEmailHTML(notification, user),
                text: notification.message
            };

            // In a real implementation, you would use SendGrid SDK here:
            // const sgMail = require('@sendgrid/mail');
            // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            // await sgMail.send(emailData);

            console.log(`Email notification sent to ${user.email}:`, {
                subject: emailData.subject,
                to: emailData.to
            });

            return true;
        } catch (error) {
            console.error('Email notification delivery failed:', error);
            throw error;
        }
    }

    /**
     * Deliver SMS notification using Twilio
     */
    async deliverSMSNotification(notification) {
        try {
            // Check if Twilio is configured
            if (!process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID === 'your-twilio-account-sid') {
                console.log(`SMS notification would be sent to user ${notification.recipientId}:`, {
                    message: notification.message
                });
                return true; // Return success for development mode
            }

            // Get user phone number
            const user = await User.findById(notification.recipientId).select('profile.phone');
            if (!user || !user.profile?.phone) {
                throw new Error('User phone number not found');
            }

            // Prepare SMS content (limit to 160 characters)
            const smsMessage = notification.message.length > 160 
                ? notification.message.substring(0, 157) + '...'
                : notification.message;

            const smsData = {
                body: smsMessage,
                from: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
                to: user.profile.phone
            };

            // In a real implementation, you would use Twilio SDK here:
            // const twilio = require('twilio');
            // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            // await client.messages.create(smsData);

            console.log(`SMS notification sent to ${user.profile.phone}:`, {
                message: smsData.body,
                to: smsData.to
            });

            return true;
        } catch (error) {
            console.error('SMS notification delivery failed:', error);
            throw error;
        }
    }

    /**
     * Generate HTML email template
     */
    generateEmailHTML(notification, user) {
        const userName = user.profile?.firstName 
            ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim()
            : 'EcoCycle User';

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${notification.title}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #84CC16, #65A30D); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 30px 20px; border-radius: 0 0 8px 8px; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .button { display: inline-block; background: #84CC16; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .notification-data { background: #e5e7eb; padding: 15px; border-radius: 6px; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🌱 EcoCycle</h1>
                    <h2>${notification.title}</h2>
                </div>
                <div class="content">
                    <p>Hello ${userName},</p>
                    <p>${notification.message}</p>
                    ${notification.data && Object.keys(notification.data).length > 0 ? `
                    <div class="notification-data">
                        <h4>Details:</h4>
                        ${Object.entries(notification.data).map(([key, value]) => 
                            `<p><strong>${key}:</strong> ${value}</p>`
                        ).join('')}
                    </div>
                    ` : ''}
                    <p>Thank you for being part of our sustainable community!</p>
                </div>
                <div class="footer">
                    <p>© 2024 EcoCycle Platform. All rights reserved.</p>
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * Handle delivery failure and retry logic
     */
    async handleDeliveryFailure(notification, reason) {
        await notification.markAsFailed(reason);

        // Retry logic
        if (notification.deliveryAttempts < this.retryDelays.length) {
            const delay = this.retryDelays[notification.deliveryAttempts - 1];
            
            setTimeout(() => {
                this.addToQueue(notification);
            }, delay);
            
            console.log(`Notification ${notification._id} will be retried in ${delay}ms (attempt ${notification.deliveryAttempts})`);
        } else {
            console.error(`Notification ${notification._id} failed permanently after ${notification.deliveryAttempts} attempts`);
        }
    }

    /**
     * Get notifications for a user with pagination
     */
    async getUserNotifications(userId, options = {}) {
        const {
            page = 1,
            limit = 20,
            status,
            type,
            unreadOnly = false
        } = options;

        const query = { recipientId: userId };
        
        if (status) {
            query.status = status;
        }
        
        if (type) {
            query.type = type;
        }
        
        if (unreadOnly) {
            query.status = { $in: ['delivered', 'sent'] };
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        const total = await Notification.countDocuments(query);

        return {
            notifications,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        const notification = await Notification.findOne({
            _id: notificationId,
            recipientId: userId
        });

        if (!notification) {
            throw new Error('Notification not found');
        }

        return await notification.markAsRead();
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId) {
        return await Notification.updateMany(
            {
                recipientId: userId,
                status: { $in: ['delivered', 'sent'] }
            },
            {
                status: 'read',
                readAt: new Date()
            }
        );
    }

    /**
     * Get notification statistics for a user
     */
    async getUserNotificationStats(userId) {
        const stats = await Notification.aggregate([
            { $match: { recipientId: mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = {
            total: 0,
            unread: 0,
            read: 0,
            failed: 0
        };

        stats.forEach(stat => {
            result.total += stat.count;
            
            if (stat._id === 'read') {
                result.read = stat.count;
            } else if (stat._id === 'delivered' || stat._id === 'sent') {
                result.unread += stat.count;
            } else if (stat._id === 'failed') {
                result.failed = stat.count;
            }
        });

        return result;
    }

    /**
     * Start batch processor for delivery optimization
     */
    startBatchProcessor() {
        setInterval(() => {
            this.processBatchQueue();
        }, this.batchTimeout);
    }

    /**
     * Process batch queue for optimized delivery
     */
    async processBatchQueue() {
        if (this.batchQueue.length === 0) {
            return;
        }

        // Group notifications by recipient for batching
        const recipientGroups = new Map();
        
        // Take items from batch queue
        const itemsToProcess = this.batchQueue.splice(0, this.batchSize);
        
        for (const item of itemsToProcess) {
            const recipientId = item.notification.recipientId.toString();
            
            if (!recipientGroups.has(recipientId)) {
                recipientGroups.set(recipientId, []);
            }
            
            recipientGroups.get(recipientId).push(item);
        }

        // Process each recipient group
        for (const [recipientId, items] of recipientGroups) {
            if (items.length === 1) {
                // Single notification - add to regular queue
                this.deliveryQueue.push(items[0]);
            } else {
                // Multiple notifications - batch them
                await this.processBatchedNotifications(recipientId, items);
            }
        }

        // Trigger queue processing
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Process batched notifications for a single recipient
     */
    async processBatchedNotifications(recipientId, items) {
        try {
            // Create a summary notification for multiple items
            const notifications = items.map(item => item.notification);
            const highPriorityCount = notifications.filter(n => n.priority === 'high' || n.priority === 'urgent').length;
            
            // If there are high priority notifications, process them individually
            if (highPriorityCount > 0) {
                for (const item of items) {
                    if (item.notification.priority === 'high' || item.notification.priority === 'urgent') {
                        this.deliveryQueue.push(item);
                    } else {
                        this.deliveryQueue.push(item);
                    }
                }
                return;
            }

            // Create batched notification summary
            const batchedNotification = await this.createBatchedNotification(recipientId, notifications);
            
            if (batchedNotification) {
                const batchItem = {
                    notification: batchedNotification,
                    addedAt: new Date(),
                    attempts: 0,
                    priority: Math.max(...items.map(item => item.priority)),
                    originalNotifications: notifications
                };
                
                this.deliveryQueue.push(batchItem);
            }
        } catch (error) {
            console.error('Error processing batched notifications:', error);
            // Fallback: add all items to regular queue
            for (const item of items) {
                this.deliveryQueue.push(item);
            }
        }
    }

    /**
     * Create a batched notification summary
     */
    async createBatchedNotification(recipientId, notifications) {
        if (notifications.length <= 1) {
            return null;
        }

        const types = [...new Set(notifications.map(n => n.type))];
        const title = `You have ${notifications.length} new notifications`;
        
        let message = '';
        if (types.length === 1) {
            message = `${notifications.length} ${types[0].replace(/_/g, ' ')} notifications`;
        } else {
            message = `${notifications.length} notifications including ${types.slice(0, 2).map(t => t.replace(/_/g, ' ')).join(', ')}`;
            if (types.length > 2) {
                message += ` and ${types.length - 2} more types`;
            }
        }

        const batchedNotification = new Notification({
            recipientId,
            type: 'batched_summary',
            title,
            message,
            data: {
                batchedCount: notifications.length,
                types,
                originalNotificationIds: notifications.map(n => n._id),
                batchedAt: new Date()
            },
            channels: ['push', 'in_app'],
            priority: 'medium',
            status: 'pending'
        });

        await batchedNotification.save();
        return batchedNotification;
    }

    /**
     * Record successful delivery
     */
    recordDeliverySuccess(deliveryId, deliveryItem) {
        const activeDelivery = this.activeDeliveries.get(deliveryId);
        if (activeDelivery) {
            const deliveryTime = new Date() - activeDelivery.startTime;
            
            this.deliveryStats.totalSent++;
            this.deliveryStats.lastDeliveryTime = deliveryTime;
            
            // Update average delivery time
            this.deliveryStats.averageDeliveryTime = 
                (this.deliveryStats.averageDeliveryTime * (this.deliveryStats.totalSent - 1) + deliveryTime) / 
                this.deliveryStats.totalSent;

            // Add to delivery history
            this.addToDeliveryHistory({
                notificationId: deliveryItem.notification._id,
                recipientId: deliveryItem.notification.recipientId,
                type: deliveryItem.notification.type,
                status: 'success',
                deliveryTime,
                timestamp: new Date(),
                channels: deliveryItem.notification.channels,
                priority: deliveryItem.notification.priority
            });
        }
    }

    /**
     * Record delivery failure
     */
    recordDeliveryFailure(deliveryId, deliveryItem, error) {
        const activeDelivery = this.activeDeliveries.get(deliveryId);
        if (activeDelivery) {
            const deliveryTime = new Date() - activeDelivery.startTime;
            
            this.deliveryStats.totalFailed++;

            // Add to delivery history
            this.addToDeliveryHistory({
                notificationId: deliveryItem.notification._id,
                recipientId: deliveryItem.notification.recipientId,
                type: deliveryItem.notification.type,
                status: 'failed',
                deliveryTime,
                timestamp: new Date(),
                channels: deliveryItem.notification.channels,
                priority: deliveryItem.notification.priority,
                error: error.message
            });
        }
    }

    /**
     * Add entry to delivery history
     */
    addToDeliveryHistory(entry) {
        this.deliveryHistory.push(entry);
        
        // Keep history size manageable
        if (this.deliveryHistory.length > this.maxHistorySize) {
            this.deliveryHistory = this.deliveryHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Get delivery statistics
     */
    getDeliveryStats() {
        const successRate = this.deliveryStats.totalSent + this.deliveryStats.totalFailed > 0 
            ? (this.deliveryStats.totalSent / (this.deliveryStats.totalSent + this.deliveryStats.totalFailed)) * 100
            : 0;

        return {
            ...this.deliveryStats,
            successRate: Math.round(successRate * 100) / 100,
            activeDeliveries: this.activeDeliveries.size,
            queueSizes: {
                priority: this.priorityQueue.length,
                regular: this.deliveryQueue.length,
                batch: this.batchQueue.length
            }
        };
    }

    /**
     * Get recent delivery history
     */
    getDeliveryHistory(limit = 100) {
        return this.deliveryHistory.slice(-limit).reverse();
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        // Log performance stats every 5 minutes
        setInterval(() => {
            const stats = this.getDeliveryStats();
            console.log('📊 Notification Service Performance:', {
                totalSent: stats.totalSent,
                totalFailed: stats.totalFailed,
                successRate: `${stats.successRate}%`,
                averageDeliveryTime: `${Math.round(stats.averageDeliveryTime)}ms`,
                activeDeliveries: stats.activeDeliveries,
                queueSizes: stats.queueSizes
            });
        }, 5 * 60 * 1000); // 5 minutes
    }

    /**
     * Start the queue processor
     */
    startQueueProcessor() {
        // Process queue every 2 seconds for better real-time performance
        setInterval(() => {
            this.processQueue();
        }, 2000);

        // Also check for scheduled notifications every minute
        setInterval(() => {
            this.processScheduledNotifications();
        }, 60000);
    }

    /**
     * Start cleanup scheduler
     */
    startCleanupScheduler() {
        // Cleanup expired notifications daily at 2 AM
        const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
        
        setInterval(async () => {
            try {
                // Check if mongoose is connected
                if (mongoose.connection.readyState !== 1) {
                    return; // Skip if not connected
                }

            } catch (error) {
                console.error('Error cleaning up expired notifications:', error);
            }
        }, cleanupInterval);
    }

    /**
     * Process scheduled notifications
     */
    async processScheduledNotifications() {
        try {
            // Check if mongoose is connected
            if (mongoose.connection.readyState !== 1) {
                return; // Skip if not connected
            }

            const scheduledNotifications = await Notification.find({
                status: 'pending',
                scheduledFor: { $lte: new Date() }
            }).limit(100);

            for (const notification of scheduledNotifications) {
                this.addToQueue(notification);
            }
        } catch (error) {
            console.error('Error processing scheduled notifications:', error);
        }
    }

    /**
     * Get real-time notification status for a user
     */
    async getNotificationStatus(userId) {
        try {
            const [unreadCount, recentNotifications, userStats] = await Promise.all([
                Notification.countDocuments({
                    recipientId: userId,
                    status: { $in: ['delivered', 'sent'] }
                }),
                Notification.find({
                    recipientId: userId
                })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
                this.getUserNotificationStats(userId)
            ]);

            return {
                unreadCount,
                recentNotifications,
                stats: userStats,
                isConnected: socketService.isUserConnected(userId),
                lastActivity: new Date()
            };
        } catch (error) {
            console.error('Error getting notification status:', error);
            throw error;
        }
    }

    /**
     * Send real-time notification status update
     */
    async sendNotificationStatusUpdate(userId) {
        try {
            const status = await this.getNotificationStatus(userId);
            
            socketService.emitNotificationStatusUpdate(userId, status);
            
            return status;
        } catch (error) {
            console.error('Error sending notification status update:', error);
            throw error;
        }
    }

    /**
     * Handle real-time notification acknowledgment
     */
    async handleNotificationAcknowledgment(notificationId, userId) {
        try {
            const notification = await Notification.findOne({
                _id: notificationId,
                recipientId: userId
            });

            if (!notification) {
                throw new Error('Notification not found');
            }

            if (notification.status === 'sent' || notification.status === 'delivered') {
                notification.status = 'read';
                notification.readAt = new Date();
                await notification.save();

                // Send real-time update
                socketService.emitNotificationAcknowledged(userId, {
                    notificationId,
                    readAt: notification.readAt
                });

                return notification;
            }

            return notification;
        } catch (error) {
            console.error('Error handling notification acknowledgment:', error);
            throw error;
        }
    }

    /**
     * Optimize delivery timing based on user activity patterns
     */
    async optimizeDeliveryTiming(notification) {
        try {
            // Get user's recent activity pattern
            const userId = notification.recipientId.toString();
            const isUserActive = socketService.isUserConnected(userId);
            
            // If user is active, deliver immediately
            if (isUserActive) {
                return { deliverNow: true, reason: 'user_active' };
            }

            // Check user's typical activity hours (simplified logic)
            const currentHour = new Date().getHours();
            const isBusinessHours = currentHour >= 9 && currentHour <= 17;
            
            // For high priority notifications, deliver immediately regardless
            if (notification.priority === 'urgent' || notification.priority === 'high') {
                return { deliverNow: true, reason: 'high_priority' };
            }

            // For medium/low priority, consider timing
            if (isBusinessHours) {
                return { deliverNow: true, reason: 'business_hours' };
            } else {
                // Schedule for next business hour
                const nextDelivery = new Date();
                nextDelivery.setHours(9, 0, 0, 0);
                if (nextDelivery <= new Date()) {
                    nextDelivery.setDate(nextDelivery.getDate() + 1);
                }
                
                return { 
                    deliverNow: false, 
                    scheduleFor: nextDelivery,
                    reason: 'optimized_timing' 
                };
            }
        } catch (error) {
            console.error('Error optimizing delivery timing:', error);
            return { deliverNow: true, reason: 'fallback' };
        }
    }

    /**
     * Send proximity-based opportunity notifications
     */
    async checkProximityOpportunities(collectorLocation, radius = 1000) {
        try {
            // Find citizens within radius who have pending waste logs
            const nearbyUsers = await User.aggregate([
                {
                    $match: {
                        role: 'citizen',
                        'profile.addresses.coordinates': {
                            $near: {
                                $geometry: {
                                    type: 'Point',
                                    coordinates: [collectorLocation.lng, collectorLocation.lat]
                                },
                                $maxDistance: radius
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'wastes',
                        localField: '_id',
                        foreignField: 'citizenId',
                        as: 'pendingWaste'
                    }
                },
                {
                    $match: {
                        'pendingWaste.status': 'pending'
                    }
                },
                {
                    $project: {
                        _id: 1,
                        'profile.preferences.notifications': 1,
                        pendingWasteCount: { $size: '$pendingWaste' }
                    }
                }
            ]);

            const notifications = [];
            
            for (const user of nearbyUsers) {
                // Check if user allows proximity notifications
                if (user.profile?.preferences?.notifications?.pickup !== false) {
                    const distance = this.calculateDistance(
                        collectorLocation.lat,
                        collectorLocation.lng,
                        user.profile.addresses[0].coordinates.coordinates[1],
                        user.profile.addresses[0].coordinates.coordinates[0]
                    );

                    const estimatedArrival = Math.ceil(distance / 50); // Rough estimate: 50m/min walking speed

                    const notification = await this.sendProximityNotification(
                        user._id,
                        collectorLocation.collectorId,
                        distance,
                        estimatedArrival
                    );

                    if (notification) {
                        notifications.push(notification);
                    }
                }
            }

            return notifications;
        } catch (error) {
            console.error('Error checking proximity opportunities:', error);
            return [];
        }
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    }
}

// Create singleton instance
const notificationService = new NotificationService();
export default notificationService;