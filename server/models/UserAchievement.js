import mongoose from 'mongoose';

const userAchievementSchema = new mongoose.Schema({
    citizenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    achievementId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Achievement',
        required: true
    },
    earnedAt: {
        type: Date,
        default: Date.now
    },
    // Progress tracking for achievements that can be partially completed
    progress: {
        current: {
            type: Number,
            default: 0,
            min: 0
        },
        target: {
            type: Number,
            required: true,
            min: 0
        },
        percentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        }
    },
    // Reward claim status
    rewardClaimed: {
        type: Boolean,
        default: false
    },
    claimedAt: {
        type: Date
    },
    // Context data when achievement was earned
    context: {
        triggerType: {
            type: String,
            enum: ['waste_logged', 'pickup_completed', 'challenge_completed', 'streak_achieved', 'manual'],
            required: true
        },
        triggerData: {
            type: mongoose.Schema.Types.Mixed // Flexible data based on trigger type
        }
    }
}, {
    timestamps: true
});

// Compound indexes for efficient querying
userAchievementSchema.index({ citizenId: 1, achievementId: 1 }, { unique: true });
userAchievementSchema.index({ citizenId: 1, earnedAt: -1 });
userAchievementSchema.index({ achievementId: 1, earnedAt: -1 });
userAchievementSchema.index({ citizenId: 1, rewardClaimed: 1 });

// Virtual to check if achievement is completed
userAchievementSchema.virtual('isCompleted').get(function() {
    return this.progress.current >= this.progress.target;
});

// Method to update progress
userAchievementSchema.methods.updateProgress = function(currentValue) {
    this.progress.current = Math.min(currentValue, this.progress.target);
    this.progress.percentage = this.progress.target > 0 
        ? Math.round((this.progress.current / this.progress.target) * 100)
        : 100;
    
    return this.save();
};

// Method to claim reward
userAchievementSchema.methods.claimReward = async function() {
    if (!this.isCompleted) {
        throw new Error('Achievement not completed yet');
    }
    
    if (this.rewardClaimed) {
        throw new Error('Reward already claimed');
    }
    
    this.rewardClaimed = true;
    this.claimedAt = new Date();
    
    return this.save();
};

// Static method to find user's achievements with details
userAchievementSchema.statics.findUserAchievements = function(userId, options = {}) {
    const {
        category,
        rarity,
        completed = null,
        limit = 50,
        sort = { earnedAt: -1 }
    } = options;
    
    let query = { citizenId: userId };
    
    const pipeline = [
        { $match: query },
        {
            $lookup: {
                from: 'achievements',
                localField: 'achievementId',
                foreignField: '_id',
                as: 'achievement'
            }
        },
        { $unwind: '$achievement' },
        {
            $match: {
                ...(category && { 'achievement.category': category }),
                ...(rarity && { 'achievement.rarity': rarity }),
                ...(completed !== null && { 
                    $expr: completed 
                        ? { $gte: ['$progress.current', '$progress.target'] }
                        : { $lt: ['$progress.current', '$progress.target'] }
                })
            }
        },
        { $sort: sort },
        { $limit: limit }
    ];
    
    return this.aggregate(pipeline);
};

// Static method to get user achievement statistics
userAchievementSchema.statics.getUserStats = async function(userId) {
    const stats = await this.aggregate([
        { $match: { citizenId: new mongoose.Types.ObjectId(userId) } },
        {
            $lookup: {
                from: 'achievements',
                localField: 'achievementId',
                foreignField: '_id',
                as: 'achievement'
            }
        },
        { $unwind: '$achievement' },
        {
            $group: {
                _id: null,
                totalAchievements: { $sum: 1 },
                completedAchievements: {
                    $sum: {
                        $cond: [
                            { $gte: ['$progress.current', '$progress.target'] },
                            1,
                            0
                        ]
                    }
                },
                unclaimedRewards: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ['$progress.current', '$progress.target'] },
                                    { $eq: ['$rewardClaimed', false] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                totalPointsEarned: {
                    $sum: {
                        $cond: [
                            { $eq: ['$rewardClaimed', true] },
                            '$achievement.reward.points',
                            0
                        ]
                    }
                },
                rarityBreakdown: {
                    $push: {
                        $cond: [
                            { $gte: ['$progress.current', '$progress.target'] },
                            '$achievement.rarity',
                            null
                        ]
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                totalAchievements: 1,
                completedAchievements: 1,
                unclaimedRewards: 1,
                totalPointsEarned: 1,
                completionRate: {
                    $cond: [
                        { $gt: ['$totalAchievements', 0] },
                        { $multiply: [{ $divide: ['$completedAchievements', '$totalAchievements'] }, 100] },
                        0
                    ]
                },
                rarityBreakdown: {
                    $arrayToObject: {
                        $map: {
                            input: ['common', 'rare', 'epic', 'legendary'],
                            as: 'rarity',
                            in: {
                                k: '$$rarity',
                                v: {
                                    $size: {
                                        $filter: {
                                            input: '$rarityBreakdown',
                                            cond: { $eq: ['$$this', '$$rarity'] }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    ]);
    
    return stats[0] || {
        totalAchievements: 0,
        completedAchievements: 0,
        unclaimedRewards: 0,
        totalPointsEarned: 0,
        completionRate: 0,
        rarityBreakdown: { common: 0, rare: 0, epic: 0, legendary: 0 }
    };
};

// Static method to find unclaimed rewards
userAchievementSchema.statics.findUnclaimedRewards = function(userId) {
    return this.find({
        citizenId: userId,
        rewardClaimed: false,
        $expr: { $gte: ['$progress.current', '$progress.target'] }
    }).populate('achievementId');
};

// Static method to create or update user achievement progress
userAchievementSchema.statics.createOrUpdateProgress = async function(userId, achievementId, currentValue, context) {
    const achievement = await mongoose.model('Achievement').findById(achievementId);
    if (!achievement) {
        throw new Error('Achievement not found');
    }
    
    let userAchievement = await this.findOne({
        citizenId: userId,
        achievementId: achievementId
    });
    
    if (!userAchievement) {
        // Create new user achievement
        userAchievement = new this({
            citizenId: userId,
            achievementId: achievementId,
            progress: {
                current: Math.min(currentValue, achievement.criteria.value),
                target: achievement.criteria.value,
                percentage: 0
            },
            context: context
        });
    }
    
    // Update progress
    await userAchievement.updateProgress(currentValue);
    
    // Check if just completed
    const wasCompleted = userAchievement.isCompleted;
    
    if (wasCompleted && !userAchievement.earnedAt) {
        userAchievement.earnedAt = new Date();
        
        // Increment achievement's total earned count
        await mongoose.model('Achievement').findByIdAndUpdate(
            achievementId,
            { $inc: { totalEarned: 1 } }
        );
    }
    
    await userAchievement.save();
    
    return {
        userAchievement,
        justCompleted: wasCompleted && !userAchievement.earnedAt
    };
};

const UserAchievement = mongoose.model('UserAchievement', userAchievementSchema);
export default UserAchievement;