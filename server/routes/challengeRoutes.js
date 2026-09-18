import express from 'express';
import Challenge from '../models/Challenge.js';
import UserChallenge from '../models/UserChallenge.js';
import User from '../models/User.js';
import EcoPointsWallet from '../models/EcoPointsWallet.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Get all active challenges
// @route   GET /api/challenges
// @access  Private (Citizens)
router.get('/', protect, authorize('citizen', 'admin'), async (req, res) => {
    try {
        const { type, area } = req.query;
        const user = await User.findById(req.user.id);
        
        let query = {
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        };
        
        // Filter by challenge type if specified
        if (type && ['weekly', 'monthly', 'special'].includes(type)) {
            query.type = type;
        }
        
        // Filter by area if specified
        if (area) {
            query.$or = [
                { 'area.zipCode': { $exists: false } }, // Global challenges
                { 'area.zipCode': null },
                { 'area.zipCode': area }
            ];
        } else if (user.profile?.addresses?.length > 0) {
            // Include challenges for user's areas
            const userZipCodes = user.profile.addresses.map(addr => addr.zipCode);
            query.$or = [
                { 'area.zipCode': { $exists: false } }, // Global challenges
                { 'area.zipCode': null },
                { 'area.zipCode': { $in: userZipCodes } }
            ];
        }
        
        const challenges = await Challenge.find(query)
            .sort({ createdAt: -1 })
            .limit(20);
        
        // Get user's participation status for each challenge
        const challengeIds = challenges.map(c => c._id);
        const userChallenges = await UserChallenge.find({
            citizenId: req.user.id,
            challengeId: { $in: challengeIds }
        });
        
        const challengesWithProgress = challenges.map(challenge => {
            const userChallenge = userChallenges.find(
                uc => uc.challengeId.toString() === challenge._id.toString()
            );
            
            return {
                ...challenge.toObject(),
                userProgress: userChallenge ? {
                    progress: userChallenge.progress,
                    completed: userChallenge.completed,
                    completionPercentage: Math.min(100, (userChallenge.progress / challenge.target.value) * 100),
                    rewardClaimed: userChallenge.rewardClaimed
                } : null,
                canParticipate: challenge.canUserParticipate(user)
            };
        });
        
        res.json({
            success: true,
            data: challengesWithProgress
        });
    } catch (error) {
        console.error('Error fetching challenges:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch challenges'
        });
    }
});

// @desc    Get challenge by ID
// @route   GET /api/challenges/:id
// @access  Private (Citizens)
router.get('/:id', protect, authorize('citizen', 'admin'), async (req, res) => {
    try {
        const challenge = await Challenge.findById(req.params.id);
        
        if (!challenge) {
            return res.status(404).json({
                success: false,
                message: 'Challenge not found'
            });
        }
        
        // Get user's participation status
        const userChallenge = await UserChallenge.findOne({
            citizenId: req.user.id,
            challengeId: challenge._id
        });
        
        const user = await User.findById(req.user.id);
        
        res.json({
            success: true,
            data: {
                ...challenge.toObject(),
                userProgress: userChallenge ? {
                    progress: userChallenge.progress,
                    completed: userChallenge.completed,
                    completionPercentage: Math.min(100, (userChallenge.progress / challenge.target.value) * 100),
                    rewardClaimed: userChallenge.rewardClaimed,
                    progressDetails: userChallenge.progressDetails
                } : null,
                canParticipate: challenge.canUserParticipate(user)
            }
        });
    } catch (error) {
        console.error('Error fetching challenge:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch challenge'
        });
    }
});

// @desc    Join a challenge
// @route   POST /api/challenges/:id/join
// @access  Private (Citizens)
router.post('/:id/join', protect, authorize('citizen'), async (req, res) => {
    try {
        const challenge = await Challenge.findById(req.params.id);
        
        if (!challenge) {
            return res.status(404).json({
                success: false,
                message: 'Challenge not found'
            });
        }
        
        const user = await User.findById(req.user.id);
        
        if (!challenge.canUserParticipate(user)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot participate in this challenge'
            });
        }
        
        // Check if user is already participating
        const existingUserChallenge = await UserChallenge.findOne({
            citizenId: req.user.id,
            challengeId: challenge._id
        });
        
        if (existingUserChallenge) {
            return res.status(400).json({
                success: false,
                message: 'You are already participating in this challenge'
            });
        }
        
        // Add user to challenge participants
        if (!challenge.participants.includes(req.user.id)) {
            challenge.participants.push(req.user.id);
            await challenge.save();
        }
        
        // Create user challenge record
        const userChallenge = await UserChallenge.create({
            citizenId: req.user.id,
            challengeId: challenge._id,
            progress: 0,
            progressDetails: {
                totalWeight: 0,
                totalPickups: 0,
                totalPoints: 0,
                currentStreak: 0,
                wasteTypeBreakdown: []
            }
        });
        
        res.json({
            success: true,
            message: 'Successfully joined challenge',
            data: userChallenge
        });
    } catch (error) {
        console.error('Error joining challenge:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to join challenge'
        });
    }
});

// @desc    Claim challenge reward
// @route   POST /api/challenges/:id/claim-reward
// @access  Private (Citizens)
router.post('/:id/claim-reward', protect, authorize('citizen'), async (req, res) => {
    try {
        const userChallenge = await UserChallenge.findOne({
            citizenId: req.user.id,
            challengeId: req.params.id
        }).populate('challengeId');
        
        if (!userChallenge) {
            return res.status(404).json({
                success: false,
                message: 'Challenge participation not found'
            });
        }
        
        if (!userChallenge.completed) {
            return res.status(400).json({
                success: false,
                message: 'Challenge not completed yet'
            });
        }
        
        if (userChallenge.rewardClaimed) {
            return res.status(400).json({
                success: false,
                message: 'Reward already claimed'
            });
        }
        
        // Claim the reward
        await userChallenge.claimReward();
        
        // Award EcoPoints
        const challenge = userChallenge.challengeId;
        const wallet = await EcoPointsWallet.findOne({ citizenId: req.user.id });
        
        if (wallet && challenge.reward.points > 0) {
            await wallet.addBonus(
                challenge.reward.points,
                `Challenge reward: ${challenge.title}`,
                challenge._id,
                'challenge'
            );
        }
        
        res.json({
            success: true,
            message: 'Reward claimed successfully',
            data: {
                pointsAwarded: challenge.reward.points,
                badge: challenge.reward.badge
            }
        });
    } catch (error) {
        console.error('Error claiming reward:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to claim reward'
        });
    }
});

// @desc    Get user's challenge statistics
// @route   GET /api/challenges/user/stats
// @access  Private (Citizens)
router.get('/user/stats', protect, authorize('citizen'), async (req, res) => {
    try {
        const stats = await UserChallenge.getUserStats(req.user.id);
        
        // Get unclaimed rewards
        const unclaimedRewards = await UserChallenge.findUnclaimedRewards(req.user.id);
        
        res.json({
            success: true,
            data: {
                ...stats,
                unclaimedRewards: unclaimedRewards.length,
                rewards: unclaimedRewards.map(uc => ({
                    challengeId: uc.challengeId._id,
                    challengeTitle: uc.challengeId.title,
                    points: uc.challengeId.reward.points,
                    badge: uc.challengeId.reward.badge,
                    completedAt: uc.completedAt
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user statistics'
        });
    }
});

// Admin routes

// @desc    Create a new challenge
// @route   POST /api/challenges
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const {
            title,
            description,
            type,
            target,
            reward,
            startDate,
            endDate,
            area
        } = req.body;
        
        // Validate required fields
        if (!title || !description || !type || !target || !reward) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        // Validate target structure
        if (!target.metric || target.value === undefined || target.value <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid target configuration'
            });
        }
        
        // Validate reward structure
        if (reward.points === undefined || reward.points < 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reward configuration'
            });
        }
        
        const challengeData = {
            title,
            description,
            type,
            target,
            reward,
            area: area || undefined
        };
        
        let challenge;
        
        if (type === 'weekly' && !startDate && !endDate) {
            challenge = await Challenge.createWeeklyChallenge(challengeData);
        } else if (type === 'monthly' && !startDate && !endDate) {
            challenge = await Challenge.createMonthlyChallenge(challengeData);
        } else {
            // Custom date range
            if (!startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Start date and end date are required for custom challenges'
                });
            }
            
            challenge = await Challenge.create({
                ...challengeData,
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            });
        }
        
        res.status(201).json({
            success: true,
            message: 'Challenge created successfully',
            data: challenge
        });
    } catch (error) {
        console.error('Error creating challenge:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create challenge'
        });
    }
});

// @desc    Update a challenge
// @route   PUT /api/challenges/:id
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const challenge = await Challenge.findById(req.params.id);
        
        if (!challenge) {
            return res.status(404).json({
                success: false,
                message: 'Challenge not found'
            });
        }
        
        // Only allow updates to non-started challenges or specific fields for active challenges
        const now = new Date();
        const isActive = challenge.startDate <= now && challenge.endDate >= now;
        
        const allowedFields = isActive 
            ? ['description', 'isActive'] // Limited updates for active challenges
            : Object.keys(req.body); // Full updates for future challenges
        
        const updates = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });
        
        const updatedChallenge = await Challenge.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );
        
        res.json({
            success: true,
            message: 'Challenge updated successfully',
            data: updatedChallenge
        });
    } catch (error) {
        console.error('Error updating challenge:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update challenge'
        });
    }
});

// @desc    Delete a challenge
// @route   DELETE /api/challenges/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const challenge = await Challenge.findById(req.params.id);
        
        if (!challenge) {
            return res.status(404).json({
                success: false,
                message: 'Challenge not found'
            });
        }
        
        // Check if challenge has participants
        const participantCount = await UserChallenge.countDocuments({
            challengeId: challenge._id
        });
        
        if (participantCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete challenge with participants. Deactivate instead.'
            });
        }
        
        await Challenge.findByIdAndDelete(req.params.id);
        
        res.json({
            success: true,
            message: 'Challenge deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting challenge:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete challenge'
        });
    }
});

export default router;