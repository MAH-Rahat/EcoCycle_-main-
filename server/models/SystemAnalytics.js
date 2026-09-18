import mongoose from 'mongoose';

const systemAnalyticsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        index: true
    },
    period: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        required: true,
        index: true
    },
    // City-wide waste management statistics
    wasteManagement: {
        totalWasteCollected: {
            type: Number,
            default: 0
        },
        totalPickupsCompleted: {
            type: Number,
            default: 0
        },
        averagePickupTime: {
            type: Number, // in minutes
            default: 0
        },
        wasteByType: [{
            type: String,
            weight: Number
        }]
    },
    // User engagement metrics
    userEngagement: {
        totalActiveUsers: {
            type: Number,
            default: 0
        },
        newRegistrations: {
            type: Number,
            default: 0
        },
        dailyActiveUsers: {
            type: Number,
            default: 0
        },
        averageSessionDuration: {
            type: Number, // in minutes
            default: 0
        }
    },
    // System usage tracking
    systemUsage: {
        totalApiCalls: {
            type: Number,
            default: 0
        },
        averageResponseTime: {
            type: Number, // in milliseconds
            default: 0
        },
        errorRate: {
            type: Number, // percentage
            default: 0
        }
    },
    // Environmental impact
    environmentalImpact: {
        totalCO2Saved: {
            type: Number,
            default: 0
        },
        totalEcoPointsAwarded: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});

// Compound indexes
systemAnalyticsSchema.index({ date: 1, period: 1 }, { unique: true });

// Static method to get analytics for a date range
systemAnalyticsSchema.statics.getAnalytics = function(startDate, endDate, period = 'daily') {
    return this.find({
        date: { $gte: startDate, $lte: endDate },
        period: period
    }).sort({ date: 1 });
};

const SystemAnalytics = mongoose.model('SystemAnalytics', systemAnalyticsSchema);
export default SystemAnalytics;
