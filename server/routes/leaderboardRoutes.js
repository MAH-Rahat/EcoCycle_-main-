import express from 'express';
import Leaderboard from '../models/Leaderboard.js';
import User from '../models/User.js';
import Challenge from '../models/Challenge.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Get global leaderboard
// @route   GET /api/leaderboard/global
// @access  Private (Citizens)
router.get('/global', protect, authorize('citizen', 'admin'), async (req, res) => {
    try {
        const { period = 'monthly', limit = 10 } = req.query;
        
        if (!['weekly', 'monthly', 'all_time'].includes(period)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid period. Must be weekly, monthly, or all_time'
            });
        }
        
        const leaderboard = await Leaderboard.getGlobalLeaderboard(period, parseInt(limit));
        
        // Get current user's position if they're on the leaderboard
        const userPosition = leaderboard.rankings.find(
            entry => entry.citizenId && entry.citizenId._id.toString() === req.user.id
        );
        
        res.json({
            success: true,
            data: {
                type: 'global',
                period: period,
                rankings: leaderboard.rankings.map(entry => ({
                    rank: entry.rank,
                    displayName: entry.displayName,
                    score: entry.score,
                    metrics: entry.metrics,
                    badge: entry.badge,
                    isCurrentUser: entry.citizenId && entry.citizenId._id.toString() === req.user.id
                })),
                totalParticipants: leaderboard.totalParticipants,
                userPosition: userPosition ? {
                    rank: userPosition.rank,
                    score: userPosition.score,
                    metrics: userPosition.metrics
                } : null,
                lastUpdated: leaderboard.lastCalculated
            }
        });
    } catch (error) {
        console.error('Error fetching global leaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch global leaderboard'
        });
    }
});

// @desc    Get area leaderboard
// @route   GET /api/leaderboard/area
// @access  Private (Citizens)
router.get('/area', protect, authorize('citizen', 'admin'), async (req, res) => {
    try {
        const { zipCode, city, period = 'monthly', limit = 10 } = req.query;
        
        if (!zipCode && !city) {
            // Use user's primary address
            const user = await User.findById(req.user.id);
            const defaultAddress = user.profile?.addresses?.find(addr => addr.isDefault) || 
                                 user.profile?.addresses?.[0];
            
            if (!defaultAddress) {
                return res.status(400).json({
                    success: false,
                    message: 'No area specified and no user address found'
                });
            }
            
            const area = {
                zipCode: defaultAddress.zipCode,
                city: defaultAddress.city
            };
            
            const leaderboard = await Leaderboard.getAreaLeaderboard(area, period, parseInt(limit));
            
            return res.json({
                success: true,
                data: {
                    type: 'area',
                    period: period,
                    area: area,
                    rankings: leaderboard.rankings.map(entry => ({
                        rank: entry.rank,
                        displayName: entry.displayName,
                        score: entry.score,
                        metrics: entry.metrics,
                        badge: entry.badge,
                        isCurrentUser: entry.citizenId && entry.citizenId._id.toString() === req.user.id
                    })),
                    totalParticipants: leaderboard.totalParticipants,
                    lastUpdated: leaderboard.lastCalculated
                }
            });
        }
        
        if (!['weekly', 'monthly', 'all_time'].includes(period)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid period. Must be weekly, monthly, or all_time'
            });
        }
        
        const area = { zipCode, city };
        const leaderboard = await Leaderboard.getAreaLeaderboard(area, period, parseInt(limit));
        
        // Get current user's position if they're on the leaderboard
        const userPosition = leaderboard.rankings.find(
            entry => entry.citizenId && entry.citizenId._id.toString() === req.user.id
        );
        
        res.json({
            success: true,
            data: {
                type: 'area',
                period: period,
                area: area,
                rankings: leaderboard.rankings.map(entry => ({
                    rank: entry.rank,
                    displayName: entry.displayName,
                    score: entry.score,
                    metrics: entry.metrics,
                    badge: entry.badge,
                    isCurrentUser: entry.citizenId && entry.citizenId._id.toString() === req.user.id
                })),
                totalParticipants: leaderboard.totalParticipants,
                userPosition: userPosition ? {
                    rank: userPosition.rank,
                    score: userPosition.score,
                    metrics: userPosition.metrics
                } : null,
                lastUpdated: leaderboard.lastCalculated
            }
        });
    } catch (error) {
        console.error('Error fetching area leaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch area leaderboard'
        });
    }
});

// @desc    Get challenge leaderboard
// @route   GET /api/leaderboard/challenge/:challengeId
// @access  Private (Citizens)
router.get('/challenge/:challengeId', protect, authorize('citizen', 'admin'), async (req, res) => {
    try {
        const { challengeId } = req.params;
        const { limit = 10 } = req.query;
        
        // Verify challenge exists
        const challenge = await Challenge.findById(challengeId);
        if (!challenge) {
            return res.status(404).json({
                success: false,
                message: 'Challenge not found'
            });
        }
        
        const leaderboard = await Leaderboard.getChallengeLeaderboard(challengeId, parseInt(limit));
        
        // Get current user's position if they're on the leaderboard
        const userPosition = leaderboard.rankings.find(
            entry => entry.citizenId && entry.citizenId._id.toString() === req.user.id
        );
        
        res.json({
            success: true,
            data: {
                type: 'challenge',
                challenge: {
                    id: challenge._id,
                    title: challenge.title,
                    description: challenge.description,
                    target: challenge.target,
                    reward: challenge.reward,
                    startDate: challenge.startDate,
                    endDate: challenge.endDate
                },
                rankings: leaderboard.rankings.map(entry => ({
                    rank: entry.rank,
                    displayName: entry.displayName,
                    score: entry.score,
                    metrics: entry.metrics,
                    badge: entry.badge,
                    isCurrentUser: entry.citizenId && entry.citizenId._id.toString() === req.user.id
                })),
                totalParticipants: leaderboard.totalParticipants,
                userPosition: userPosition ? {
                    rank: userPosition.rank,
                    score: userPosition.score,
                    metrics: userPosition.metrics
                } : null,
                lastUpdated: leaderboard.lastCalculated
            }
        });
    } catch (error) {
        console.error('Error fetching challenge leaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch challenge leaderboard'
        });
    }
});

// @desc    Get user's leaderboard positions across all boards
// @route   GET /api/leaderboard/user/positions
// @access  Private (Citizens)
router.get('/user/positions', protect, authorize('citizen'), async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
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
                const position = globalLeaderboard.getUserPosition(req.user.id);
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
                    const position = areaLeaderboard.getUserPosition(req.user.id);
                    areaPositions[period] = position;
                }
            }
            
            positions.area[address.zipCode] = {
                city: address.city,
                positions: areaPositions
            };
        }
        
        // Get challenge positions for active challenges user is participating in
        const activeUserChallenges = await mongoose.model('UserChallenge').find({
            citizenId: req.user.id
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
                    const position = challengeLeaderboard.getUserPosition(req.user.id);
                    positions.challenges.push({
                        challengeId: userChallenge.challengeId._id,
                        challengeTitle: userChallenge.challengeId.title,
                        position: position
                    });
                }
            }
        }
        
        res.json({
            success: true,
            data: positions
        });
    } catch (error) {
        console.error('Error fetching user positions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user positions'
        });
    }
});

// @desc    Get available areas for leaderboards
// @route   GET /api/leaderboard/areas
// @access  Private (Citizens)
router.get('/areas', protect, authorize('citizen', 'admin'), async (req, res) => {
    try {
        // Get distinct areas from existing leaderboards
        const areas = await Leaderboard.distinct('area', {
            type: 'area',
            'area.zipCode': { $exists: true, $ne: null }
        });
        
        // Also get areas from user addresses
        const userAreas = await User.aggregate([
            { $unwind: '$profile.addresses' },
            {
                $group: {
                    _id: {
                        zipCode: '$profile.addresses.zipCode',
                        city: '$profile.addresses.city'
                    },
                    userCount: { $sum: 1 }
                }
            },
            { $sort: { userCount: -1 } },
            { $limit: 50 }
        ]);
        
        const combinedAreas = [
            ...areas,
            ...userAreas.map(area => ({
                zipCode: area._id.zipCode,
                city: area._id.city,
                userCount: area.userCount
            }))
        ];
        
        // Remove duplicates and sort by user count
        const uniqueAreas = combinedAreas.reduce((acc, area) => {
            const existing = acc.find(a => a.zipCode === area.zipCode);
            if (!existing) {
                acc.push(area);
            } else if (area.userCount && area.userCount > (existing.userCount || 0)) {
                existing.userCount = area.userCount;
            }
            return acc;
        }, []);
        
        uniqueAreas.sort((a, b) => (b.userCount || 0) - (a.userCount || 0));
        
        res.json({
            success: true,
            data: uniqueAreas.slice(0, 20) // Return top 20 areas
        });
    } catch (error) {
        console.error('Error fetching areas:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch areas'
        });
    }
});

// Admin routes

// @desc    Manually update leaderboard rankings
// @route   POST /api/leaderboard/update
// @access  Private (Admin)
router.post('/update', protect, authorize('admin'), async (req, res) => {
    try {
        const { type, period, area, challengeId } = req.body;
        
        let criteria = { type, period };
        
        if (type === 'area' && area) {
            criteria['area.zipCode'] = area.zipCode;
            if (area.city) {
                criteria['area.city'] = area.city;
            }
        }
        
        if (type === 'challenge' && challengeId) {
            criteria.challengeId = challengeId;
        }
        
        const leaderboard = await Leaderboard.findOrCreate(criteria);
        
        // Recalculate rankings
        leaderboard.recalculateRankings();
        await leaderboard.save();
        
        res.json({
            success: true,
            message: 'Leaderboard updated successfully',
            data: {
                totalParticipants: leaderboard.totalParticipants,
                lastUpdated: leaderboard.lastCalculated
            }
        });
    } catch (error) {
        console.error('Error updating leaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update leaderboard'
        });
    }
});

// @desc    Get leaderboard statistics
// @route   GET /api/leaderboard/admin/stats
// @access  Private (Admin)
router.get('/admin/stats', protect, authorize('admin'), async (req, res) => {
    try {
        const stats = await Leaderboard.aggregate([
            {
                $group: {
                    _id: {
                        type: '$type',
                        period: '$period'
                    },
                    count: { $sum: 1 },
                    totalParticipants: { $sum: '$totalParticipants' },
                    avgParticipants: { $avg: '$totalParticipants' },
                    lastUpdated: { $max: '$lastCalculated' }
                }
            },
            {
                $sort: { '_id.type': 1, '_id.period': 1 }
            }
        ]);
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching leaderboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leaderboard statistics'
        });
    }
});

export default router;