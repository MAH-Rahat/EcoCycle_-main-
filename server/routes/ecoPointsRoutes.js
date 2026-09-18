import express from 'express';
import {
    getWallet,
    getTransactionHistory,
    awardBonusPoints,
    getWalletStats,
    getWasteTypeConfigs
} from '../controllers/ecoPointsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// GET /api/ecopoints/wallet - Get wallet balance and recent transactions
router.get('/wallet', getWallet);

// GET /api/ecopoints/transactions - Get full transaction history with pagination
router.get('/transactions', getTransactionHistory);

// GET /api/ecopoints/stats - Get wallet statistics
router.get('/stats', getWalletStats);

// POST /api/ecopoints/bonus - Award bonus points (admin only)
router.post('/bonus', awardBonusPoints);

// GET /api/ecopoints/waste-types - Get waste type configurations
router.get('/waste-types', getWasteTypeConfigs);

export default router;