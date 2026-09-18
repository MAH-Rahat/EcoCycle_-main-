import mongoose from 'mongoose';

// Leaderboard entry schema
const leaderboardEntrySchema = new mongoose.Schema({
    citizenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    displayName: {
        type: String,
        required: true,
        trim: true
    },
    score: {
        type: Number,
        required: true,
        min: 0
    },
    rank: {
        type: Number,
        required: true,
        min: 1
    },
    badge: {
        type: String,
        trim: true
    },
    // Additional metrics for detailed leaderboards
    metrics: {
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
        co2Saved: {
            type: Number,
            default: 0
        },
        challengesCompleted: {
            type: Number,
            default: 0
        }
    }
}, {
    _id: false
});

const leaderboardSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['global', 'area', 'challenge'],
        required: true
    },
    period: {
        type: String,
        enum: ['weekly', 'monthly', 'all_time'],
        required: true
    },
    // Area filtering for localized leaderboards
    area: {
        zipCode: String,
        city: String,
        coordinates: {
            type: {
                type: String,
                enum: ['Point']
            },
            coordinates: {
                type: [Number] // [longitude, latitude]
            }
        },
        radius: {
            type: Number, // in kilometers
            min: 0
        }
    },
    // Challenge-specific leaderboard
    challengeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Challenge'
    },
    rankings: [leaderboardEntrySchema],
    // Scoring configuration
    scoringMetric: {
        type: String,
        enum: ['points', 'weight', 'co2_saved', 'challenge_progress'],
        default: 'points'
    },
    // Period boundaries
    periodStart: {
        type: Date,
        required: true
    },
    periodEnd: {
        type: Date,
        required: true
    },
    // Metadata
    totalParticipants: {
        type: Number,
        default: 0
    },
    lastCalculated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
leaderboardSchema.index({ type: 1, period: 1 });
leaderboardSchema.index({ 'area.zipCode': 1 });
leaderboardSchema.index({ 'area.coordinates': '2dsphere' });
leaderboardSchema.index({ challengeId: 1 });
leaderboardSchema.index({ periodStart: 1, periodEnd: 1 });
leaderboardSchema.index({ 'rankings.citizenId': 1 });

// Method to add or update a user's ranking
leaderboardSchema.methods.updateUserRanking = function(userId, score, metrics = {}, displayName = 'User') {
    const existingEntryIndex = this.rankings.findIndex(
        entry => entry.citizenId.toString() === userId.toString()
    );
    
    const entryData = {
        citizenId: userId,
        score: score,
        displayName: displayName,
        metrics: metrics
    };
    
    if (existingEntryIndex >= 0) {
        // Update existing entry
        this.rankings[existingEntryIndex] = {
            ...this.rankings[existingEntryIndex].toObject(),
            ...entryData
        };
    } else {
        // Add new entry
        this.rankings.push(entryData);
    }
    
    // Recalculate rankings
    this.recalculateRankings();
    this.lastCalculated = new Date();
    
    return this.save();
};

// Method to recalculate all rankings based on scores
leaderboardSchema.methods.recalculateRankings = function() {
    // Sort by score (descending) and then by updatedAt (ascending for tie-breaking)
    this.rankings.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        return new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0);
    });
    
    // Assign ranks (handle ties)
    let currentRank = 1;
    let previousScore = null;
    let sameScoreCount = 0;
    
    this.rankings.forEach((entry, index) => {
        if (previousScore !== null && entry.score < previousScore) {
            currentRank = index + 1;
            sameScoreCount = 0;
        } else if (previousScore !== null && entry.score === previousScore) {
            sameScoreCount++;
        }
        
        entry.rank = currentRank;
        previousScore = entry.score;
    });
    
    this.totalParticipants = this.rankings.length;
};

// Method to get user's position in leaderboard
leaderboardSchema.methods.getUserPosition = function(userId) {
    const entry = this.rankings.find(
        entry => entry.citizenId.toString() === userId.toString()
    );
    
    return entry ? {
        rank: entry.rank,
        score: entry.score,
        metrics: entry.metrics,
        totalParticipants: this.totalParticipants
    } : null;
};

// Method to get top N users
leaderboardSchema.methods.getTopUsers = function(limit = 10) {
    return this.rankings.slice(0, limit);
};

// Static method to find or create leaderboard
leaderboardSchema.statics.findOrCreate = async function(criteria) {
    let leaderboard = await this.findOne(criteria);
    
    if (!leaderboard) {
        // Set period boundaries based on period type
        const now = new Date();
        let periodStart, periodEnd;
        
        switch (criteria.period) {
            case 'weekly':
                periodStart = new Date(now);
                periodStart.setHours(0, 0, 0, 0);
                periodStart.setDate(periodStart.getDate() - periodStart.getDay());
                
                periodEnd = new Date(periodStart);
                periodEnd.setDate(periodEnd.getDate() + 6);
                periodEnd.setHours(23, 59, 59, 999);
                break;
                
            case 'monthly':
                periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
                periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
                
            case 'all_time':
                periodStart = new Date('2024-01-01'); // Platform launch date
                periodEnd = new Date('2099-12-31');
                break;
        }
        
        // Clean up criteria to avoid GeoJSON issues
        const cleanCriteria = { ...criteria };
        
        // Remove any incomplete coordinates to avoid MongoDB GeoJSON errors
        if (cleanCriteria.area && cleanCriteria.area.coordinates) {
            delete cleanCriteria.area.coordinates;
        }
        
        leaderboard = await this.create({
            ...cleanCriteria,
            periodStart,
            periodEnd,
            rankings: []
        });
    }
    
    return leaderboard;
};

// Static method to get leaderboard with area filtering
leaderboardSchema.statics.getAreaLeaderboard = async function(area, period = 'monthly', limit = 10) {
    const criteria = {
        type: 'area',
        period: period,
        'area.zipCode': area.zipCode
    };
    
    if (area.city) {
        criteria['area.city'] = area.city;
    }
    
    const leaderboard = await this.findOrCreate(criteria);
    await leaderboard.populate('rankings.citizenId', 'profile.firstName profile.lastName profile.preferences.privacy.showInLeaderboard');
    
    // Filter out users who don't want to be shown in leaderboard
    const filteredRankings = leaderboard.rankings.filter(entry => 
        entry.citizenId && 
        entry.citizenId.profile?.preferences?.privacy?.showInLeaderboard !== false
    );
    
    return {
        ...leaderboard.toObject(),
        rankings: filteredRankings.slice(0, limit)
    };
};

// Static method to get global leaderboard
leaderboardSchema.statics.getGlobalLeaderboard = async function(period = 'monthly', limit = 10) {
    const criteria = {
        type: 'global',
        period: period
    };
    
    const leaderboard = await this.findOrCreate(criteria);
    await leaderboard.populate('rankings.citizenId', 'profile.firstName profile.lastName profile.preferences.privacy.showInLeaderboard');
    
    // Filter out users who don't want to be shown in leaderboard
    const filteredRankings = leaderboard.rankings.filter(entry => 
        entry.citizenId && 
        entry.citizenId.profile?.preferences?.privacy?.showInLeaderboard !== false
    );
    
    return {
        ...leaderboard.toObject(),
        rankings: filteredRankings.slice(0, limit)
    };
};

// Static method to get challenge leaderboard
leaderboardSchema.statics.getChallengeLeaderboard = async function(challengeId, limit = 10) {
    const criteria = {
        type: 'challenge',
        period: 'all_time', // Challenge leaderboards are for the challenge duration
        challengeId: challengeId
    };
    
    const leaderboard = await this.findOrCreate(criteria);
    await leaderboard.populate('rankings.citizenId', 'profile.firstName profile.lastName profile.preferences.privacy.showInLeaderboard');
    await leaderboard.populate('challengeId');
    
    // Filter out users who don't want to be shown in leaderboard
    const filteredRankings = leaderboard.rankings.filter(entry => 
        entry.citizenId && 
        entry.citizenId.profile?.preferences?.privacy?.showInLeaderboard !== false
    );
    
    return {
        ...leaderboard.toObject(),
        rankings: filteredRankings.slice(0, limit)
    };
};

// Static method to update user scores across all relevant leaderboards
leaderboardSchema.statics.updateUserScores = async function(userId, scoreData) {
    const user = await mongoose.model('User').findById(userId);
    if (!user) return;
    
    const userAddresses = user.profile?.addresses || [];
    const displayName = `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || user.name || 'Anonymous';
    
    // Update global leaderboards
    for (const period of ['weekly', 'monthly', 'all_time']) {
        const globalLeaderboard = await this.findOrCreate({
            type: 'global',
            period: period
        });
        
        await globalLeaderboard.updateUserRanking(userId, scoreData.points, {
            totalWeight: scoreData.totalWeight || 0,
            totalPickups: scoreData.totalPickups || 0,
            totalPoints: scoreData.points || 0,
            co2Saved: scoreData.co2Saved || 0,
            challengesCompleted: scoreData.challengesCompleted || 0
        }, displayName);
        
        await globalLeaderboard.save();
    }
    
    // Update area leaderboards for each user address
    for (const address of userAddresses) {
        for (const period of ['weekly', 'monthly', 'all_time']) {
            const areaLeaderboard = await this.findOrCreate({
                type: 'area',
                period: period,
                'area.zipCode': address.zipCode
            });
            
            await areaLeaderboard.updateUserRanking(userId, scoreData.points, {
                totalWeight: scoreData.totalWeight || 0,
                totalPickups: scoreData.totalPickups || 0,
                totalPoints: scoreData.points || 0,
                co2Saved: scoreData.co2Saved || 0,
                challengesCompleted: scoreData.challengesCompleted || 0
            }, displayName);
            
            if (!areaLeaderboard.area) {
                areaLeaderboard.area = {};
            }
            areaLeaderboard.area.zipCode = address.zipCode;
            areaLeaderboard.area.city = address.city;
            
            await areaLeaderboard.save();
        }
    }
};

const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);
export default Leaderboard;