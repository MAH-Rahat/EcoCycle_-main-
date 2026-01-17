import express from 'express';
import Campaign from '../models/Campaign.js';

const router = express.Router();

// @desc    Post a new campaign (Admin)
router.post('/', async (req, res) => {
    try {
        const newPost = await Campaign.create(req.body);
        res.status(201).json(newPost);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all campaigns
router.get('/', async (req, res) => {
    try {
        const posts = await Campaign.find().sort({ createdAt: -1 });
        res.status(200).json(posts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Update a campaign (Edit/Update)
// @route   PUT /api/campaigns/:id
router.put('/:id', async (req, res) => {
    try {
        const updated = await Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Delete a campaign
// @route   DELETE /api/campaigns/:id
router.delete('/:id', async (req, res) => {
    try {
        await Campaign.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Post deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;