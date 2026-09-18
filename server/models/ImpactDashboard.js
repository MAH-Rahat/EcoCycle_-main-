import mongoose from 'mongoose';

const achievementSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    icon: {
        type: String,
        required: true
    },
    rarity: {
        type: String,
        enum: ['common', 'rare', 'epic', 'legendary'],
        default: 'common'
    },
    unlockedAt: {
        type: Date,
        default: Date.now
    }
});

const monthlyTrendSchema = new mongoose.Schema({
    month: {
        type: String,
        required: true // Format: YYYY-MM
    },
    weight: {
        type: Number,
        default: 0,
        min: 0
    },
    points: {
        type: Number,
        default: 0,
        min: 0
    },
    co2Saved: {
        type: Number,
        default: 0,
        min: 0
    },
    pickupsCompleted: {
        type: Number,
        default: 0,
        min: 0
    }
});

const wasteBreakdownSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Plastic', 'Paper', 'Metal', 'Glass', 'E-Waste', 'Organic', 'Other'],
        required: true
    },
    weight: {
        type: Number,
        default: 0,
        min: 0
    },
    percentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    pointsEarned: {
        type: Number,
        default: 0,
        min: 0
    }
});

const impactDashboardSchema = new mongoose.Schema({
    citizenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    // Core metrics
    totalWasteRecycled: {
        type: Number,
        default: 0,
        min: 0 // in kg
    },
    co2Saved: {
        type: Number,
        default: 0,
        min: 0 // in kg CO2
    },
    ecoPointsEarned: {
        type: Number,
        default: 0,
        min: 0
    },
    pickupsCompleted: {
        type: Number,
        default: 0,
        min: 0
    },
    // Streak tracking
    currentStreak: {
        type: Number,
        default: 0,
        min: 0 // days
    },
    longestStreak: {
        type: Number,
        default: 0,
        min: 0 // days
    },
    lastActivityDate: {
        type: Date,
        default: null
    },
    // Breakdown by waste type
    wasteBreakdown: [wasteBreakdownSchema],
    // Monthly trends (last 12 months)
    monthlyTrends: [monthlyTrendSchema],
    // Achievements
    achievements: [achievementSchema],
    // Milestones
    milestones: {
        firstWasteLogged: {
            achieved: { type: Boolean, default: false },
            achievedAt: Date
        },
        first10kg: {
            achieved: { type: Boolean, default: false },
            achievedAt: Date
        },
        first50kg: {
            achieved: { type: Boolean, default: false },
            achievedAt: Date
        },
        first100kg: {
            achieved: { type: Boolean, default: false },
            achievedAt: Date
        },
        first10Pickups: {
            achieved: { type: Boolean, default: false },
            achievedAt: Date
        },
        first50Pickups: {
            achieved: { type: Boolean, default: false },
            achievedAt: Date
        },
        weekStreak: {
            achieved: { type: Boolean, default: false },
            achievedAt: Date
        },
        monthStreak: {
            achieved: { type: Boolean, default: false },
            achievedAt: Date
        },
        ecoWarrior: { // 500kg recycled
            achieved: { type: Boolean, default: false },
            achievedAt: Date
        },
        carbonSaver: { // 100kg CO2 saved
            achieved: { type: Boolean, default: false },
            achievedAt: Date
        }
    },
    // Rankings
    localRanking: {
        position: { type: Number, default: null },
        outOf: { type: Number, default: null },
        area: { type: String, default: null }
    },
    globalRanking: {
        position: { type: Number, default: null },
        outOf: { type: Number, default: null }
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
impactDashboardSchema.index({ citizenId: 1 }, { unique: true });
impactDashboardSchema.index({ totalWasteRecycled: -1 });
impactDashboardSchema.index({ co2Saved: -1 });
impactDashboardSchema.index({ ecoPointsEarned: -1 });

// Method to update dashboard with new waste log
impactDashboardSchema.methods.updateWithWasteLog = async function(wasteLog, pointsEarned, co2Saved) {
    // Update core metrics
    this.totalWasteRecycled += wasteLog.weight;
    this.co2Saved += co2Saved;
    this.ecoPointsEarned += pointsEarned;
    
    // Update streak
    this.updateStreak();
    
    // Update waste breakdown
    this.updateWasteBreakdown(wasteLog.material, wasteLog.weight, pointsEarned);
    
    // Update monthly trends
    this.updateMonthlyTrends(wasteLog.weight, pointsEarned, co2Saved);
    
    // Check and award milestones
    await this.checkMilestones();
    
    return this.save();
};

// Method to update dashboard with completed pickup
impactDashboardSchema.methods.updateWithPickup = async function() {
    this.pickupsCompleted += 1;
    
    // Update monthly trends
    const currentMonth = new Date().toISOString().substring(0, 7);
    let monthlyTrend = this.monthlyTrends.find(t => t.month === currentMonth);
    
    if (!monthlyTrend) {
        monthlyTrend = { month: currentMonth, weight: 0, points: 0, co2Saved: 0, pickupsCompleted: 0 };
        this.monthlyTrends.push(monthlyTrend);
    }
    
    monthlyTrend.pickupsCompleted += 1;
    
    // Keep only last 12 months
    this.monthlyTrends = this.monthlyTrends
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 12);
    
    // Check milestones
    await this.checkMilestones();
    
    return this.save();
};

// Method to update streak
impactDashboardSchema.methods.updateStreak = function() {
    const today = new Date();
    const todayStr = today.toISOString().substring(0, 10);
    
    if (!this.lastActivityDate) {
        // First activity
        this.currentStreak = 1;
        this.longestStreak = 1;
        this.lastActivityDate = today;
        return;
    }
    
    const lastActivityStr = this.lastActivityDate.toISOString().substring(0, 10);
    const daysDiff = Math.floor((today - this.lastActivityDate) / (1000 * 60 * 60 * 24));
    
    if (lastActivityStr === todayStr) {
        // Same day, no change to streak
        return;
    } else if (daysDiff === 1) {
        // Consecutive day
        this.currentStreak += 1;
        if (this.currentStreak > this.longestStreak) {
            this.longestStreak = this.currentStreak;
        }
    } else if (daysDiff > 1) {
        // Streak broken
        this.currentStreak = 1;
    }
    
    this.lastActivityDate = today;
};

// Method to calculate streak from historical data
impactDashboardSchema.methods.calculateStreakFromHistory = function(wasteLogs) {
    if (!wasteLogs || wasteLogs.length === 0) {
        this.currentStreak = 0;
        this.longestStreak = 0;
        this.lastActivityDate = null;
        return;
    }
    
    // Sort logs by date
    const sortedLogs = wasteLogs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    let currentStreak = 0;
    let longestStreak = 0;
    let lastDate = null;
    
    for (const log of sortedLogs) {
        const logDate = new Date(log.createdAt);
        const logDateStr = logDate.toISOString().substring(0, 10);
        
        if (!lastDate) {
            currentStreak = 1;
            lastDate = logDateStr;
        } else {
            const daysDiff = Math.floor((logDate - new Date(lastDate + 'T00:00:00Z')) / (1000 * 60 * 60 * 24));
            
            if (logDateStr === lastDate) {
                // Same day, no change to streak
                continue;
            } else if (daysDiff === 1) {
                // Consecutive day
                currentStreak += 1;
            } else if (daysDiff > 1) {
                // Streak broken
                if (currentStreak > longestStreak) {
                    longestStreak = currentStreak;
                }
                currentStreak = 1;
            }
            
            lastDate = logDateStr;
        }
        
        if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
        }
    }
    
    // Check if current streak is still active (within last 2 days)
    const today = new Date();
    const lastActivityDate = new Date(lastDate + 'T00:00:00Z');
    const daysSinceLastActivity = Math.floor((today - lastActivityDate) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastActivity > 1) {
        currentStreak = 0;
    }
    
    this.currentStreak = currentStreak;
    this.longestStreak = longestStreak;
    this.lastActivityDate = lastActivityDate;
};

// Method to update waste breakdown
impactDashboardSchema.methods.updateWasteBreakdown = function(wasteType, weight, points) {
    let breakdown = this.wasteBreakdown.find(b => b.type === wasteType);
    
    if (!breakdown) {
        breakdown = { type: wasteType, weight: 0, percentage: 0, pointsEarned: 0 };
        this.wasteBreakdown.push(breakdown);
    }
    
    breakdown.weight += weight;
    breakdown.pointsEarned += points;
    
    // Recalculate percentages
    const totalWeight = this.totalWasteRecycled;
    this.wasteBreakdown.forEach(b => {
        b.percentage = totalWeight > 0 ? Math.round((b.weight / totalWeight) * 100 * 100) / 100 : 0;
    });
};

// Method to update monthly trends
impactDashboardSchema.methods.updateMonthlyTrends = function(weight, points, co2Saved) {
    const currentMonth = new Date().toISOString().substring(0, 7);
    let monthlyTrend = this.monthlyTrends.find(t => t.month === currentMonth);
    
    if (!monthlyTrend) {
        monthlyTrend = { month: currentMonth, weight: 0, points: 0, co2Saved: 0, pickupsCompleted: 0 };
        this.monthlyTrends.push(monthlyTrend);
    }
    
    monthlyTrend.weight += weight;
    monthlyTrend.points += points;
    monthlyTrend.co2Saved += co2Saved;
    
    // Keep only last 12 months
    this.monthlyTrends = this.monthlyTrends
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 12);
};

// Method to check and award milestones
impactDashboardSchema.methods.checkMilestones = async function() {
    const newAchievements = [];
    
    // First waste logged
    if (!this.milestones.firstWasteLogged.achieved && this.totalWasteRecycled > 0) {
        this.milestones.firstWasteLogged.achieved = true;
        this.milestones.firstWasteLogged.achievedAt = new Date();
        newAchievements.push({
            name: 'First Steps',
            description: 'Logged your first waste item',
            icon: '🌱',
            rarity: 'common'
        });
    }
    
    // Weight milestones
    if (!this.milestones.first10kg.achieved && this.totalWasteRecycled >= 10) {
        this.milestones.first10kg.achieved = true;
        this.milestones.first10kg.achievedAt = new Date();
        newAchievements.push({
            name: 'Getting Started',
            description: 'Recycled 10kg of waste',
            icon: '📦',
            rarity: 'common'
        });
    }
    
    if (!this.milestones.first50kg.achieved && this.totalWasteRecycled >= 50) {
        this.milestones.first50kg.achieved = true;
        this.milestones.first50kg.achievedAt = new Date();
        newAchievements.push({
            name: 'Eco Enthusiast',
            description: 'Recycled 50kg of waste',
            icon: '♻️',
            rarity: 'rare'
        });
    }
    
    if (!this.milestones.first100kg.achieved && this.totalWasteRecycled >= 100) {
        this.milestones.first100kg.achieved = true;
        this.milestones.first100kg.achievedAt = new Date();
        newAchievements.push({
            name: 'Recycling Champion',
            description: 'Recycled 100kg of waste',
            icon: '🏆',
            rarity: 'epic'
        });
    }
    
    if (!this.milestones.ecoWarrior.achieved && this.totalWasteRecycled >= 500) {
        this.milestones.ecoWarrior.achieved = true;
        this.milestones.ecoWarrior.achievedAt = new Date();
        newAchievements.push({
            name: 'Eco Warrior',
            description: 'Recycled 500kg of waste',
            icon: '⚔️',
            rarity: 'legendary'
        });
    }
    
    // Pickup milestones
    if (!this.milestones.first10Pickups.achieved && this.pickupsCompleted >= 10) {
        this.milestones.first10Pickups.achieved = true;
        this.milestones.first10Pickups.achievedAt = new Date();
        newAchievements.push({
            name: 'Pickup Pro',
            description: 'Completed 10 pickups',
            icon: '🚚',
            rarity: 'rare'
        });
    }
    
    if (!this.milestones.first50Pickups.achieved && this.pickupsCompleted >= 50) {
        this.milestones.first50Pickups.achieved = true;
        this.milestones.first50Pickups.achievedAt = new Date();
        newAchievements.push({
            name: 'Collection Master',
            description: 'Completed 50 pickups',
            icon: '🎯',
            rarity: 'epic'
        });
    }
    
    // Streak milestones
    if (!this.milestones.weekStreak.achieved && this.currentStreak >= 7) {
        this.milestones.weekStreak.achieved = true;
        this.milestones.weekStreak.achievedAt = new Date();
        newAchievements.push({
            name: 'Week Warrior',
            description: '7-day recycling streak',
            icon: '🔥',
            rarity: 'rare'
        });
    }
    
    if (!this.milestones.monthStreak.achieved && this.currentStreak >= 30) {
        this.milestones.monthStreak.achieved = true;
        this.milestones.monthStreak.achievedAt = new Date();
        newAchievements.push({
            name: 'Consistency King',
            description: '30-day recycling streak',
            icon: '👑',
            rarity: 'legendary'
        });
    }
    
    // CO2 milestones
    if (!this.milestones.carbonSaver.achieved && this.co2Saved >= 100) {
        this.milestones.carbonSaver.achieved = true;
        this.milestones.carbonSaver.achievedAt = new Date();
        newAchievements.push({
            name: 'Carbon Saver',
            description: 'Saved 100kg of CO2',
            icon: '🌍',
            rarity: 'epic'
        });
    }
    
    // Add new achievements
    this.achievements.push(...newAchievements);
    
    return newAchievements;
};

// Static method to get or create dashboard
impactDashboardSchema.statics.getOrCreateDashboard = async function(citizenId) {
    let dashboard = await this.findOne({ citizenId });
    
    if (!dashboard) {
        dashboard = new this({ citizenId });
        await dashboard.save();
    }
    
    return dashboard;
};

// Static method to calculate rankings
impactDashboardSchema.statics.calculateRankings = async function() {
    // Global rankings by total waste recycled
    const globalRankings = await this.find({})
        .sort({ totalWasteRecycled: -1 })
        .select('citizenId totalWasteRecycled');
    
    // Update global rankings
    for (let i = 0; i < globalRankings.length; i++) {
        await this.findByIdAndUpdate(globalRankings[i]._id, {
            'globalRanking.position': i + 1,
            'globalRanking.outOf': globalRankings.length
        });
    }
    
    console.log(`Updated global rankings for ${globalRankings.length} users`);
};

const ImpactDashboard = mongoose.model('ImpactDashboard', impactDashboardSchema);
export default ImpactDashboard;