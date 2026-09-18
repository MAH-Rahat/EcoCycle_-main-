import express from 'express';
import {
    getImpactDashboard,
    refreshDashboard,
    getLeaderboard,
    getAchievements,
    getSystemImpactStats
} from '../controllers/impactDashboardController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get user's impact dashboard
router.get('/dashboard', protect, getImpactDashboard);

// Refresh dashboard data
router.post('/refresh', protect, refreshDashboard);

// Get leaderboard
router.get('/leaderboard', protect, getLeaderboard);

// Get achievements
router.get('/achievements', protect, getAchievements);

// Get system-wide impact statistics (admin only)
router.get('/system-stats', protect, getSystemImpactStats);

export default router;