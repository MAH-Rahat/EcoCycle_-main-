import Reward from '../models/Reward.js';
import RewardRedemption from '../models/RewardRedemption.js';
import Partner from '../models/Partner.js';
import { spendPoints } from './ecoPointsController.js';
import EcoPointsWallet from '../models/EcoPointsWallet.js';
import socketService from '../services/socketService.js';

// Get all available rewards
export const getRewards = async (req, res) => {
    try {
        const {
            category,
            maxPoints,
            minPoints,
            search,
            page = 1,
            limit = 20,
            sortBy = 'priority'
        } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        let query;
        const filters = { category, maxPoints, minPoints };

        if (search) {
            query = Reward.searchRewards(search, filters);
        } else {
            query = Reward.getAvailableRewards(filters);
        }

        // Apply sorting
        if (sortBy === 'price_low') {
            query = query.sort({ pointsCost: 1, priority: -1 });
        } else if (sortBy === 'price_high') {
            query = query.sort({ pointsCost: -1, priority: -1 });
        } else if (sortBy === 'newest') {
            query = query.sort({ createdAt: -1, priority: -1 });
        }

        const rewards = await query.skip(skip).limit(limitNum);
        const total = await Reward.countDocuments({
            isActive: true,
            $or: [
                { expiresAt: { $exists: false } },
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } }
            ]
        });

        res.json({
            success: true,
            data: {
                rewards,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(total / limitNum),
                    totalItems: total,
                    hasNext: skip + limitNum < total,
                    hasPrev: pageNum > 1
                }
            }
        });
    } catch (error) {
        console.error('Get rewards error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve rewards',
            error: error.message
        });
    }
};

// Get reward by ID
export const getRewardById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const reward = await Reward.findById(id)
            .populate('partnerId', 'name logo website');
        
        if (!reward) {
            return res.status(404).json({
                success: false,
                message: 'Reward not found'
            });
        }

        // Check if user can redeem this reward
        let canRedeem = { canRedeem: false, reason: 'Login required' };
        if (req.user) {
            const wallet = await EcoPointsWallet.findOne({ citizenId: req.user.id });
            const userPoints = wallet ? wallet.balance : 0;
            canRedeem = reward.canRedeem(userPoints);
        }

        res.json({
            success: true,
            data: {
                reward,
                canRedeem
            }
        });
    } catch (error) {
        console.error('Get reward by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve reward',
            error: error.message
        });
    }
};

// Redeem a reward
export const redeemReward = async (req, res) => {
    try {
        const { rewardId } = req.params;
        const { deliveryAddress, contactInfo } = req.body;
        const citizenId = req.user.id;

        // Get the reward
        const reward = await Reward.findById(rewardId);
        if (!reward) {
            return res.status(404).json({
                success: false,
                message: 'Reward not found'
            });
        }

        // Check if reward is available
        const wallet = await EcoPointsWallet.getOrCreateWallet(citizenId);
        const canRedeemResult = reward.canRedeem(wallet.balance);
        
        if (!canRedeemResult.canRedeem) {
            return res.status(400).json({
                success: false,
                message: canRedeemResult.reason
            });
        }

        // Create redemption record
        const redemption = new RewardRedemption({
            citizenId,
            rewardId,
            pointsSpent: reward.pointsCost,
            fulfillmentDetails: {
                deliveryAddress,
                contactInfo
            }
        });

        await redemption.save();

        // Spend points from wallet
        try {
            await spendPoints(
                citizenId,
                reward.pointsCost,
                `Redeemed reward: ${reward.name}`,
                redemption._id,
                'reward'
            );
        } catch (pointsError) {
            // If points spending fails, delete the redemption
            await RewardRedemption.findByIdAndDelete(redemption._id);
            throw pointsError;
        }

        // Update reward statistics
        await reward.decrementStock();

        // Populate the redemption for response
        await redemption.populate('rewardId', 'name description image');

        // Send real-time notification
        socketService.sendNotification(citizenId.toString(), {
            type: 'reward_redeemed',
            title: 'Reward Redeemed!',
            message: `You successfully redeemed ${reward.name} for ${reward.pointsCost} EcoPoints`,
            data: {
                redemptionCode: redemption.redemptionCode,
                rewardName: reward.name,
                pointsSpent: reward.pointsCost
            }
        });

        // Notify admins about new redemption
        socketService.sendRoleNotification('admin', {
            type: 'new_redemption',
            title: 'New Reward Redemption',
            message: `${req.user.name} redeemed ${reward.name}`,
            data: {
                redemptionId: redemption._id,
                citizenName: req.user.name,
                rewardName: reward.name
            }
        });

        res.status(201).json({
            success: true,
            message: 'Reward redeemed successfully',
            data: {
                redemption,
                redemptionCode: redemption.redemptionCode
            }
        });
    } catch (error) {
        console.error('Redeem reward error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to redeem reward',
            error: error.message
        });
    }
};

// Get user's redemption history
export const getUserRedemptions = async (req, res) => {
    try {
        const citizenId = req.user.id;
        const { status, page = 1, limit = 10 } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const filters = {};
        if (status) filters.status = status;

        const redemptions = await RewardRedemption.getUserRedemptions(citizenId, filters)
            .skip(skip)
            .limit(limitNum);

        const total = await RewardRedemption.countDocuments({ citizenId, ...filters });

        res.json({
            success: true,
            data: {
                redemptions,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(total / limitNum),
                    totalItems: total,
                    hasNext: skip + limitNum < total,
                    hasPrev: pageNum > 1
                }
            }
        });
    } catch (error) {
        console.error('Get user redemptions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve redemption history',
            error: error.message
        });
    }
};

// Get redemption by code
export const getRedemptionByCode = async (req, res) => {
    try {
        const { code } = req.params;
        const citizenId = req.user.id;

        const redemption = await RewardRedemption.findOne({
            redemptionCode: code,
            citizenId
        }).populate('rewardId', 'name description image category');

        if (!redemption) {
            return res.status(404).json({
                success: false,
                message: 'Redemption not found'
            });
        }

        res.json({
            success: true,
            data: redemption
        });
    } catch (error) {
        console.error('Get redemption by code error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve redemption',
            error: error.message
        });
    }
};

// Admin: Get all redemptions
export const getAllRedemptions = async (req, res) => {
    try {
        const {
            status,
            citizenId,
            rewardId,
            page = 1,
            limit = 20,
            sortBy = 'newest'
        } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const query = {};
        if (status) query.status = status;
        if (citizenId) query.citizenId = citizenId;
        if (rewardId) query.rewardId = rewardId;

        let sortOptions = { createdAt: -1 };
        if (sortBy === 'oldest') sortOptions = { createdAt: 1 };
        else if (sortBy === 'points_high') sortOptions = { pointsSpent: -1 };
        else if (sortBy === 'points_low') sortOptions = { pointsSpent: 1 };

        const redemptions = await RewardRedemption.find(query)
            .populate('rewardId', 'name description image category pointsCost')
            .populate('citizenId', 'name email mobile')
            .populate('processedBy', 'name email')
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNum);

        const total = await RewardRedemption.countDocuments(query);

        res.json({
            success: true,
            data: {
                redemptions,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(total / limitNum),
                    totalItems: total,
                    hasNext: skip + limitNum < total,
                    hasPrev: pageNum > 1
                }
            }
        });
    } catch (error) {
        console.error('Get all redemptions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve redemptions',
            error: error.message
        });
    }
};

// Admin: Update redemption status
export const updateRedemptionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, fulfillmentDetails, cancellationReason } = req.body;
        const adminId = req.user.id;

        const redemption = await RewardRedemption.findById(id)
            .populate('rewardId', 'name')
            .populate('citizenId', 'name email');

        if (!redemption) {
            return res.status(404).json({
                success: false,
                message: 'Redemption not found'
            });
        }

        let updatedRedemption;
        let notificationMessage;

        switch (status) {
            case 'approved':
                updatedRedemption = await redemption.approve(adminId, notes);
                notificationMessage = `Your redemption for ${redemption.rewardId.name} has been approved!`;
                break;
            case 'fulfilled':
                updatedRedemption = await redemption.fulfill(adminId, fulfillmentDetails, notes);
                notificationMessage = `Your redemption for ${redemption.rewardId.name} has been fulfilled!`;
                break;
            case 'cancelled':
                updatedRedemption = await redemption.cancel(adminId, cancellationReason);
                notificationMessage = `Your redemption for ${redemption.rewardId.name} has been cancelled.`;
                // TODO: Refund points to user
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status'
                });
        }

        // Send notification to user
        socketService.sendNotification(redemption.citizenId._id.toString(), {
            type: 'redemption_status_updated',
            title: 'Redemption Status Updated',
            message: notificationMessage,
            data: {
                redemptionCode: redemption.redemptionCode,
                status: updatedRedemption.status,
                rewardName: redemption.rewardId.name
            }
        });

        res.json({
            success: true,
            message: 'Redemption status updated successfully',
            data: updatedRedemption
        });
    } catch (error) {
        console.error('Update redemption status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update redemption status',
            error: error.message
        });
    }
};

// Get reward categories
export const getRewardCategories = async (req, res) => {
    try {
        const categories = await Reward.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            success: true,
            data: categories.map(cat => ({
                category: cat._id,
                count: cat.count
            }))
        });
    } catch (error) {
        console.error('Get reward categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve categories',
            error: error.message
        });
    }
};

// Get partners
export const getPartners = async (req, res) => {
    try {
        const partners = await Partner.getActivePartners();
        
        res.json({
            success: true,
            data: partners
        });
    } catch (error) {
        console.error('Get partners error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve partners',
            error: error.message
        });
    }
};