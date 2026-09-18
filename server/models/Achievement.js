import mongoose from 'mongoose';

const achievementSchema = new mongoose.Schema({
    name: {
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
    icon: {
        type: String,
        required: true,
        trim: true
    },
    rarity: {
        type: String,
        enum: ['common', 'rare', 'epic', 'legendary'],
        default: 'common'
    },
    category: {
        type: String,
        enum: ['waste', 'pickup', 'streak', 'challenge', 'milestone', 'special'],
        required: true
    },
    // Criteria for earning this achievement
    criteria: {
        type: {
            type: String,
            enum: ['weight', 'pickups', 'points', 'streak', 'challenge_completion', 'milestone'],
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
        }],
        timeframe: {
            type: String,
            enum: ['daily', 'weekly', 'monthly', 'all_time'],
            default: 'all_time'
        }
    },
    // Reward for earning this achievement
    reward: {
        points: {
            type: Number,
            default: 0,
            min: 0
        },
        badge: {
            type: String,
            trim: true
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Achievement unlock requirements
    prerequisites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Achievement'
    }],
    // Statistics
    totalEarned: {
        type: Number,
        default: 0,
        min: 0
    },
    // Display order
    sortOrder: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
achievementSchema.index({ category: 1, isActive: 1 });
achievementSchema.index({ rarity: 1 });
achievementSchema.index({ sortOrder: 1 });
achievementSchema.index({ 'criteria.type': 1 });

// Virtual to get achievement difficulty based on criteria and rarity
achievementSchema.virtual('difficulty').get(function() {
    const rarityScores = { common: 1, rare: 2, epic: 3, legendary: 4 };
    const valueScore = Math.log10(this.criteria.value + 1);
    return rarityScores[this.rarity] * valueScore;
});

// Method to check if user meets achievement criteria
achievementSchema.methods.checkCriteria = function(userStats) {
    const { type, value, wasteTypes, timeframe } = this.criteria;
    
    switch (type) {
        case 'weight':
            if (wasteTypes && wasteTypes.length > 0) {
                const typeWeight = userStats.wasteBreakdown
                    ?.filter(wb => wasteTypes.includes(wb.type.toLowerCase()))
                    ?.reduce((sum, wb) => sum + wb.weight, 0) || 0;
                return typeWeight >= value;
            }
            return (userStats.totalWasteRecycled || 0) >= value;
            
        case 'pickups':
            return (userStats.pickupsCompleted || 0) >= value;
            
        case 'points':
            return (userStats.ecoPointsEarned || 0) >= value;
            
        case 'streak':
            if (timeframe === 'all_time') {
                return (userStats.longestStreak || 0) >= value;
            }
            return (userStats.currentStreak || 0) >= value;
            
        case 'challenge_completion':
            return (userStats.challengesCompleted || 0) >= value;
            
        case 'milestone':
            // Custom milestone logic can be implemented here
            return false;
            
        default:
            return false;
    }
};

// Static method to find achievements user can earn
achievementSchema.statics.findEarnableForUser = async function(userId, userStats) {
    // Get user's current achievements
    const userAchievements = await mongoose.model('UserAchievement').find({ 
        citizenId: userId 
    }).select('achievementId');
    
    const earnedAchievementIds = userAchievements.map(ua => ua.achievementId);
    
    // Find active achievements user hasn't earned yet
    const availableAchievements = await this.find({
        _id: { $nin: earnedAchievementIds },
        isActive: true
    }).populate('prerequisites');
    
    const earnableAchievements = [];
    
    for (const achievement of availableAchievements) {
        // Check prerequisites
        const hasPrerequisites = achievement.prerequisites.length === 0 || 
            achievement.prerequisites.every(prereq => 
                earnedAchievementIds.some(id => id.toString() === prereq._id.toString())
            );
        
        if (hasPrerequisites && achievement.checkCriteria(userStats)) {
            earnableAchievements.push(achievement);
        }
    }
    
    return earnableAchievements;
};

// Static method to create default achievements
achievementSchema.statics.createDefaultAchievements = async function() {
    const defaultAchievements = [
        // Waste-based achievements
        {
            name: 'First Steps',
            description: 'Log your first waste item',
            icon: '🌱',
            rarity: 'common',
            category: 'waste',
            criteria: { type: 'weight', value: 0.1 },
            reward: { points: 10, badge: 'Beginner' },
            sortOrder: 1
        },
        {
            name: 'Getting Started',
            description: 'Recycle 10kg of waste',
            icon: '📦',
            rarity: 'common',
            category: 'waste',
            criteria: { type: 'weight', value: 10 },
            reward: { points: 50, badge: 'Starter' },
            sortOrder: 2
        },
        {
            name: 'Eco Enthusiast',
            description: 'Recycle 50kg of waste',
            icon: '♻️',
            rarity: 'rare',
            category: 'waste',
            criteria: { type: 'weight', value: 50 },
            reward: { points: 200, badge: 'Enthusiast' },
            sortOrder: 3
        },
        {
            name: 'Recycling Champion',
            description: 'Recycle 100kg of waste',
            icon: '🏆',
            rarity: 'epic',
            category: 'waste',
            criteria: { type: 'weight', value: 100 },
            reward: { points: 500, badge: 'Champion' },
            sortOrder: 4
        },
        {
            name: 'Eco Warrior',
            description: 'Recycle 500kg of waste',
            icon: '⚔️',
            rarity: 'legendary',
            category: 'waste',
            criteria: { type: 'weight', value: 500 },
            reward: { points: 2000, badge: 'Warrior' },
            sortOrder: 5
        },
        
        // Pickup-based achievements
        {
            name: 'First Pickup',
            description: 'Complete your first pickup',
            icon: '🚚',
            rarity: 'common',
            category: 'pickup',
            criteria: { type: 'pickups', value: 1 },
            reward: { points: 25, badge: 'Collector' },
            sortOrder: 10
        },
        {
            name: 'Pickup Pro',
            description: 'Complete 10 pickups',
            icon: '📋',
            rarity: 'rare',
            category: 'pickup',
            criteria: { type: 'pickups', value: 10 },
            reward: { points: 150, badge: 'Pro' },
            sortOrder: 11
        },
        {
            name: 'Collection Master',
            description: 'Complete 50 pickups',
            icon: '🎯',
            rarity: 'epic',
            category: 'pickup',
            criteria: { type: 'pickups', value: 50 },
            reward: { points: 750, badge: 'Master' },
            sortOrder: 12
        },
        
        // Streak-based achievements
        {
            name: 'Week Warrior',
            description: 'Maintain a 7-day recycling streak',
            icon: '🔥',
            rarity: 'rare',
            category: 'streak',
            criteria: { type: 'streak', value: 7 },
            reward: { points: 100, badge: 'Streak Warrior' },
            sortOrder: 20
        },
        {
            name: 'Consistency King',
            description: 'Maintain a 30-day recycling streak',
            icon: '👑',
            rarity: 'legendary',
            category: 'streak',
            criteria: { type: 'streak', value: 30 },
            reward: { points: 1000, badge: 'Consistency King' },
            sortOrder: 21
        },
        
        // Challenge-based achievements
        {
            name: 'Challenge Accepted',
            description: 'Complete your first challenge',
            icon: '🎪',
            rarity: 'common',
            category: 'challenge',
            criteria: { type: 'challenge_completion', value: 1 },
            reward: { points: 50, badge: 'Challenger' },
            sortOrder: 30
        },
        {
            name: 'Challenge Champion',
            description: 'Complete 10 challenges',
            icon: '🏅',
            rarity: 'epic',
            category: 'challenge',
            criteria: { type: 'challenge_completion', value: 10 },
            reward: { points: 500, badge: 'Challenge Champion' },
            sortOrder: 31
        },
        
        // Waste type specific achievements
        {
            name: 'Plastic Warrior',
            description: 'Recycle 25kg of plastic',
            icon: '🥤',
            rarity: 'rare',
            category: 'waste',
            criteria: { type: 'weight', value: 25, wasteTypes: ['plastic'] },
            reward: { points: 200, badge: 'Plastic Warrior' },
            sortOrder: 40
        },
        {
            name: 'Paper Champion',
            description: 'Recycle 50kg of paper',
            icon: '📄',
            rarity: 'rare',
            category: 'waste',
            criteria: { type: 'weight', value: 50, wasteTypes: ['paper'] },
            reward: { points: 200, badge: 'Paper Champion' },
            sortOrder: 41
        },
        {
            name: 'Metal Master',
            description: 'Recycle 20kg of metal',
            icon: '🔩',
            rarity: 'epic',
            category: 'waste',
            criteria: { type: 'weight', value: 20, wasteTypes: ['metal'] },
            reward: { points: 300, badge: 'Metal Master' },
            sortOrder: 42
        }
    ];
    
    // Only create achievements that don't already exist
    for (const achievementData of defaultAchievements) {
        const existing = await this.findOne({ name: achievementData.name });
        if (!existing) {
            await this.create(achievementData);
        }
    }
    
    console.log('Default achievements created successfully');
};

const Achievement = mongoose.model('Achievement', achievementSchema);
export default Achievement;