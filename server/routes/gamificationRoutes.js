import express from 'express';
import GamificationService from '../services/gamificationService.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Get user's complete gamification summary
// @route   GET /api/gamification/summary
// @access  Private (Citizens)
router.get('/summary', protect, authorize('citizen'), async (req, res) => {
    try {
        const summary = await GamificationService.getUserGamificationSummary(req.user.id);
        
        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Error fetching gamification summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch gamification summary'
        });
    }
});

// @desc    Get user's leaderboard positions
// @route   GET /api/gamification/leaderboard-positions
// @access  Private (Citizens)
router.get('/leaderboard-positions', protect, authorize('citizen'), async (req, res) => {
    try {
        const positions = await GamificationService.getUserLeaderboardPositions(req.user.id);
        
        res.json({
            success: true,
            data: positions
        });
    } catch (error) {
        console.error('Error fetching leaderboard positions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leaderboard positions'
        });
    }
});

// @desc    Process user activity for gamification
// @route   POST /api/gamification/process-activity
// @access  Private (Citizens, Collectors)
router.post('/process-activity', protect, authorize('citizen', 'collector'), async (req, res) => {
    try {
        const { activityType, activityData } = req.body;
        
        if (!activityType || !activityData) {
            return res.status(400).json({
                success: false,
                message: 'Activity type and data are required'
            });
        }
        
        // Only allow users to process their own activities
        const userId = req.user.role === 'citizen' ? req.user.id : activityData.citizenId;
        
        if (req.user.role === 'citizen' && userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Cannot process activity for another user'
            });
        }
        
        const results = await GamificationService.processUserActivity(userId, {
            type: activityType,
            ...activityData
        });
        
        res.json({
            success: true,
            message: 'Activity processed successfully',
            data: results
        });
    } catch (error) {
        console.error('Error processing user activity:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process user activity'
        });
    }
});

// @desc    Update user privacy settings for leaderboards
// @route   PUT /api/gamification/privacy
// @access  Private (Citizens)
router.put('/privacy', protect, authorize('citizen'), async (req, res) => {
    try {
        const { showInLeaderboard, showFullName } = req.body;
        
        const User = (await import('../models/User.js')).default;
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Update privacy preferences
        if (!user.profile.preferences) {
            user.profile.preferences = {};
        }
        if (!user.profile.preferences.privacy) {
            user.profile.preferences.privacy = {};
        }
        
        if (showInLeaderboard !== undefined) {
            user.profile.preferences.privacy.showInLeaderboard = showInLeaderboard;
        }
        
        if (showFullName !== undefined) {
            user.profile.preferences.privacy.showFullName = showFullName;
        }
        
        await user.save();
        
        // Update leaderboards based on new privacy settings
        if (showInLeaderboard === false) {
            // Remove user from all leaderboards
            await GamificationService.removeUserFromLeaderboards(req.user.id);
        } else if (showInLeaderboard === true) {
            // Re-add user to leaderboards
            await GamificationService.updateUserLeaderboards(req.user.id);
        } else if (showFullName !== undefined) {
            // Update display name in leaderboards
            await GamificationService.updateUserLeaderboards(req.user.id);
        }
        
        res.json({
            success: true,
            message: 'Privacy settings updated successfully',
            data: {
                showInLeaderboard: user.profile.preferences.privacy.showInLeaderboard,
                showFullName: user.profile.preferences.privacy.showFullName
            }
        });
    } catch (error) {
        console.error('Error updating privacy settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update privacy settings'
        });
    }
});

// Admin routes

// @desc    Process activity for any user (admin only)
// @route   POST /api/gamification/admin/process-activity/:userId
// @access  Private (Admin)
router.post('/admin/process-activity/:userId', protect, authorize('admin'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { activityType, activityData } = req.body;
        
        if (!activityType || !activityData) {
            return res.status(400).json({
                success: false,
                message: 'Activity type and data are required'
            });
        }
        
        const results = await GamificationService.processUserActivity(userId, {
            type: activityType,
            ...activityData
        });
        
        res.json({
            success: true,
            message: 'Activity processed successfully',
            data: results
        });
    } catch (error) {
        console.error('Error processing user activity (admin):', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process user activity'
        });
    }
});

// @desc    Update all user leaderboards
// @route   POST /api/gamification/admin/update-leaderboards
// @access  Private (Admin)
router.post('/admin/update-leaderboards', protect, authorize('admin'), async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (userId) {
            // Update specific user
            await GamificationService.updateUserLeaderboards(userId);
            res.json({
                success: true,
                message: `Leaderboards updated for user ${userId}`
            });
        } else {
            // Update all users (this could be resource intensive)
            const User = (await import('../models/User.js')).default;
            const users = await User.find({ role: 'citizen', isActive: true }).select('_id');
            
            let updatedCount = 0;
            for (const user of users) {
                try {
                    await GamificationService.updateUserLeaderboards(user._id);
                    updatedCount++;
                } catch (error) {
                    console.error(`Error updating leaderboards for user ${user._id}:`, error);
                }
            }
            
            res.json({
                success: true,
                message: `Leaderboards updated for ${updatedCount} users`
            });
        }
    } catch (error) {
        console.error('Error updating leaderboards:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update leaderboards'
        });
    }
});

// @desc    Initialize gamification system
// @route   POST /api/gamification/admin/initialize
// @access  Private (Admin)
router.post('/admin/initialize', protect, authorize('admin'), async (req, res) => {
    try {
        await GamificationService.initializeDefaultAchievements();
        
        res.json({
            success: true,
            message: 'Gamification system initialized successfully'
        });
    } catch (error) {
        console.error('Error initializing gamification system:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initialize gamification system'
        });
    }
});

// @desc    Get gamification system statistics
// @route   GET /api/gamification/admin/stats
// @access  Private (Admin)
router.get('/admin/stats', protect, authorize('admin'), async (req, res) => {
    try {
        const Achievement = (await import('../models/Achievement.js')).default;
        const UserAchievement = (await import('../models/UserAchievement.js')).default;
        const Challenge = (await import('../models/Challenge.js')).default;
        const UserChallenge = (await import('../models/UserChallenge.js')).default;
        const Leaderboard = (await import('../models/Leaderboard.js')).default;
        
        const [
            achievementStats,
            challengeStats,
            leaderboardStats,
            userEngagementStats
        ] = await Promise.all([
            // Achievement statistics
            Achievement.aggregate([
                {
                    $group: {
                        _id: null,
                        totalAchievements: { $sum: 1 },
                        activeAchievements: { $sum: { $cond: ['$isActive', 1, 0] } },
                        totalPointsAvailable: { $sum: '$reward.points' },
                        categoryBreakdown: { $push: '$category' },
                        rarityBreakdown: { $push: '$rarity' }
                    }
                }
            ]),
            
            // Challenge statistics
            Challenge.aggregate([
                {
                    $group: {
                        _id: null,
                        totalChallenges: { $sum: 1 },
                        activeChallenges: { $sum: { $cond: ['$isActive', 1, 0] } },
                        totalParticipants: { $sum: { $size: '$participants' } },
                        typeBreakdown: { $push: '$type' }
                    }
                }
            ]),
            
            // Leaderboard statistics
            Leaderboard.aggregate([
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 },
                        totalParticipants: { $sum: '$totalParticipants' },
                        avgParticipants: { $avg: '$totalParticipants' }
                    }
                }
            ]),
            
            // User engagement statistics
            UserAchievement.aggregate([
                {
                    $group: {
                        _id: null,
                        totalUserAchievements: { $sum: 1 },
                        completedAchievements: {
                            $sum: { $cond: [{ $gte: ['$progress.current', '$progress.target'] }, 1, 0] }
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
                        }
                    }
                }
            ])
        ]);
        
        res.json({
            success: true,
            data: {
                achievements: achievementStats[0] || {},
                challenges: challengeStats[0] || {},
                leaderboards: leaderboardStats,
                userEngagement: userEngagementStats[0] || {}
            }
        });
    } catch (error) {
        console.error('Error fetching gamification stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch gamification statistics'
        });
    }
});

export default router;