import express from 'express';
import notificationService from '../services/notificationService.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get user's notifications with pagination and filtering
 * @access  Private
 */
router.get('/', protect, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            type,
            unreadOnly = false
        } = req.query;

        const options = {
            page: parseInt(page),
            limit: Math.min(parseInt(limit), 100), // Max 100 per page
            status,
            type,
            unreadOnly: unreadOnly === 'true'
        };

        const result = await notificationService.getUserNotifications(req.user.id, options);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching notifications',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/notifications/stats
 * @desc    Get user's notification statistics
 * @access  Private
 */
router.get('/stats', protect, async (req, res) => {
    try {
        const stats = await notificationService.getUserNotificationStats(req.user.id);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching notification stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching notification statistics',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/notifications/status
 * @desc    Get real-time notification status for the user
 * @access  Private
 */
router.get('/status', protect, async (req, res) => {
    try {
        const status = await notificationService.getNotificationStatus(req.user.id);

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error fetching notification status:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching notification status',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/notifications/:id/acknowledge
 * @desc    Acknowledge receipt of a notification
 * @access  Private
 */
router.post('/:id/acknowledge', protect, async (req, res) => {
    try {
        const notification = await notificationService.handleNotificationAcknowledgment(
            req.params.id, 
            req.user.id
        );

        res.json({
            success: true,
            data: notification,
            message: 'Notification acknowledged'
        });
    } catch (error) {
        console.error('Error acknowledging notification:', error);
        
        if (error.message === 'Notification not found') {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error acknowledging notification',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/notifications/delivery-stats
 * @desc    Get notification delivery statistics (admin only)
 * @access  Private (Admin only)
 */
router.get('/delivery-stats', protect, authorize('admin'), async (req, res) => {
    try {
        const stats = notificationService.getDeliveryStats();
        const history = notificationService.getDeliveryHistory(50);

        res.json({
            success: true,
            data: {
                stats,
                recentHistory: history
            }
        });
    } catch (error) {
        console.error('Error fetching delivery stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching delivery statistics',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/notifications/optimize-delivery
 * @desc    Trigger delivery optimization for pending notifications (admin only)
 * @access  Private (Admin only)
 */
router.post('/optimize-delivery', protect, authorize('admin'), async (req, res) => {
    try {
        const { force = false } = req.body;
        
        // Get pending notifications
        const pendingNotifications = await Notification.find({
            status: 'pending',
            scheduledFor: { $lte: new Date() }
        }).limit(100);

        let optimizedCount = 0;
        
        for (const notification of pendingNotifications) {
            const optimization = await notificationService.optimizeDeliveryTiming(notification);
            
            if (optimization.deliverNow || force) {
                notificationService.addToQueue(notification);
                optimizedCount++;
            } else if (optimization.scheduleFor) {
                notification.scheduledFor = optimization.scheduleFor;
                await notification.save();
            }
        }

        res.json({
            success: true,
            data: {
                totalPending: pendingNotifications.length,
                optimizedForDelivery: optimizedCount,
                message: `Optimized ${optimizedCount} notifications for delivery`
            }
        });
    } catch (error) {
        console.error('Error optimizing delivery:', error);
        res.status(500).json({
            success: false,
            message: 'Error optimizing notification delivery',
            error: error.message
        });
    }
});

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a specific notification as read
 * @access  Private
 */
router.put('/:id/read', protect, async (req, res) => {
    try {
        const notification = await notificationService.markAsRead(req.params.id, req.user.id);

        res.json({
            success: true,
            data: notification,
            message: 'Notification marked as read'
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        
        if (error.message === 'Notification not found') {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error marking notification as read',
            error: error.message
        });
    }
});

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read for the user
 * @access  Private
 */
router.put('/read-all', protect, async (req, res) => {
    try {
        const result = await notificationService.markAllAsRead(req.user.id);

        res.json({
            success: true,
            data: {
                modifiedCount: result.modifiedCount
            },
            message: `${result.modifiedCount} notifications marked as read`
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking notifications as read',
            error: error.message
        });
    }
});

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update user notification preferences
 * @access  Private
 */
router.put('/preferences', protect, async (req, res) => {
    try {
        const { notifications } = req.body;

        // Validate notification preferences structure
        const validPreferences = {
            pickup: typeof notifications?.pickup === 'boolean' ? notifications.pickup : true,
            rewards: typeof notifications?.rewards === 'boolean' ? notifications.rewards : true,
            challenges: typeof notifications?.challenges === 'boolean' ? notifications.challenges : true
        };

        // Update user preferences
        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                $set: {
                    'profile.preferences.notifications': validPreferences
                }
            },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                preferences: user.profile.preferences
            },
            message: 'Notification preferences updated successfully'
        });
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating notification preferences',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/notifications/preferences
 * @desc    Get user notification preferences
 * @access  Private
 */
router.get('/preferences', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('profile.preferences');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                preferences: user.profile.preferences || {
                    notifications: {
                        pickup: true,
                        rewards: true,
                        challenges: true
                    },
                    privacy: {
                        showInLeaderboard: true,
                        showFullName: true,
                        shareImpactData: true
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error fetching notification preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching notification preferences',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/notifications/test
 * @desc    Send a test notification (development/admin only)
 * @access  Private (Admin only)
 */
router.post('/test', protect, authorize('admin'), async (req, res) => {
    try {
        const {
            recipientId,
            type = 'system_announcement',
            title = 'Test Notification',
            message = 'This is a test notification',
            channels = ['push', 'in_app'],
            priority = 'medium'
        } = req.body;

        const targetUserId = recipientId || req.user.id;

        const notification = await notificationService.createNotification({
            recipientId: targetUserId,
            type,
            title,
            message,
            data: {
                test: true,
                sentBy: req.user.id
            },
            channels,
            priority
        });

        res.json({
            success: true,
            data: notification,
            message: 'Test notification sent successfully'
        });
    } catch (error) {
        console.error('Error sending test notification:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending test notification',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/notifications/system-announcement
 * @desc    Send system-wide announcement (admin only)
 * @access  Private (Admin only)
 */
router.post('/system-announcement', protect, authorize('admin'), async (req, res) => {
    try {
        const {
            title,
            message,
            targetUsers = 'all',
            priority = 'medium'
        } = req.body;

        if (!title || !message) {
            return res.status(400).json({
                success: false,
                message: 'Title and message are required'
            });
        }

        const notifications = await notificationService.sendSystemAnnouncement(
            title,
            message,
            targetUsers,
            priority
        );

        res.json({
            success: true,
            data: {
                notificationsSent: notifications.length,
                notifications: notifications.slice(0, 10) // Return first 10 for preview
            },
            message: `System announcement sent to ${notifications.length} users`
        });
    } catch (error) {
        console.error('Error sending system announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending system announcement',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/notifications/proximity-check
 * @desc    Trigger proximity check for collector (collector only)
 * @access  Private (Collector only)
 */
router.post('/proximity-check', protect, authorize('collector'), async (req, res) => {
    try {
        const {
            lat,
            lng,
            radius = 1000
        } = req.body;

        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }

        const collectorLocation = {
            collectorId: req.user.id,
            lat: parseFloat(lat),
            lng: parseFloat(lng)
        };

        const notifications = await notificationService.checkProximityOpportunities(
            collectorLocation,
            parseInt(radius)
        );

        res.json({
            success: true,
            data: {
                notificationsSent: notifications.length,
                radius,
                location: collectorLocation
            },
            message: `Proximity check completed, ${notifications.length} notifications sent`
        });
    } catch (error) {
        console.error('Error performing proximity check:', error);
        res.status(500).json({
            success: false,
            message: 'Error performing proximity check',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/notifications/schedule
 * @desc    Schedule a notification for future delivery (admin only)
 * @access  Private (Admin only)
 */
router.post('/schedule', protect, authorize('admin'), async (req, res) => {
    try {
        const {
            recipientId,
            type,
            title,
            message,
            scheduledTime,
            channels = ['push', 'in_app'],
            priority = 'medium'
        } = req.body;

        if (!recipientId || !type || !title || !message || !scheduledTime) {
            return res.status(400).json({
                success: false,
                message: 'Recipient ID, type, title, message, and scheduled time are required'
            });
        }

        const scheduledDate = new Date(scheduledTime);
        if (scheduledDate <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Scheduled time must be in the future'
            });
        }

        const notification = await notificationService.scheduleNotification({
            recipientId,
            type,
            title,
            message,
            data: {
                scheduledBy: req.user.id
            },
            channels,
            priority
        }, scheduledDate);

        res.json({
            success: true,
            data: notification,
            message: 'Notification scheduled successfully'
        });
    } catch (error) {
        console.error('Error scheduling notification:', error);
        res.status(500).json({
            success: false,
            message: 'Error scheduling notification',
            error: error.message
        });
    }
});

/**
 * @route   DELETE /api/notifications/:id/cancel
 * @desc    Cancel a scheduled notification (admin only)
 * @access  Private (Admin only)
 */
router.delete('/:id/cancel', protect, authorize('admin'), async (req, res) => {
    try {
        const notification = await notificationService.cancelNotification(req.params.id);

        res.json({
            success: true,
            data: notification,
            message: 'Notification cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling notification:', error);
        
        if (error.message === 'Notification not found') {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        if (error.message.includes('Cannot cancel')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error cancelling notification',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/notifications/bulk
 * @desc    Send bulk notifications (admin only)
 * @access  Private (Admin only)
 */
router.post('/bulk', protect, authorize('admin'), async (req, res) => {
    try {
        const { notifications } = req.body;

        if (!Array.isArray(notifications) || notifications.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Notifications array is required and must not be empty'
            });
        }

        // Validate each notification
        for (const notification of notifications) {
            if (!notification.recipientId || !notification.type || !notification.title || !notification.message) {
                return res.status(400).json({
                    success: false,
                    message: 'Each notification must have recipientId, type, title, and message'
                });
            }
        }

        const results = await notificationService.sendBulkNotifications(notifications);

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        res.json({
            success: true,
            data: {
                results,
                summary: {
                    total: notifications.length,
                    successful: successCount,
                    failed: failureCount
                }
            },
            message: `Bulk notification completed: ${successCount} successful, ${failureCount} failed`
        });
    } catch (error) {
        console.error('Error sending bulk notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending bulk notifications',
            error: error.message
        });
    }
});

export default router;