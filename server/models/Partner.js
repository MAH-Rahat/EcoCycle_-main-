import mongoose from 'mongoose';

const partnerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxLength: 100,
        index: true
    },
    description: {
        type: String,
        required: true,
        maxLength: 500
    },
    logo: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(v);
            },
            message: 'Logo must be a valid URL ending with image extension'
        }
    },
    website: {
        type: String,
        required: false,
        validate: {
            validator: function(v) {
                return !v || /^https?:\/\/.+/.test(v);
            },
            message: 'Website must be a valid URL'
        }
    },
    contactInfo: {
        email: {
            type: String,
            required: true,
            validate: {
                validator: function(v) {
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
                },
                message: 'Invalid email format'
            }
        },
        phone: {
            type: String,
            required: false
        },
        address: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: String
        }
    },
    // Partnership details
    partnershipType: {
        type: String,
        enum: ['voucher_provider', 'product_supplier', 'service_provider', 'charity', 'local_business'],
        required: true,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    // Integration settings
    apiIntegration: {
        hasApi: {
            type: Boolean,
            default: false
        },
        apiEndpoint: {
            type: String,
            required: false
        },
        apiKey: {
            type: String,
            required: false,
            select: false // Don't include in queries by default
        },
        webhookUrl: {
            type: String,
            required: false
        }
    },
    // Terms and conditions
    terms: [{
        type: String,
        maxLength: 200
    }],
    // Statistics
    stats: {
        totalRewards: {
            type: Number,
            default: 0,
            min: 0
        },
        totalRedemptions: {
            type: Number,
            default: 0,
            min: 0
        },
        lastRedemptionAt: {
            type: Date
        }
    },
    // Contract details
    contractDetails: {
        startDate: {
            type: Date,
            required: true,
            default: Date.now
        },
        endDate: {
            type: Date,
            required: false
        },
        commissionRate: {
            type: Number,
            min: 0,
            max: 100,
            default: 0 // Percentage
        },
        paymentTerms: {
            type: String,
            maxLength: 200
        }
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
partnerSchema.index({ name: 1, isActive: 1 });
partnerSchema.index({ partnershipType: 1, isActive: 1 });
partnerSchema.index({ 'contractDetails.endDate': 1, isActive: 1 });

// Virtual for checking if partnership is active
partnerSchema.virtual('isPartnershipActive').get(function() {
    if (!this.isActive) return false;
    if (this.contractDetails.endDate && this.contractDetails.endDate < new Date()) return false;
    return true;
});

// Method to update statistics
partnerSchema.methods.updateStats = async function() {
    const Reward = mongoose.model('Reward');
    const RewardRedemption = mongoose.model('RewardRedemption');
    
    const totalRewards = await Reward.countDocuments({ partnerId: this._id });
    const redemptions = await RewardRedemption.aggregate([
        {
            $lookup: {
                from: 'rewards',
                localField: 'rewardId',
                foreignField: '_id',
                as: 'reward'
            }
        },
        {
            $match: {
                'reward.partnerId': this._id,
                status: { $in: ['approved', 'fulfilled'] }
            }
        },
        {
            $group: {
                _id: null,
                totalRedemptions: { $sum: 1 },
                lastRedemption: { $max: '$createdAt' }
            }
        }
    ]);
    
    this.stats.totalRewards = totalRewards;
    this.stats.totalRedemptions = redemptions[0]?.totalRedemptions || 0;
    this.stats.lastRedemptionAt = redemptions[0]?.lastRedemption || null;
    
    return this.save();
};

// Static method to get active partners
partnerSchema.statics.getActivePartners = function() {
    return this.find({
        isActive: true,
        $or: [
            { 'contractDetails.endDate': { $exists: false } },
            { 'contractDetails.endDate': null },
            { 'contractDetails.endDate': { $gt: new Date() } }
        ]
    }).sort({ name: 1 });
};

// Static method to get partners by type
partnerSchema.statics.getPartnersByType = function(partnershipType) {
    return this.find({
        partnershipType,
        isActive: true
    }).sort({ name: 1 });
};

const Partner = mongoose.model('Partner', partnerSchema);
export default Partner;