import Achievement from '../models/Achievement.js';
import UserAchievement from '../models/UserAchievement.js';
import Challenge from '../models/Challenge.js';
import UserChallenge from '../models/UserChallenge.js';
import Leaderboard from '../models/Leaderboard.js';
import EcoPointsWallet from '../models/EcoPointsWallet.js';
import ImpactDashboard from '../models/ImpactDashboard.js';
import User from '../models/User.js';

class GamificationService {
    /**
     * Process user activity and update all gamification elements
     * @param {string} userId - User ID
     * @param {Object} activityData - Activity data
     */
    static async processUserActivity(userId, activityData) {
        try {
            const results = {
                challengesUpdated: 0,
                challengesCompleted: [],
                achievementsEarned: [],
                leaderboardsUpdated: [],
                pointsAwarded: 0
            };

            // Update challenge progress
            const challengeResults = await this.updateChallengeProgress(userId, activityData);
            results.challengesUpdated = challengeResults.updatedChallenges;
            results.challengesCompleted = challengeResults.newCompletions;

            // Check and award achievements
            const achievementResults = await this.checkAndAwardAchievements(userId, activityData);
            results.achievementsEarned = achievementResults.newAchievements;

            // Update leaderboards
            await this.updateUserLeaderboards(userId);
            results.leaderboardsUpdated = ['global', 'area'];

            // Calculate total points awarded
            results.pointsAwarded = challengeResults.newCompletions.reduce(
                (sum, completion) => sum + completion.pointsAwarded, 0
            ) + achievementResults.newAchievements.reduce(
                (sum, achievement) => sum + (achievement.reward?.points || 0), 0
            );

            return results;
        } catch (error) {
            console.error('Error processing user activity:', error);
            throw error;
        }
    }

    /**
     * Update challenge progress for user
     * @param {string} userId - User ID
     * @param {Object} activityData - Activity data
     */
    static async updateChallengeProgress(userId, activityData) {
        try {
            // Get all active challenges the user is participating in
            const activeUserChallenges = await UserChallenge.find({
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

            const completedChallenges = [];

            // Update progress for each active challenge
            for (const userChallenge of activeUserChallenges) {
                if (userChallenge.challengeId) {
                    const previousCompleted = userChallenge.completed;
                    await userChallenge.updateProgress(activityData);
                    
                    // Check if challenge was just completed
                    if (!previousCompleted && userChallenge.completed) {
                        const completionResult = await this.handleChallengeCompletion(userChallenge);
                        completedChallenges.push(completionResult);
                        
                        // Update challenge leaderboard
                        await this.updateChallengeLeaderboard(
                            userChallenge.challengeId._id, 
                            userId, 
                            userChallenge.progress
                        );
                    } else if (userChallenge.progress !== userChallenge.progress) {
                        // Update challenge leaderboard with new progress
                        await this.updateChallengeLeaderboard(
                            userChallenge.challengeId._id, 
                            userId, 
                            userChallenge.progress
                        );
                    }
                }
            }

            return {
                updatedChallenges: activeUserChallenges.length,
                newCompletions: completedChallenges
            };
        } catch (error) {
            console.error('Error updating challenge progress:', error);
            throw error;
        }
    }

    /**
     * Handle challenge completion - award points, update achievements, send notifications
     * @param {Object} userChallenge - Completed UserChallenge document
     */
    static async handleChallengeCompletion(userChallenge) {
        try {
            await userChallenge.populate('challengeId');
            const challenge = userChallenge.challengeId;
            const userId = userChallenge.citizenId;

            let pointsAwarded = 0;

            // Award bonus EcoPoints for challenge completion
            if (challenge.reward.points > 0) {
                const wallet = await EcoPointsWallet.findOne({ citizenId: userId });
                if (wallet) {
                    await wallet.addBonus(
                        challenge.reward.points,
                        `Challenge completed: ${challenge.title}`,
                        challenge._id,
                        'challenge'
                    );
                    pointsAwarded = challenge.reward.points;
                }
            }

            // Add achievement if badge is awarded
            if (challenge.reward.badge) {
                const impactDashboard = await ImpactDashboard.findOne({ citizenId: userId });
                if (impactDashboard) {
                    const achievement = {
                        name: challenge.reward.badge,
                        description: `Completed challenge: ${challenge.title}`,
                        icon: 'trophy',
                        unlockedAt: new Date(),
                        rarity: this.getChallengeRarity(challenge)
                    };
                    impactDashboard.achievements.push(achievement);
                    await impactDashboard.save();
                }
            }

            // Update global and area leaderboards
            await this.updateUserLeaderboards(userId);

            return {
                challengeId: challenge._id,
                challengeTitle: challenge.title,
                pointsAwarded: pointsAwarded,
                badge: challenge.reward.badge
            };
        } catch (error) {
            console.error('Error handling challenge completion:', error);
            throw error;
        }
    }

    /**
     * Check and award achievements based on user activity
     * @param {string} userId - User ID
     * @param {Object} activityData - Activity data
     */
    static async checkAndAwardAchievements(userId, activityData) {
        try {
            // Get user's current stats
            const userStats = await this.getUserStats(userId);
            
            // Find achievements user can earn
            const earnableAchievements = await Achievement.findEarnableForUser(userId, userStats);
            
            const newAchievements = [];

            for (const achievement of earnableAchievements) {
                // Create user achievement record
                const context = {
                    triggerType: activityData.type || 'manual',
                    triggerData: activityData
                };

                const currentValue = this.calculateAchievementProgress(achievement, userStats);
                
                const result = await UserAchievement.createOrUpdateProgress(
                    userId,
                    achievement._id,
                    currentValue,
                    context
                );

                if (result.justCompleted) {
                    // Award achievement points
                    if (achievement.reward.points > 0) {
                        const wallet = await EcoPointsWallet.findOne({ citizenId: userId });
                        if (wallet) {
                            await wallet.addBonus(
                                achievement.reward.points,
                                `Achievement unlocked: ${achievement.name}`,
                                achievement._id,
                                'achievement'
                            );
                        }
                    }

                    newAchievements.push({
                        achievement: achievement,
                        userAchievement: result.userAchievement,
                        reward: achievement.reward
                    });
                }
            }

            return { newAchievements };
        } catch (error) {
            console.error('Error checking achievements:', error);
            throw error;
        }
    }

    /**
     * Calculate current progress for an achievement
     * @param {Object} achievement - Achievement document
     * @param {Object} userStats - User statistics
     */
    static calculateAchievementProgress(achievement, userStats) {
        const { type, wasteTypes } = achievement.criteria;
        
        switch (type) {
            case 'weight':
                if (wasteTypes && wasteTypes.length > 0) {
                    return userStats.wasteBreakdown
                        ?.filter(wb => wasteTypes.includes(wb.type.toLowerCase()))
                        ?.reduce((sum, wb) => sum + wb.weight, 0) || 0;
                }
                return userStats.totalWasteRecycled || 0;
                
            case 'pickups':
                return userStats.pickupsCompleted || 0;
                
            case 'points':
                return userStats.ecoPointsEarned || 0;
                
            case 'streak':
                return userStats.longestStreak || 0;
                
            case 'challenge_completion':
                return userStats.challengesCompleted || 0;
                
            default:
                return 0;
        }
    }

    /**
     * Get comprehensive user statistics for gamification
     * @param {string} userId - User ID
     */
    static async getUserStats(userId) {
        try {
            const [impactDashboard, wallet, challengeStats] = await Promise.all([
                ImpactDashboard.findOne({ citizenId: userId }),
                EcoPointsWallet.findOne({ citizenId: userId }),
                UserChallenge.getUserStats(userId)
            ]);

            return {
                totalWasteRecycled: impactDashboard?.totalWasteRecycled || 0,
                co2Saved: impactDashboard?.co2Saved || 0,
                ecoPointsEarned: wallet?.totalEarned || 0,
                pickupsCompleted: impactDashboard?.pickupsCompleted || 0,
                currentStreak: impactDashboard?.currentStreak || 0,
                longestStreak: impactDashboard?.longestStreak || 0,
                wasteBreakdown: impactDashboard?.wasteBreakdown || [],
                challengesCompleted: challengeStats?.completedChallenges || 0
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            return {};
        }
    }

    /**
     * Update challenge-specific leaderboard
     * @param {string} challengeId - Challenge ID
     * @param {string} userId - User ID
     * @param {number} score - User's current progress/score
     */
    static async updateChallengeLeaderboard(challengeId, userId, score) {
        try {
            const leaderboard = await Leaderboard.findOrCreate({
                type: 'challenge',
                period: 'all_time',
                challengeId: challengeId
            });

            const user = await User.findById(userId);
            
            // Check privacy settings
            if (user.profile?.preferences?.privacy?.showInLeaderboard === false) {
                return; // User opted out of leaderboards
            }

            const displayName = this.getPrivacyCompliantDisplayName(user);

            await leaderboard.updateUserRanking(userId, score, {
                totalPoints: score,
                challengeProgress: score
            }, displayName);

            await leaderboard.save();
        } catch (error) {
            console.error('Error updating challenge leaderboard:', error);
            throw error;
        }
    }

    /**
     * Update user scores across all relevant leaderboards with privacy protection
     * @param {string} userId - User ID
     */
    static async updateUserLeaderboards(userId) {
        try {
            const user = await User.findById(userId);
            
            // Check if user opted out of leaderboards
            if (user.profile?.preferences?.privacy?.showInLeaderboard === false) {
                // Remove user from all leaderboards
                await this.removeUserFromLeaderboards(userId);
                return;
            }

            const userStats = await this.getUserStats(userId);
            const userAddresses = user.profile?.addresses || [];
            
            const scoreData = {
                points: userStats.ecoPointsEarned || 0,
                totalWeight: userStats.totalWasteRecycled || 0,
                totalPickups: userStats.pickupsCompleted || 0,
                co2Saved: userStats.co2Saved || 0,
                challengesCompleted: userStats.challengesCompleted || 0
            };

            // Only update leaderboards if user has some activity
            if (scoreData.points > 0 || scoreData.totalWeight > 0 || scoreData.totalPickups > 0) {

            // Update global leaderboards
            for (const period of ['weekly', 'monthly', 'all_time']) {
                const globalLeaderboard = await Leaderboard.findOrCreate({
                    type: 'global',
                    period: period
                });
                
                const displayName = this.getPrivacyCompliantDisplayName(user);
                
                await globalLeaderboard.updateUserRanking(userId, scoreData.points, scoreData, displayName);
                
                await globalLeaderboard.save();
            }

            // Update area leaderboards for each user address
            for (const address of userAddresses) {
                for (const period of ['weekly', 'monthly', 'all_time']) {
                    const areaLeaderboard = await Leaderboard.findOrCreate({
                        type: 'area',
                        period: period,
                        'area.zipCode': address.zipCode
                    });
                    
                    const displayName = this.getPrivacyCompliantDisplayName(user);
                    
                    await areaLeaderboard.updateUserRanking(userId, scoreData.points, scoreData, displayName);
                    
                    if (!areaLeaderboard.area) {
                        areaLeaderboard.area = {};
                    }
                    areaLeaderboard.area.zipCode = address.zipCode;
                    areaLeaderboard.area.city = address.city;
                    
                    await areaLeaderboard.save();
                }
            }
            }
        } catch (error) {
            console.error('Error updating user leaderboards:', error);
            throw error;
        }
    }

    /**
     * Remove user from all leaderboards (privacy protection)
     * @param {string} userId - User ID
     */
    static async removeUserFromLeaderboards(userId) {
        try {
            await Leaderboard.updateMany(
                { 'rankings.citizenId': userId },
                { $pull: { rankings: { citizenId: userId } } }
            );
            
            // Recalculate rankings for affected leaderboards
            const affectedLeaderboards = await Leaderboard.find({
                'rankings.citizenId': { $ne: userId }
            });
            
            for (const leaderboard of affectedLeaderboards) {
                leaderboard.recalculateRankings();
                await leaderboard.save();
            }
        } catch (error) {
            console.error('Error removing user from leaderboards:', error);
            throw error;
        }
    }

    /**
     * Get privacy-compliant display name for leaderboards
     * @param {Object} user - User document
     */
    static getPrivacyCompliantDisplayName(user) {
        // Check privacy preferences
        const showFullName = user.profile?.preferences?.privacy?.showFullName !== false;
        
        if (showFullName) {
            const firstName = user.profile?.firstName || '';
            const lastName = user.profile?.lastName || '';
            return `${firstName} ${lastName}`.trim() || user.name || 'Anonymous';
        } else {
            // Show only first name and last initial
            const firstName = user.profile?.firstName || '';
            const lastInitial = user.profile?.lastName ? user.profile.lastName.charAt(0) + '.' : '';
            return `${firstName} ${lastInitial}`.trim() || 'Anonymous';
        }
    }

    /**
     * Get challenge rarity based on difficulty and reward
     * @param {Object} challenge - Challenge document
     */
    static getChallengeRarity(challenge) {
        const points = challenge.reward.points;
        
        if (points >= 500) return 'legendary';
        if (points >= 300) return 'epic';
        if (points >= 150) return 'rare';
        return 'common';
    }

    /**
     * Auto-enroll users in new challenges based on their location and preferences
     * @param {string} challengeId - Challenge ID
     */
    static async autoEnrollEligibleUsers(challengeId) {
        try {
            const challenge = await Challenge.findById(challengeId);
            if (!challenge || !challenge.isActive) {
                return { enrolled: 0 };
            }

            let eligibleUsers = [];

            if (challenge.area && challenge.area.zipCode) {
                // Find users in the challenge area
                eligibleUsers = await User.find({
                    role: 'citizen',
                    'profile.addresses.zipCode': challenge.area.zipCode,
                    isActive: true
                });
            } else {
                // Global challenge - get all active citizens
                eligibleUsers = await User.find({
                    role: 'citizen',
                    isActive: true
                }).limit(1000); // Limit to prevent overwhelming the system
            }

            let enrolledCount = 0;

            for (const user of eligibleUsers) {
                // Check if user can participate and isn't already enrolled
                if (challenge.canUserParticipate(user)) {
                    const existingUserChallenge = await UserChallenge.findOne({
                        citizenId: user._id,
                        challengeId: challengeId
                    });

                    if (!existingUserChallenge) {
                        // Auto-enroll user
                        if (!challenge.participants.includes(user._id)) {
                            challenge.participants.push(user._id);
                        }
                        
                        await UserChallenge.create({
                            citizenId: user._id,
                            challengeId: challengeId,
                            progress: 0,
                            progressDetails: {
                                totalWeight: 0,
                                totalPickups: 0,
                                totalPoints: 0,
                                currentStreak: 0,
                                wasteTypeBreakdown: []
                            }
                        });
                        enrolledCount++;
                    }
                }
            }

            await challenge.save();
            return { enrolled: enrolledCount };
        } catch (error) {
            console.error('Error auto-enrolling users:', error);
            throw error;
        }
    }

    /**
     * Initialize default achievements for the system
     */
    static async initializeDefaultAchievements() {
        try {
            await Achievement.createDefaultAchievements();
            console.log('Default achievements initialized successfully');
        } catch (error) {
            console.error('Error initializing default achievements:', error);
            throw error;
        }
    }

    /**
     * Get user's gamification summary
     * @param {string} userId - User ID
     */
    static async getUserGamificationSummary(userId) {
        try {
            const [userStats, achievementStats, challengeStats, leaderboardPositions] = await Promise.all([
                this.getUserStats(userId),
                UserAchievement.getUserStats(userId),
                UserChallenge.getUserStats(userId),
                this.getUserLeaderboardPositions(userId)
            ]);

            return {
                stats: userStats,
                achievements: achievementStats,
                challenges: challengeStats,
                leaderboards: leaderboardPositions
            };
        } catch (error) {
            console.error('Error getting user gamification summary:', error);
            throw error;
        }
    }

    /**
     * Get user's positions across all leaderboards
     * @param {string} userId - User ID
     */
    static async getUserLeaderboardPositions(userId) {
        try {
            const user = await User.findById(userId);
            const userAddresses = user.profile?.addresses || [];
            
            const positions = {
                global: {},
                area: {},
                challenges: []
            };
            
            // Get global positions
            for (const period of ['weekly', 'monthly', 'all_time']) {
                const globalLeaderboard = await Leaderboard.findOne({
                    type: 'global',
                    period: period
                });
                
                if (globalLeaderboard) {
                    const position = globalLeaderboard.getUserPosition(userId);
                    positions.global[period] = position;
                }
            }
            
            // Get area positions for each user address
            for (const address of userAddresses) {
                const areaPositions = {};
                
                for (const period of ['weekly', 'monthly', 'all_time']) {
                    const areaLeaderboard = await Leaderboard.findOne({
                        type: 'area',
                        period: period,
                        'area.zipCode': address.zipCode
                    });
                    
                    if (areaLeaderboard) {
                        const position = areaLeaderboard.getUserPosition(userId);
                        areaPositions[period] = position;
                    }
                }
                
                positions.area[address.zipCode] = {
                    city: address.city,
                    positions: areaPositions
                };
            }
            
            // Get challenge positions for active challenges user is participating in
            const activeUserChallenges = await UserChallenge.find({
                citizenId: userId
            }).populate({
                path: 'challengeId',
                match: { 
                    isActive: true,
                    startDate: { $lte: new Date() },
                    endDate: { $gte: new Date() }
                }
            });
            
            for (const userChallenge of activeUserChallenges) {
                if (userChallenge.challengeId) {
                    const challengeLeaderboard = await Leaderboard.findOne({
                        type: 'challenge',
                        challengeId: userChallenge.challengeId._id
                    });
                    
                    if (challengeLeaderboard) {
                        const position = challengeLeaderboard.getUserPosition(userId);
                        positions.challenges.push({
                            challengeId: userChallenge.challengeId._id,
                            challengeTitle: userChallenge.challengeId.title,
                            position: position
                        });
                    }
                }
            }
            
            return positions;
        } catch (error) {
            console.error('Error getting user leaderboard positions:', error);
            return { global: {}, area: {}, challenges: [] };
        }
    }
}

export default GamificationService;