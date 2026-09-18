import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: [
            'pickup_status_change',
            'pickup_assigned',
            'pickup_completed',
            'collector_nearby',
            'reward_redemption_confirmation',
            'redemption_status_update',
            'challenge_completed',
            'achievement_unlocked',
            'milestone_reached',
            'leaderboard_update',
            'system_announcement',
            'proximity_opportunity',
            'batched_summary'
        ],
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        maxlength: 100
    },
    message: {
        type: String,
        required: true,
        maxlength: 500
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    channels: [{
        type: String,
        enum: ['push', 'email', 'sms', 'in_app'],
        required: true
    }],
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'failed', 'read', 'cancelled'],
        default: 'pending',
        index: true
    },
    deliveryAttempts: {
        type: Number,
        default: 0,
        max: 5
    },
    scheduledFor: {
        type: Date,
        default: Date.now,
        index: true
    },
    sentAt: {
        type: Date,
        index: true
    },
    deliveredAt: {
        type: Date
    },
    readAt: {
        type: Date
    },
    failureReason: {
        type: String,
        maxlength: 200
    },
    expiresAt: {
        type: Date,
        default: function() {
            // Notifications expire after 30 days
            return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        },
        index: { expireAfterSeconds: 0 }
    },
    // Metadata for tracking and analytics
    metadata: {
        source: {
            type: String,
            default: 'system'
        },
        campaign: {
            type: String
        },
        tags: [String]
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
notificationSchema.index({ recipientId: 1, status: 1 });
notificationSchema.index({ recipientId: 1, type: 1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ status: 1, scheduledFor: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });

// Virtual for checking if notification is expired
notificationSchema.virtual('isExpired').get(function() {
    return this.expiresAt && this.expiresAt < new Date();
});

// Virtual for checking if notification is overdue
notificationSchema.virtual('isOverdue').get(function() {
    return this.status === 'pending' && this.scheduledFor < new Date();
});

// Method to mark notification as read
notificationSchema.methods.markAsRead = function() {
    if (this.status !== 'read') {
        this.status = 'read';
        this.readAt = new Date();
        return this.save();
    }
    return Promise.resolve(this);
};

// Method to mark notification as delivered with timing
notificationSchema.methods.markAsDelivered = function(deliveryMethod = 'unknown') {
    if (this.status === 'sent') {
        this.status = 'delivered';
        this.deliveredAt = new Date();
        this.metadata = this.metadata || {};
        this.metadata.deliveryMethod = deliveryMethod;
        return this.save();
    }
    return Promise.resolve(this);
};

// Method to mark notification as failed with enhanced tracking
notificationSchema.methods.markAsFailed = function(reason, deliveryMethod = 'unknown') {
    this.status = 'failed';
    this.failureReason = reason;
    this.deliveryAttempts += 1;
    this.metadata = this.metadata || {};
    this.metadata.lastFailureMethod = deliveryMethod;
    this.metadata.lastFailureTime = new Date();
    return this.save();
};

// Method to check if notification can be retried
notificationSchema.methods.canRetry = function() {
    return this.status === 'failed' && this.deliveryAttempts < 5;
};

// Method to get delivery timing information
notificationSchema.methods.getDeliveryTiming = function() {
    const created = this.createdAt;
    const scheduled = this.scheduledFor;
    const sent = this.sentAt;
    const delivered = this.deliveredAt;
    const read = this.readAt;

    return {
        schedulingDelay: scheduled ? scheduled - created : 0,
        deliveryDelay: sent ? sent - (scheduled || created) : null,
        acknowledgmentDelay: delivered && read ? read - delivered : null,
        totalTime: read ? read - created : (delivered ? delivered - created : null)
    };
};

// Static method to get unread notifications for a user
notificationSchema.statics.getUnreadForUser = function(userId, limit = 50) {
    return this.find({
        recipientId: userId,
        status: { $in: ['delivered', 'sent'] }
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to get notification statistics for a user
notificationSchema.statics.getStatsForUser = function(userId) {
    return this.aggregate([
        { $match: { recipientId: mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);
};

// Static method to cleanup expired notifications
notificationSchema.statics.cleanupExpired = function() {
    return this.deleteMany({
        expiresAt: { $lt: new Date() }
    });
};

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;