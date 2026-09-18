import UserChallenge from '../models/UserChallenge.js';
import Challenge from '../models/Challenge.js';
import Leaderboard from '../models/Leaderboard.js';
import EcoPointsWallet from '../models/EcoPointsWallet.js';
import User from '../models/User.js';
import ImpactDashboard from '../models/ImpactDashboard.js';

class ChallengeService {
    /**
     * Update user progress for all active challenges based on activity
     * @param {string} userId - User ID
     * @param {Object} activityData - Activity data (waste logged, pickup completed, etc.)
     */
    static async updateUserProgress(userId, activityData) {
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
                    const previousProgress = userChallenge.progress;
                    await userChallenge.updateProgress(activityData);
                    
                    // Check if challenge was just completed
                    if (!userChallenge.completed && userChallenge.progress >= userChallenge.challengeId.target.value) {
                        userChallenge.completed = true;
                        userChallenge.completedAt = new Date();
                        await userChallenge.save();
                        
                        completedChallenges.push(userChallenge);
                        
                        // Update challenge leaderboard
                        await this.updateChallengeLeaderboard(userChallenge.challengeId._id, userId, userChallenge.progress);
                    } else if (userChallenge.progress !== previousProgress) {
                        // Update challenge leaderboard with new progress
                        await this.updateChallengeLeaderboard(userChallenge.challengeId._id, userId, userChallenge.progress);
                    }
                }
            }

            // Handle completed challenges
            for (const completedChallenge of completedChallenges) {
                await this.handleChallengeCompletion(completedChallenge);
            }

            return {
                updatedChallenges: activeUserChallenges.length,
                completedChallenges: completedChallenges.length,
                newCompletions: completedChallenges
            };
        } catch (error) {
            console.error('Error updating user progress:', error);
            throw error;
        }
    }

    /**
     * Handle challenge completion - award points, update leaderboards, send notifications
     * @param {Object} userChallenge - Completed UserChallenge document
     */
    static async handleChallengeCompletion(userChallenge) {
        try {
            await userChallenge.populate('challengeId');
            const challenge = userChallenge.challengeId;
            const userId = userChallenge.citizenId;

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
                }
            }

            // Update user's impact dashboard with challenge completion
            const impactDashboard = await ImpactDashboard.findOne({ citizenId: userId });
            if (impactDashboard) {
                // Add achievement if badge is awarded
                if (challenge.reward.badge) {
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

            // Update global and area leaderboards with challenge completion
            const user = await User.findById(userId);
            if (user) {
                const scoreData = {
                    points: (await EcoPointsWallet.findOne({ citizenId: userId }))?.balance || 0,
                    challengesCompleted: (await UserChallenge.countDocuments({ 
                        citizenId: userId, 
                        completed: true 
                    })) || 0
                };

                await Leaderboard.updateUserScores(userId, scoreData);
            }

            return {
                pointsAwarded: challenge.reward.points,
                badge: challenge.reward.badge,
                challengeTitle: challenge.title
            };
        } catch (error) {
            console.error('Error handling challenge completion:', error);
            throw error;
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
            const displayName = `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || 
                              user.name || 'Anonymous';

            await leaderboard.updateUserRanking(userId, score, {
                totalPoints: score,
                challengeProgress: score
            });

            // Set display name
            const userEntry = leaderboard.rankings.find(
                entry => entry.citizenId.toString() === userId.toString()
            );
            if (userEntry) {
                userEntry.displayName = displayName;
            }

            await leaderboard.save();
        } catch (error) {
            console.error('Error updating challenge leaderboard:', error);
            throw error;
        }
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

            return { enrolled: enrolledCount };
        } catch (error) {
            console.error('Error auto-enrolling users:', error);
            throw error;
        }
    }

    /**
     * Create weekly challenges automatically
     */
    static async createWeeklyChallenges() {
        try {
            const weeklyTemplates = [
                {
                    title: 'Weekly Recycling Champion',
                    description: 'Recycle 10kg of waste this week',
                    target: { metric: 'weight', value: 10 },
                    reward: { points: 100, badge: 'Weekly Champion' }
                },
                {
                    title: 'Pickup Hero',
                    description: 'Complete 5 pickups this week',
                    target: { metric: 'pickups', value: 5 },
                    reward: { points: 150, badge: 'Pickup Hero' }
                },
                {
                    title: 'Plastic Warrior',
                    description: 'Recycle 5kg of plastic this week',
                    target: { metric: 'weight', value: 5, wasteTypes: ['plastic'] },
                    reward: { points: 120, badge: 'Plastic Warrior' }
                }
            ];

            const createdChallenges = [];

            for (const template of weeklyTemplates) {
                const challenge = await Challenge.createWeeklyChallenge(template);
                createdChallenges.push(challenge);

                // Auto-enroll eligible users
                await this.autoEnrollEligibleUsers(challenge._id);
            }

            return createdChallenges;
        } catch (error) {
            console.error('Error creating weekly challenges:', error);
            throw error;
        }
    }

    /**
     * Create monthly challenges automatically
     */
    static async createMonthlyChallenges() {
        try {
            const monthlyTemplates = [
                {
                    title: 'Monthly Eco Champion',
                    description: 'Recycle 50kg of waste this month',
                    target: { metric: 'weight', value: 50 },
                    reward: { points: 500, badge: 'Eco Champion' }
                },
                {
                    title: 'Consistency Master',
                    description: 'Maintain a 7-day recycling streak',
                    target: { metric: 'streak', value: 7 },
                    reward: { points: 300, badge: 'Consistency Master' }
                },
                {
                    title: 'Point Collector',
                    description: 'Earn 1000 EcoPoints this month',
                    target: { metric: 'points', value: 1000 },
                    reward: { points: 200, badge: 'Point Collector' }
                }
            ];

            const createdChallenges = [];

            for (const template of monthlyTemplates) {
                const challenge = await Challenge.createMonthlyChallenge(template);
                createdChallenges.push(challenge);

                // Auto-enroll eligible users
                await this.autoEnrollEligibleUsers(challenge._id);
            }

            return createdChallenges;
        } catch (error) {
            console.error('Error creating monthly challenges:', error);
            throw error;
        }
    }

    /**
     * Get challenge rarity based on difficulty and reward
     * @param {Object} challenge - Challenge document
     * @returns {string} Rarity level
     */
    static getChallengeRarity(challenge) {
        const points = challenge.reward.points;
        
        if (points >= 500) return 'legendary';
        if (points >= 300) return 'epic';
        if (points >= 150) return 'rare';
        return 'common';
    }

    /**
     * Clean up expired challenges and user challenge records
     */
    static async cleanupExpiredChallenges() {
        try {
            const now = new Date();
            
            // Deactivate expired challenges
            await Challenge.updateMany(
                { 
                    endDate: { $lt: now },
                    isActive: true
                },
                { 
                    isActive: false 
                }
            );

            // Remove user challenge records for challenges that ended more than 30 days ago
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            
            const expiredChallenges = await Challenge.find({
                endDate: { $lt: thirtyDaysAgo }
            }).select('_id');

            const expiredChallengeIds = expiredChallenges.map(c => c._id);

            if (expiredChallengeIds.length > 0) {
                await UserChallenge.deleteMany({
                    challengeId: { $in: expiredChallengeIds },
                    completed: false
                });

                // Also clean up old leaderboards
                await Leaderboard.deleteMany({
                    type: 'challenge',
                    challengeId: { $in: expiredChallengeIds }
                });
            }

            return {
                deactivatedChallenges: expiredChallenges.length,
                cleanedUserChallenges: expiredChallengeIds.length
            };
        } catch (error) {
            console.error('Error cleaning up expired challenges:', error);
            throw error;
        }
    }
}

export default ChallengeService;