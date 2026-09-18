import express from 'express';
import Achievement from '../models/Achievement.js';
import UserAchievement from '../models/UserAchievement.js';
import EcoPointsWallet from '../models/EcoPointsWallet.js';
import GamificationService from '../services/gamificationService.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Get all available achievements
// @route   GET /api/achievements
// @access  Private (Citizens)
router.get('/', protect, authorize('citizen', 'admin'), async (req, res) => {
    try {
        const { category, rarity, isActive = true } = req.query;
        
        let query = {};
        
        if (category) {
            query.category = category;
        }
        
        if (rarity) {
            query.rarity = rarity;
        }
        
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }
        
        const achievements = await Achievement.find(query)
            .sort({ sortOrder: 1, createdAt: 1 })
            .limit(100);
        
        // Get user's progress for each achievement
        const userAchievements = await UserAchievement.find({
            citizenId: req.user.id,
            achievementId: { $in: achievements.map(a => a._id) }
        });
        
        const achievementsWithProgress = achievements.map(achievement => {
            const userAchievement = userAchievements.find(
                ua => ua.achievementId.toString() === achievement._id.toString()
            );
            
            return {
                ...achievement.toObject(),
                userProgress: userAchievement ? {
                    current: userAchievement.progress.current,
                    target: userAchievement.progress.target,
                    percentage: userAchievement.progress.percentage,
                    completed: userAchievement.isCompleted,
                    earnedAt: userAchievement.earnedAt,
                    rewardClaimed: userAchievement.rewardClaimed
                } : {
                    current: 0,
                    target: achievement.criteria.value,
                    percentage: 0,
                    completed: false,
                    earnedAt: null,
                    rewardClaimed: false
                }
            };
        });
        
        res.json({
            success: true,
            data: achievementsWithProgress
        });
    } catch (error) {
        console.error('Error fetching achievements:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch achievements'
        });
    }
});

// @desc    Get achievement by ID
// @route   GET /api/achievements/:id
// @access  Private (Citizens)
router.get('/:id', protect, authorize('citizen', 'admin'), async (req, res) => {
    try {
        const achievement = await Achievement.findById(req.params.id)
            .populate('prerequisites');
        
        if (!achievement) {
            return res.status(404).json({
                success: false,
                message: 'Achievement not found'
            });
        }
        
        // Get user's progress for this achievement
        const userAchievement = await UserAchievement.findOne({
            citizenId: req.user.id,
            achievementId: achievement._id
        });
        
        res.json({
            success: true,
            data: {
                ...achievement.toObject(),
                userProgress: userAchievement ? {
                    current: userAchievement.progress.current,
                    target: userAchievement.progress.target,
                    percentage: userAchievement.progress.percentage,
                    completed: userAchievement.isCompleted,
                    earnedAt: userAchievement.earnedAt,
                    rewardClaimed: userAchievement.rewardClaimed,
                    context: userAchievement.context
                } : {
                    current: 0,
                    target: achievement.criteria.value,
                    percentage: 0,
                    completed: false,
                    earnedAt: null,
                    rewardClaimed: false,
                    context: null
                }
            }
        });
    } catch (error) {
        console.error('Error fetching achievement:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch achievement'
        });
    }
});

// @desc    Get user's achievements
// @route   GET /api/achievements/user/earned
// @access  Private (Citizens)
router.get('/user/earned', protect, authorize('citizen'), async (req, res) => {
    try {
        const { category, rarity, completed } = req.query;
        
        const options = {
            category,
            rarity,
            completed: completed !== undefined ? completed === 'true' : null,
            limit: 100,
            sort: { earnedAt: -1 }
        };
        
        const userAchievements = await UserAchievement.findUserAchievements(
            req.user.id,
            options
        );
        
        res.json({
            success: true,
            data: userAchievements
        });
    } catch (error) {
        console.error('Error fetching user achievements:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user achievements'
        });
    }
});

// @desc    Get user's achievement statistics
// @route   GET /api/achievements/user/stats
// @access  Private (Citizens)
router.get('/user/stats', protect, authorize('citizen'), async (req, res) => {
    try {
        const stats = await UserAchievement.getUserStats(req.user.id);
        
        // Get unclaimed rewards
        const unclaimedRewards = await UserAchievement.findUnclaimedRewards(req.user.id);
        
        res.json({
            success: true,
            data: {
                ...stats,
                unclaimedRewards: unclaimedRewards.length,
                rewards: unclaimedRewards.map(ua => ({
                    achievementId: ua.achievementId._id,
                    achievementName: ua.achievementId.name,
                    points: ua.achievementId.reward.points,
                    badge: ua.achievementId.reward.badge,
                    earnedAt: ua.earnedAt
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching user achievement stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user achievement statistics'
        });
    }
});

// @desc    Claim achievement reward
// @route   POST /api/achievements/:id/claim-reward
// @access  Private (Citizens)
router.post('/:id/claim-reward', protect, authorize('citizen'), async (req, res) => {
    try {
        const userAchievement = await UserAchievement.findOne({
            citizenId: req.user.id,
            achievementId: req.params.id
        }).populate('achievementId');
        
        if (!userAchievement) {
            return res.status(404).json({
                success: false,
                message: 'Achievement not found or not earned'
            });
        }
        
        if (!userAchievement.isCompleted) {
            return res.status(400).json({
                success: false,
                message: 'Achievement not completed yet'
            });
        }
        
        if (userAchievement.rewardClaimed) {
            return res.status(400).json({
                success: false,
                message: 'Reward already claimed'
            });
        }
        
        // Claim the reward
        await userAchievement.claimReward();
        
        // Award EcoPoints
        const achievement = userAchievement.achievementId;
        const wallet = await EcoPointsWallet.findOne({ citizenId: req.user.id });
        
        if (wallet && achievement.reward.points > 0) {
            await wallet.addBonus(
                achievement.reward.points,
                `Achievement reward: ${achievement.name}`,
                achievement._id,
                'achievement'
            );
        }
        
        res.json({
            success: true,
            message: 'Reward claimed successfully',
            data: {
                pointsAwarded: achievement.reward.points,
                badge: achievement.reward.badge
            }
        });
    } catch (error) {
        console.error('Error claiming achievement reward:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to claim reward'
        });
    }
});

// @desc    Get achievement categories
// @route   GET /api/achievements/categories
// @access  Private (Citizens)
router.get('/categories', protect, authorize('citizen', 'admin'), async (req, res) => {
    try {
        const categories = await Achievement.distinct('category', { isActive: true });
        
        // Get count for each category
        const categoryStats = await Achievement.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    totalPoints: { $sum: '$reward.points' },
                    rarityBreakdown: {
                        $push: '$rarity'
                    }
                }
            },
            {
                $project: {
                    category: '$_id',
                    count: 1,
                    totalPoints: 1,
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
        
        res.json({
            success: true,
            data: categoryStats
        });
    } catch (error) {
        console.error('Error fetching achievement categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch achievement categories'
        });
    }
});

// Admin routes

// @desc    Create a new achievement
// @route   POST /api/achievements
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const {
            name,
            description,
            icon,
            rarity,
            category,
            criteria,
            reward,
            prerequisites,
            sortOrder
        } = req.body;
        
        // Validate required fields
        if (!name || !description || !icon || !category || !criteria || !reward) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        // Validate criteria structure
        if (!criteria.type || criteria.value === undefined || criteria.value < 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid criteria configuration'
            });
        }
        
        // Validate reward structure
        if (reward.points === undefined || reward.points < 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reward configuration'
            });
        }
        
        const achievement = await Achievement.create({
            name,
            description,
            icon,
            rarity: rarity || 'common',
            category,
            criteria,
            reward,
            prerequisites: prerequisites || [],
            sortOrder: sortOrder || 0
        });
        
        res.status(201).json({
            success: true,
            message: 'Achievement created successfully',
            data: achievement
        });
    } catch (error) {
        console.error('Error creating achievement:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create achievement'
        });
    }
});

// @desc    Update an achievement
// @route   PUT /api/achievements/:id
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const achievement = await Achievement.findById(req.params.id);
        
        if (!achievement) {
            return res.status(404).json({
                success: false,
                message: 'Achievement not found'
            });
        }
        
        const allowedFields = [
            'name', 'description', 'icon', 'rarity', 'category', 
            'criteria', 'reward', 'isActive', 'prerequisites', 'sortOrder'
        ];
        
        const updates = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });
        
        const updatedAchievement = await Achievement.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );
        
        res.json({
            success: true,
            message: 'Achievement updated successfully',
            data: updatedAchievement
        });
    } catch (error) {
        console.error('Error updating achievement:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update achievement'
        });
    }
});

// @desc    Delete an achievement
// @route   DELETE /api/achievements/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const achievement = await Achievement.findById(req.params.id);
        
        if (!achievement) {
            return res.status(404).json({
                success: false,
                message: 'Achievement not found'
            });
        }
        
        // Check if achievement has been earned by users
        const earnedCount = await UserAchievement.countDocuments({
            achievementId: achievement._id
        });
        
        if (earnedCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete achievement that has been earned by users. Deactivate instead.'
            });
        }
        
        await Achievement.findByIdAndDelete(req.params.id);
        
        res.json({
            success: true,
            message: 'Achievement deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting achievement:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete achievement'
        });
    }
});

// @desc    Initialize default achievements
// @route   POST /api/achievements/admin/initialize-defaults
// @access  Private (Admin)
router.post('/admin/initialize-defaults', protect, authorize('admin'), async (req, res) => {
    try {
        await GamificationService.initializeDefaultAchievements();
        
        res.json({
            success: true,
            message: 'Default achievements initialized successfully'
        });
    } catch (error) {
        console.error('Error initializing default achievements:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initialize default achievements'
        });
    }
});

export default router;