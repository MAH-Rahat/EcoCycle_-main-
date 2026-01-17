
import express from 'express';
import User from '../models/User.js';
import Voucher from '../models/Voucher.js';

const router = express.Router();

// 1. Get all citizens and their current points
router.get('/users-points', async (req, res) => {
    try {
        const users = await User.find({ role: 'citizen' }).select('name email points');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 2. Issue a voucher (Admin logic)
router.post('/issue-voucher', async (req, res) => {
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