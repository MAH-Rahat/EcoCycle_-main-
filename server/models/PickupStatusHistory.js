import mongoose from 'mongoose';

const pickupStatusHistorySchema = new mongoose.Schema({
    pickupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pickup',
        required: true,
        index: true
    },
    fromStatus: {
        type: String,
        required: false // null for initial status
    },
    toStatus: {
        type: String,
        required: true,
        enum: ['pending', 'assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled']
    },
    changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reason: {
        type: String,
        maxLength: 500
    },
    metadata: {
        location: {
            lat: Number,
            lng: Number
        },
        estimatedArrival: Date,
        actualWeight: Number,
        qrVerified: Boolean,
        automaticUpdate: {
            type: Boolean,
            default: false
        }
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: false // We're using our own timestamp field
});

// Indexes for efficient queries
pickupStatusHistorySchema.index({ pickupId: 1, timestamp: -1 });
pickupStatusHistorySchema.index({ changedBy: 1, timestamp: -1 });
pickupStatusHistorySchema.index({ toStatus: 1, timestamp: -1 });

// Static method to log status change
pickupStatusHistorySchema.statics.logStatusChange = async function(pickupId, fromStatus, toStatus, changedBy, reason, metadata = {}) {
    const historyEntry = new this({
        pickupId,
        fromStatus,
        toStatus,
        changedBy,
        reason,
        metadata
    });
    
    return await historyEntry.save();
};

// Static method to get pickup history
pickupStatusHistorySchema.statics.getPickupHistory = function(pickupId) {
    return this.find({ pickupId })
        .populate('changedBy', 'name email role')
        .sort({ timestamp: 1 }); // Chronological order
};

// Static method to get user activity
pickupStatusHistorySchema.statics.getUserActivity = function(userId, limit = 50) {
    return this.find({ changedBy: userId })
        .populate('pickupId', 'address scheduledDate')
        .sort({ timestamp: -1 })
        .limit(limit);
};

// Virtual for duration between status changes
pickupStatusHistorySchema.virtual('duration').get(function() {
    // This would need to be calculated in aggregation pipeline
    return null;
});

const PickupStatusHistory = mongoose.model('PickupStatusHistory', pickupStatusHistorySchema);
export default PickupStatusHistory;