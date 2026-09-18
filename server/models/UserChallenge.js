import mongoose from 'mongoose';

const userChallengeSchema = new mongoose.Schema({
    citizenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    challengeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Challenge',
        required: true
    },
    progress: {
        type: Number,
        default: 0,
        min: 0
    },
    completed: {
        type: Boolean,
        default: false
    },
    completedAt: {
        type: Date
    },
    rewardClaimed: {
        type: Boolean,
        default: false
    },
    claimedAt: {
        type: Date
    },
    // Track progress details for different metrics
    progressDetails: {
        totalWeight: {
            type: Number,
            default: 0
        },
        totalPickups: {
            type: Number,
            default: 0
        },
        totalPoints: {
            type: Number,
            default: 0
        },
        currentStreak: {
            type: Number,
            default: 0
        },
        wasteTypeBreakdown: [{
            wasteType: {
                type: String,
                enum: ['plastic', 'paper', 'glass', 'metal', 'organic', 'electronic', 'hazardous']
            },
            weight: {
                type: Number,
                default: 0
            }
        }]
    }
}, {
    timestamps: true
});

// Compound indexes for efficient querying
userChallengeSchema.index({ citizenId: 1, challengeId: 1 }, { unique: true });
userChallengeSchema.index({ citizenId: 1, completed: 1 });
userChallengeSchema.index({ challengeId: 1, completed: 1 });
userChallengeSchema.index({ citizenId: 1, rewardClaimed: 1 });

// Virtual to calculate completion percentage
userChallengeSchema.virtual('completionPercentage').get(function() {
    if (!this.populated('challengeId') || !this.challengeId.target) {
        return 0;
    }
    
    const targetValue = this.challengeId.target.value;
    if (targetValue === 0) return 100;
    
    return Math.min(100, (this.progress / targetValue) * 100);
});

// Method to update progress based on challenge metric
userChallengeSchema.methods.updateProgress = async function(activityData) {
    if (this.completed) {
        return this; // Already completed, no need to update
    }
    
    await this.populate('challengeId');
    const challenge = this.challengeId;
    
    if (!challenge || !challenge.isCurrentlyActive) {
        return this;
    }
    
    const metric = challenge.target.metric;
    const targetWasteTypes = challenge.target.wasteTypes;
    
    // Update progress details based on activity type
    switch (activityData.type) {
        case 'waste_logged':
            this.progressDetails.totalWeight += activityData.weight || 0;
            this.progressDetails.totalPoints += activityData.points || 0;
            
            // Update waste type breakdown if challenge is type-specific
            if (targetWasteTypes && targetWasteTypes.length > 0 && 
                targetWasteTypes.includes(activityData.wasteType)) {
                const existingType = this.progressDetails.wasteTypeBreakdown.find(
                    item => item.wasteType === activityData.wasteType
                );
                if (existingType) {
                    existingType.weight += activityData.weight || 0;
                } else {
                    this.progressDetails.wasteTypeBreakdown.push({
                        wasteType: activityData.wasteType,
                        weight: activityData.weight || 0
                    });
                }
            }
            break;
            
        case 'pickup_completed':
            this.progressDetails.totalPickups += 1;
            this.progressDetails.totalPoints += activityData.points || 0;
            break;
            
        case 'streak_updated':
            this.progressDetails.currentStreak = activityData.streak || 0;
            break;
    }
    
    // Calculate progress based on challenge metric
    switch (metric) {
        case 'weight':
            if (targetWasteTypes && targetWasteTypes.length > 0) {
                // Sum weight for specific waste types
                this.progress = this.progressDetails.wasteTypeBreakdown
                    .filter(item => targetWasteTypes.includes(item.wasteType))
                    .reduce((sum, item) => sum + item.weight, 0);
            } else {
                this.progress = this.progressDetails.totalWeight;
            }
            break;
            
        case 'pickups':
            this.progress = this.progressDetails.totalPickups;
            break;
            
        case 'points':
            this.progress = this.progressDetails.totalPoints;
            break;
            
        case 'streak':
            this.progress = this.progressDetails.currentStreak;
            break;
    }
    
    // Check if challenge is completed
    if (this.progress >= challenge.target.value && !this.completed) {
        this.completed = true;
        this.completedAt = new Date();
    }
    
    return this.save();
};

// Method to claim reward
userChallengeSchema.methods.claimReward = async function() {
    if (!this.completed || this.rewardClaimed) {
        throw new Error('Cannot claim reward: challenge not completed or already claimed');
    }
    
    this.rewardClaimed = true;
    this.claimedAt = new Date();
    
    return this.save();
};

// Static method to find user's active challenges
userChallengeSchema.statics.findActiveForUser = function(userId) {
    return this.find({
        citizenId: userId,
        completed: false
    }).populate({
        path: 'challengeId',
        match: { 
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        }
    });
};

// Static method to find completed challenges with unclaimed rewards
userChallengeSchema.statics.findUnclaimedRewards = function(userId) {
    return this.find({
        citizenId: userId,
        completed: true,
        rewardClaimed: false
    }).populate('challengeId');
};

// Static method to get user's challenge statistics
userChallengeSchema.statics.getUserStats = async function(userId) {
    const stats = await this.aggregate([
        { $match: { citizenId: new mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: null,
                totalChallenges: { $sum: 1 },
                completedChallenges: {
                    $sum: { $cond: ['$completed', 1, 0] }
                },
                unclaimedRewards: {
                    $sum: { $cond: [{ $and: ['$completed', { $not: '$rewardClaimed' }] }, 1, 0] }
                }
            }
        }
    ]);
    
    return stats[0] || {
        totalChallenges: 0,
        completedChallenges: 0,
        unclaimedRewards: 0
    };
};

const UserChallenge = mongoose.model('UserChallenge', userChallengeSchema);
export default UserChallenge;