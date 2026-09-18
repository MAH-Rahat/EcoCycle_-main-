
import express from 'express';
import {
    getRewards,
    getRewardById,
    redeemReward,
    getUserRedemptions,
    getRedemptionByCode,
    getAllRedemptions,
    updateRedemptionStatus,
    getRewardCategories,
    getPartners
} from '../controllers/rewardsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import User from '../models/User.js';
import Voucher from '../models/Voucher.js';

const router = express.Router();

// Protected routes - require authentication
router.use(protect);

// Public reward browsing (for authenticated users)
router.get('/', getRewards);
router.get('/categories', getRewardCategories);
router.get('/partners', getPartners);
router.get('/:id', getRewardById);

// User redemption management
router.post('/:rewardId/redeem', redeemReward);
router.get('/my-redemptions', getUserRedemptions);
router.get('/redemption/:code', getRedemptionByCode);

// Admin routes
router.get('/admin/redemptions', authorize('admin'), getAllRedemptions);
router.put('/admin/redemptions/:id', authorize('admin'), updateRedemptionStatus);

// Legacy routes for backward compatibility
// 1. Get all citizens and their current points
router.get('/legacy/users-points', authorize('admin'), async (req, res) => {
    try {
        const users = await User.find({ role: 'citizen' }).select('name email points');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 2. Issue a voucher (Admin logic)
router.post('/legacy/issue-voucher', authorize('admin'), async (req, res) => {
    const { userId, shopName, discountAmount, pointsRequired, code } = req.body;

    try {
        const user = await User.findById(userId);
        if (user.points < pointsRequired) {
            return res.status(400).json({ message: "Insufficient EcoPoints" });
        }

        // Deduct points from user
        user.points -= pointsRequired;
        await user.save();

        // Create Voucher
        const voucher = await Voucher.create({
            code,
            shopName,
            discountAmount,
            pointsRequired,
            assignedTo: userId
        });

        res.status(201).json({ message: "Voucher issued successfully", voucher });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;