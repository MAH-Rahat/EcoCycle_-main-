import mongoose from 'mongoose';
import crypto from 'crypto';

const rewardRedemptionSchema = new mongoose.Schema({
    citizenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    rewardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Reward',
        required: true,
        index: true
    },
    pointsSpent: {
        type: Number,
        required: true,
        min: 1
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'fulfilled', 'cancelled', 'expired'],
        default: 'pending',
        index: true
    },
    redemptionCode: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    // Fulfillment details
    fulfillmentDetails: {
        method: {
            type: String,
            enum: ['email', 'physical', 'digital', 'pickup', 'partner_system'],
            required: false
        },
        trackingNumber: {
            type: String,
            required: false
        },
        deliveryAddress: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: String
        },
        contactInfo: {
            email: String,
            phone: String
        },
        partnerReference: {
            type: String,
            required: false
        }
    },
    // Admin notes and processing
    adminNotes: {
        type: String,
        maxLength: 1000
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    processedAt: {
        type: Date,
        required: false
    },
    // Expiration
    expiresAt: {
        type: Date,
        required: true,
        index: true,
        default: function() {
            // Default expiration: 30 days from creation
            return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }
    },
    // Timestamps for status changes
    approvedAt: {
        type: Date,
        required: false
    },
    fulfilledAt: {
        type: Date,
        required: false
    },
    cancelledAt: {
        type: Date,
        required: false
    },
    cancellationReason: {
        type: String,
        maxLength: 500
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
rewardRedemptionSchema.index({ citizenId: 1, createdAt: -1 });
rewardRedemptionSchema.index({ status: 1, createdAt: -1 });
rewardRedemptionSchema.index({ expiresAt: 1, status: 1 });
rewardRedemptionSchema.index({ redemptionCode: 1 }, { unique: true });

// Generate unique redemption code
rewardRedemptionSchema.pre('save', function(next) {
    if (this.isNew && !this.redemptionCode) {
        this.redemptionCode = this.generateRedemptionCode();
    }
    next();
});

// Method to generate redemption code
rewardRedemptionSchema.methods.generateRedemptionCode = function() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ECO-${timestamp}-${random}`;
};

// Method to approve redemption
rewardRedemptionSchema.methods.approve = function(adminId, notes) {
    this.status = 'approved';
    this.approvedAt = new Date();
    this.processedBy = adminId;
    if (notes) this.adminNotes = notes;
    return this.save();
};

// Method to fulfill redemption
rewardRedemptionSchema.methods.fulfill = function(adminId, fulfillmentDetails, notes) {
    this.status = 'fulfilled';
    this.fulfilledAt = new Date();
    this.processedBy = adminId;
    if (fulfillmentDetails) {
        this.fulfillmentDetails = { ...this.fulfillmentDetails, ...fulfillmentDetails };
    }
    if (notes) this.adminNotes = notes;
    return this.save();
};

// Method to cancel redemption
rewardRedemptionSchema.methods.cancel = function(adminId, reason) {
    this.status = 'cancelled';
    this.cancelledAt = new Date();
    this.processedBy = adminId;
    this.cancellationReason = reason;
    return this.save();
};

// Method to check if redemption is expired
rewardRedemptionSchema.methods.isExpired = function() {
    return this.expiresAt < new Date() && this.status === 'pending';
};

// Static method to get user redemptions
rewardRedemptionSchema.statics.getUserRedemptions = function(citizenId, filters = {}) {
    const query = { citizenId };
    
    if (filters.status) query.status = filters.status;
    if (filters.dateFrom) query.createdAt = { $gte: new Date(filters.dateFrom) };
    if (filters.dateTo) query.createdAt = { ...query.createdAt, $lte: new Date(filters.dateTo) };

    return this.find(query)
        .populate('rewardId', 'name description image category')
        .populate('citizenId', 'name email')
        .sort({ createdAt: -1 });
};

// Static method to get pending redemptions for admin
rewardRedemptionSchema.statics.getPendingRedemptions = function() {
    return this.find({ status: 'pending' })
        .populate('rewardId', 'name description image category pointsCost')
        .populate('citizenId', 'name email mobile')
        .sort({ createdAt: 1 }); // Oldest first for processing
};

// Static method to expire old redemptions
rewardRedemptionSchema.statics.expireOldRedemptions = async function() {
    const expiredRedemptions = await this.find({
        status: 'pending',
        expiresAt: { $lt: new Date() }
    });

    const results = await Promise.all(
        expiredRedemptions.map(async (redemption) => {
            redemption.status = 'expired';
            await redemption.save();
            return redemption;
        })
    );

    return results;
};

// Virtual for time remaining
rewardRedemptionSchema.virtual('timeRemaining').get(function() {
    if (this.status !== 'pending') return null;
    const now = new Date();
    const remaining = this.expiresAt - now;
    return remaining > 0 ? remaining : 0;
});

const RewardRedemption = mongoose.model('RewardRedemption', rewardRedemptionSchema);
export default RewardRedemption;