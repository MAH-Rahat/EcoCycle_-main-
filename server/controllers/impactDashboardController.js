import ImpactDashboard from '../models/ImpactDashboard.js';
import Waste from '../models/Waste.js';
import Pickup from '../models/Pickup.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';
import socketService from '../services/socketService.js';

// Get user's impact dashboard
export const getImpactDashboard = async (req, res) => {
    try {
        const citizenId = req.user.id;
        
        const dashboard = await ImpactDashboard.getOrCreateDashboard(citizenId);
        
        // Calculate some additional metrics
        const totalUsers = await ImpactDashboard.countDocuments();
        const betterThanCount = await ImpactDashboard.countDocuments({
            totalWasteRecycled: { $lt: dashboard.totalWasteRecycled }
        });
        
        const percentile = totalUsers > 0 ? Math.round((betterThanCount / totalUsers) * 100) : 0;
        
        // Get recent achievements (last 5)
        const recentAchievements = dashboard.achievements
            .sort((a, b) => b.unlockedAt - a.unlockedAt)
            .slice(0, 5);
        
        // Calculate environmental impact equivalents
        const environmentalImpact = {
            treesEquivalent: Math.round(dashboard.co2Saved / 22), // 1 tree absorbs ~22kg CO2/year
            carsOffRoad: Math.round(dashboard.co2Saved / 4600), // Average car emits ~4.6 tons CO2/year
            energySaved: Math.round(dashboard.co2Saved * 2.2), // Rough conversion to kWh
            plasticBottlesSaved: Math.round(dashboard.totalWasteRecycled * 50) // Estimate based on average bottle weight
        };
        
        res.json({
            success: true,
            data: {
                dashboard,
                stats: {
                    percentile,
                    totalUsers,
                    environmentalImpact
                },
                recentAchievements
            }
        });
    } catch (error) {
        console.error('Get impact dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve impact dashboard',
            error: error.message
        });
    }
};

// Refresh dashboard data (recalculate from waste logs and pickups)
export const refreshDashboard = async (req, res) => {
    try {
        const citizenId = req.user.id;
        
        // Get or create dashboard
        let dashboard = await ImpactDashboard.getOrCreateDashboard(citizenId);
        
        // Reset dashboard data
        dashboard.totalWasteRecycled = 0;
        dashboard.co2Saved = 0;
        dashboard.ecoPointsEarned = 0;
        dashboard.pickupsCompleted = 0;
        dashboard.wasteBreakdown = [];
        dashboard.monthlyTrends = [];
        dashboard.currentStreak = 0;
        dashboard.longestStreak = 0;
        dashboard.lastActivityDate = null;
        
        // Recalculate from waste logs
        const wasteLogs = await Waste.find({ 
            citizen: citizenId, 
            status: { $in: ['Accepted', 'Collected'] }
        }).sort({ createdAt: 1 });
        
        for (const wasteLog of wasteLogs) {
            try {
                const pointsEarned = await WasteTypeConfig.calculatePoints(wasteLog.material, wasteLog.weight);
                const co2Saved = await WasteTypeConfig.calculateCO2Savings(wasteLog.material, wasteLog.weight);
                
                // Update dashboard metrics
                dashboard.totalWasteRecycled += wasteLog.weight;
                dashboard.co2Saved += co2Saved;
                dashboard.ecoPointsEarned += pointsEarned;
                
                // Update waste breakdown
                dashboard.updateWasteBreakdown(wasteLog.material, wasteLog.weight, pointsEarned);
                
                // Update monthly trends
                dashboard.updateMonthlyTrends(wasteLog.weight, pointsEarned, co2Saved);
                
                // Update streak based on creation date
                const activityDate = new Date(wasteLog.createdAt);
                if (!dashboard.lastActivityDate || activityDate > dashboard.lastActivityDate) {
                    dashboard.lastActivityDate = activityDate;
                }
            } catch (error) {
                console.warn(`Error processing waste log ${wasteLog._id}:`, error.message);
            }
        }
        
        // Recalculate streak properly
        dashboard.calculateStreakFromHistory(wasteLogs);
        
        // Recalculate from completed pickups
        const completedPickups = await Pickup.countDocuments({
            citizen: citizenId,
            status: 'Completed'
        });
        
        dashboard.pickupsCompleted = completedPickups;
        
        // Check milestones
        await dashboard.checkMilestones();
        
        // Save updated dashboard
        await dashboard.save();
        
        res.json({
            success: true,
            message: 'Dashboard refreshed successfully',
            data: dashboard
        });
    } catch (error) {
        console.error('Refresh dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh dashboard',
            error: error.message
        });
    }
};

// Get leaderboard
export const getLeaderboard = async (req, res) => {
    try {
        const { type = 'waste', period = 'all_time', limit = 50 } = req.query;
        
        let sortField = 'totalWasteRecycled';
        let matchCondition = {};
        
        switch (type) {
            case 'points':
                sortField = 'ecoPointsEarned';
                break;
            case 'co2':
                sortField = 'co2Saved';
                break;
            case 'pickups':
                sortField = 'pickupsCompleted';
                break;
            case 'streak':
                sortField = 'longestStreak';
                break;
            default:
                sortField = 'totalWasteRecycled';
        }
        
        // For period filtering, we'd need to implement date-based filtering
        // This is a simplified version showing all-time leaders
        
        const leaderboard = await ImpactDashboard.find(matchCondition)
            .populate('citizenId', 'name email')
            .sort({ [sortField]: -1 })
            .limit(parseInt(limit))
            .select(`citizenId ${sortField} totalWasteRecycled co2Saved ecoPointsEarned pickupsCompleted longestStreak`);
        
        // Add ranking positions
        const leaderboardWithRanks = leaderboard.map((entry, index) => ({
            rank: index + 1,
            citizen: {
                name: entry.citizenId.name,
                email: entry.citizenId.email
            },
            value: entry[sortField],
            totalWasteRecycled: entry.totalWasteRecycled,
            co2Saved: entry.co2Saved,
            ecoPointsEarned: entry.ecoPointsEarned,
            pickupsCompleted: entry.pickupsCompleted,
            longestStreak: entry.longestStreak
        }));
        
        // Find current user's position
        const currentUserDashboard = await ImpactDashboard.findOne({ citizenId: req.user.id });
        let currentUserRank = null;
        
        if (currentUserDashboard) {
            const betterCount = await ImpactDashboard.countDocuments({
                [sortField]: { $gt: currentUserDashboard[sortField] }
            });
            currentUserRank = {
                rank: betterCount + 1,
                value: currentUserDashboard[sortField]
            };
        }
        
        res.json({
            success: true,
            data: {
                leaderboard: leaderboardWithRanks,
                currentUser: currentUserRank,
                type,
                period
            }
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve leaderboard',
            error: error.message
        });
    }
};

// Get achievements
export const getAchievements = async (req, res) => {
    try {
        const citizenId = req.user.id;
        
        const dashboard = await ImpactDashboard.getOrCreateDashboard(citizenId);
        
        // Sort achievements by rarity and date
        const rarityOrder = { 'legendary': 4, 'epic': 3, 'rare': 2, 'common': 1 };
        const sortedAchievements = dashboard.achievements.sort((a, b) => {
            if (rarityOrder[a.rarity] !== rarityOrder[b.rarity]) {
                return rarityOrder[b.rarity] - rarityOrder[a.rarity];
            }
            return b.unlockedAt - a.unlockedAt;
        });
        
        // Get milestone progress
        const milestoneProgress = {
            weight: {
                current: dashboard.totalWasteRecycled,
                milestones: [
                    { target: 10, achieved: dashboard.milestones.first10kg.achieved, name: 'Getting Started' },
                    { target: 50, achieved: dashboard.milestones.first50kg.achieved, name: 'Eco Enthusiast' },
                    { target: 100, achieved: dashboard.milestones.first100kg.achieved, name: 'Recycling Champion' },
                    { target: 500, achieved: dashboard.milestones.ecoWarrior.achieved, name: 'Eco Warrior' }
                ]
            },
            pickups: {
                current: dashboard.pickupsCompleted,
                milestones: [
                    { target: 10, achieved: dashboard.milestones.first10Pickups.achieved, name: 'Pickup Pro' },
                    { target: 50, achieved: dashboard.milestones.first50Pickups.achieved, name: 'Collection Master' }
                ]
            },
            streak: {
                current: dashboard.longestStreak,
                milestones: [
                    { target: 7, achieved: dashboard.milestones.weekStreak.achieved, name: 'Week Warrior' },
                    { target: 30, achieved: dashboard.milestones.monthStreak.achieved, name: 'Consistency King' }
                ]
            },
            co2: {
                current: dashboard.co2Saved,
                milestones: [
                    { target: 100, achieved: dashboard.milestones.carbonSaver.achieved, name: 'Carbon Saver' }
                ]
            }
        };
        
        res.json({
            success: true,
            data: {
                achievements: sortedAchievements,
                milestoneProgress,
                totalAchievements: sortedAchievements.length
            }
        });
    } catch (error) {
        console.error('Get achievements error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve achievements',
            error: error.message
        });
    }
};

// Update dashboard when waste is logged (internal function)
export const updateDashboardForWasteLog = async (citizenId, wasteLog, pointsEarned, co2Saved) => {
    try {
        const dashboard = await ImpactDashboard.getOrCreateDashboard(citizenId);
        const newAchievements = await dashboard.updateWithWasteLog(wasteLog, pointsEarned, co2Saved);
        
        // Emit real-time dashboard update
        socketService.emitDashboardUpdate(citizenId.toString(), dashboard);
        
        // Send notifications for new achievements
        if (newAchievements.length > 0) {
            for (const achievement of newAchievements) {
                socketService.sendNotification(citizenId.toString(), {
                    type: 'achievement_unlocked',
                    title: 'Achievement Unlocked!',
                    message: `You earned "${achievement.name}": ${achievement.description}`,
                    data: {
                        achievement,
                        totalAchievements: dashboard.achievements.length
                    }
                });
                
                // Also emit specific achievement event
                socketService.emitAchievementUnlocked(citizenId.toString(), achievement);
                
                // Check if this is a milestone achievement and emit milestone event
                const milestoneNames = [
                    'First Steps', 'Getting Started', 'Eco Enthusiast', 'Recycling Champion', 
                    'Eco Warrior', 'Pickup Pro', 'Collection Master', 'Week Warrior', 
                    'Consistency King', 'Carbon Saver'
                ];
                
                if (milestoneNames.includes(achievement.name)) {
                    socketService.emitMilestoneReached(citizenId.toString(), {
                        name: achievement.name,
                        description: achievement.description,
                        icon: achievement.icon,
                        rarity: achievement.rarity,
                        type: getMilestoneType(achievement.name),
                        value: getMilestoneValue(achievement.name, dashboard)
                    });
                }
            }
        }
        
        return dashboard;
    } catch (error) {
        console.error('Update dashboard for waste log error:', error);
        throw error;
    }
};

// Helper function to get milestone type
const getMilestoneType = (achievementName) => {
    const milestoneTypes = {
        'First Steps': 'first_waste',
        'Getting Started': 'weight',
        'Eco Enthusiast': 'weight',
        'Recycling Champion': 'weight',
        'Eco Warrior': 'weight',
        'Pickup Pro': 'pickups',
        'Collection Master': 'pickups',
        'Week Warrior': 'streak',
        'Consistency King': 'streak',
        'Carbon Saver': 'co2'
    };
    return milestoneTypes[achievementName] || 'general';
};

// Helper function to get milestone value
const getMilestoneValue = (achievementName, dashboard) => {
    const milestoneValues = {
        'First Steps': dashboard.totalWasteRecycled,
        'Getting Started': 10,
        'Eco Enthusiast': 50,
        'Recycling Champion': 100,
        'Eco Warrior': 500,
        'Pickup Pro': 10,
        'Collection Master': 50,
        'Week Warrior': 7,
        'Consistency King': 30,
        'Carbon Saver': 100
    };
    return milestoneValues[achievementName] || 0;
};

// Helper function to get milestone bonus points
const getMilestoneBonusPoints = (achievementName) => {
    const bonusPoints = {
        'First Steps': 25,
        'Getting Started': 50,
        'Eco Enthusiast': 100,
        'Recycling Champion': 200,
        'Eco Warrior': 500,
        'Pickup Pro': 100,
        'Collection Master': 250,
        'Week Warrior': 75,
        'Consistency King': 300,
        'Carbon Saver': 200
    };
    return bonusPoints[achievementName] || 0;
};

// Update dashboard when pickup is completed (internal function)
export const updateDashboardForPickup = async (citizenId, pickup) => {
    try {
        const dashboard = await ImpactDashboard.getOrCreateDashboard(citizenId);
        const newAchievements = await dashboard.updateWithPickup(pickup);
        
        // Emit real-time dashboard update
        socketService.emitDashboardUpdate(citizenId.toString(), dashboard);
        
        // Send notifications for new achievements
        if (newAchievements.length > 0) {
            for (const achievement of newAchievements) {
                socketService.sendNotification(citizenId.toString(), {
                    type: 'achievement_unlocked',
                    title: 'Achievement Unlocked!',
                    message: `You earned "${achievement.name}": ${achievement.description}`,
                    data: {
                        achievement,
                        totalAchievements: dashboard.achievements.length
                    }
                });
                
                // Also emit specific achievement event
                socketService.emitAchievementUnlocked(citizenId.toString(), achievement);
                
                // Check if this is a milestone achievement and emit milestone event
                const milestoneNames = [
                    'First Steps', 'Getting Started', 'Eco Enthusiast', 'Recycling Champion', 
                    'Eco Warrior', 'Pickup Pro', 'Collection Master', 'Week Warrior', 
                    'Consistency King', 'Carbon Saver'
                ];
                
                if (milestoneNames.includes(achievement.name)) {
                    socketService.emitMilestoneReached(citizenId.toString(), {
                        name: achievement.name,
                        description: achievement.description,
                        icon: achievement.icon,
                        rarity: achievement.rarity,
                        type: getMilestoneType(achievement.name),
                        value: getMilestoneValue(achievement.name, dashboard)
                    });
                }
            }
        }
        
        return dashboard;
    } catch (error) {
        console.error('Update dashboard for pickup error:', error);
        throw error;
    }
};

// Get system-wide impact statistics (admin function)
export const getSystemImpactStats = async (req, res) => {
    try {
        const totalStats = await ImpactDashboard.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    totalWasteRecycled: { $sum: '$totalWasteRecycled' },
                    totalCO2Saved: { $sum: '$co2Saved' },
                    totalEcoPoints: { $sum: '$ecoPointsEarned' },
                    totalPickups: { $sum: '$pickupsCompleted' },
                    totalAchievements: { $sum: { $size: '$achievements' } }
                }
            }
        ]);
        
        const stats = totalStats[0] || {
            totalUsers: 0,
            totalWasteRecycled: 0,
            totalCO2Saved: 0,
            totalEcoPoints: 0,
            totalPickups: 0,
            totalAchievements: 0
        };
        
        // Calculate environmental impact
        const environmentalImpact = {
            treesEquivalent: Math.round(stats.totalCO2Saved / 22),
            carsOffRoad: Math.round(stats.totalCO2Saved / 4600),
            energySaved: Math.round(stats.totalCO2Saved * 2.2),
            plasticBottlesSaved: Math.round(stats.totalWasteRecycled * 50)
        };
        
        res.json({
            success: true,
            data: {
                ...stats,
                environmentalImpact
            }
        });
    } catch (error) {
        console.error('Get system impact stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve system impact statistics',
            error: error.message
        });
    }
};