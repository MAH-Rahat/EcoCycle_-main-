import mongoose from 'mongoose';

// Challenge target schema
const challengeTargetSchema = new mongoose.Schema({
    metric: {
        type: String,
        enum: ['weight', 'pickups', 'points', 'streak'],
        required: true
    },
    value: {
        type: Number,
        required: true,
        min: 0
    },
    wasteTypes: [{
        type: String,
        enum: ['plastic', 'paper', 'glass', 'metal', 'organic', 'electronic', 'hazardous']
    }]
}, {
    _id: false
});

// Challenge reward schema
const challengeRewardSchema = new mongoose.Schema({
    points: {
        type: Number,
        required: true,
        min: 0
    },
    badge: {
        type: String,
        trim: true
    }
}, {
    _id: false
});

const challengeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    type: {
        type: String,
        enum: ['weekly', 'monthly', 'special'],
        required: true
    },
    target: {
        type: challengeTargetSchema,
        required: true
    },
    reward: {
        type: challengeRewardSchema,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true,
        validate: {
            validator: function(endDate) {
                return endDate > this.startDate;
            },
            message: 'End date must be after start date'
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // Area restriction for localized challenges
    area: {
        zipCode: String,
        city: String,
        coordinates: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number] // [longitude, latitude]
            }
        },
        radius: {
            type: Number, // in kilometers
            min: 0
        }
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
challengeSchema.index({ type: 1, isActive: 1 });
challengeSchema.index({ startDate: 1, endDate: 1 });
challengeSchema.index({ 'area.zipCode': 1 });
challengeSchema.index({ 'area.coordinates': '2dsphere' });

// Virtual to check if challenge is currently active
challengeSchema.virtual('isCurrentlyActive').get(function() {
    const now = new Date();
    return this.isActive && this.startDate <= now && this.endDate >= now;
});

// Method to check if a user can participate in this challenge
challengeSchema.methods.canUserParticipate = function(user) {
    // Check if challenge is active and within time bounds
    if (!this.isCurrentlyActive) {
        return false;
    }
    
    // Check if user is already a participant
    if (this.participants.includes(user._id)) {
        return true;
    }
    
    // Check area restrictions if any
    if (this.area && this.area.zipCode) {
        const userAddresses = user.profile?.addresses || [];
        const hasMatchingAddress = userAddresses.some(addr => 
            addr.zipCode === this.area.zipCode
        );
        if (!hasMatchingAddress) {
            return false;
        }
    }
    
    return true;
};

// Method to add a participant
challengeSchema.methods.addParticipant = function(userId) {
    if (!this.participants.includes(userId)) {
        this.participants.push(userId);
        return this.save();
    }
    return Promise.resolve(this);
};

// Static method to find active challenges for a user
challengeSchema.statics.findActiveForUser = function(user) {
    const now = new Date();
    
    return this.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        $or: [
            { 'area.zipCode': { $exists: false } }, // Global challenges
            { 'area.zipCode': null },
            { 'area.zipCode': { $in: user.profile?.addresses?.map(addr => addr.zipCode) || [] } }
        ]
    });
};

// Static method to create weekly challenges
challengeSchema.statics.createWeeklyChallenge = function(challengeData) {
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Start of current week
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return this.create({
        ...challengeData,
        type: 'weekly',
        startDate: startOfWeek,
        endDate: endOfWeek
    });
};

// Static method to create monthly challenges
challengeSchema.statics.createMonthlyChallenge = function(challengeData) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    return this.create({
        ...challengeData,
        type: 'monthly',
        startDate: startOfMonth,
        endDate: endOfMonth
    });
};

const Challenge = mongoose.model('Challenge', challengeSchema);
export default Challenge;