import mongoose from 'mongoose';

const rewardSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxLength: 100
    },
    description: {
        type: String,
        required: true,
        maxLength: 500
    },
    category: {
        type: String,
        required: true,
        enum: ['vouchers', 'products', 'experiences', 'donations', 'discounts'],
        index: true
    },
    pointsCost: {
        type: Number,
        required: true,
        min: 1,
        index: true
    },
    image: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(v);
            },
            message: 'Image must be a valid URL ending with image extension'
        }
    },
    partnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Partner',
        required: false
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    stock: {
        type: Number,
        required: false,
        min: 0,
        default: null // null means unlimited stock
    },
    expiresAt: {
        type: Date,
        required: false,
        index: true
    },
    terms: [{
        type: String,
        maxLength: 200
    }],
    // Additional metadata
    priority: {
        type: Number,
        default: 0,
        index: true // Higher numbers appear first
    },
    redemptionInstructions: {
        type: String,
        maxLength: 1000
    },
    estimatedDelivery: {
        type: String,
        maxLength: 100
    },
    // Tracking fields
    totalRedemptions: {
        type: Number,
        default: 0,
        min: 0
    },
    lastRedeemedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
rewardSchema.index({ category: 1, isActive: 1, priority: -1 });
rewardSchema.index({ pointsCost: 1, isActive: 1 });
rewardSchema.index({ expiresAt: 1, isActive: 1 });
rewardSchema.index({ name: 'text', description: 'text' }); // Text search

// Virtual for checking if reward is available
rewardSchema.virtual('isAvailable').get(function() {
    if (!this.isActive) return false;
    if (this.expiresAt && this.expiresAt < new Date()) return false;
    if (this.stock !== null && this.stock <= 0) return false;
    return true;
});

// Method to check if reward can be redeemed
rewardSchema.methods.canRedeem = function(userPoints) {
    if (!this.isAvailable) return { canRedeem: false, reason: 'Reward not available' };
    if (userPoints < this.pointsCost) return { canRedeem: false, reason: 'Insufficient points' };
    return { canRedeem: true };
};

// Method to decrement stock
rewardSchema.methods.decrementStock = function() {
    if (this.stock !== null && this.stock > 0) {
        this.stock -= 1;
    }
    this.totalRedemptions += 1;
    this.lastRedeemedAt = new Date();
    return this.save();
};

// Static method to get available rewards
rewardSchema.statics.getAvailableRewards = function(filters = {}) {
    const query = {
        isActive: true,
        $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
        ],
        $or: [
            { stock: { $exists: false } },
            { stock: null },
            { stock: { $gt: 0 } }
        ]
    };

    // Apply additional filters
    if (filters.category) query.category = filters.category;
    if (filters.maxPoints) query.pointsCost = { $lte: filters.maxPoints };
    if (filters.minPoints) query.pointsCost = { ...query.pointsCost, $gte: filters.minPoints };
    if (filters.partnerId) query.partnerId = filters.partnerId;

    return this.find(query)
        .populate('partnerId', 'name logo')
        .sort({ priority: -1, pointsCost: 1 });
};

// Static method to search rewards
rewardSchema.statics.searchRewards = function(searchTerm, filters = {}) {
    const query = {
        isActive: true,
        $text: { $search: searchTerm },
        $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
        ]
    };

    if (filters.category) query.category = filters.category;
    if (filters.maxPoints) query.pointsCost = { $lte: filters.maxPoints };

    return this.find(query, { score: { $meta: 'textScore' } })
        .populate('partnerId', 'name logo')
        .sort({ score: { $meta: 'textScore' }, priority: -1 });
};

const Reward = mongoose.model('Reward', rewardSchema);
export default Reward;