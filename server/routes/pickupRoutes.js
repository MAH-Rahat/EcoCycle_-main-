import express from 'express';
import { 
    createPickup, 
    getPickupsByCitizen, 
    getAvailablePickups,
    updatePickupStatus,
    assignPickup,
    getCollectorPickups,
    completePickup,
    cancelPickup
} from '../controllers/pickupController.js';

const router = express.Router();

// @route   POST /api/pickup/schedule
router.post('/schedule', createPickup);

// @route   GET /api/pickup/user/:userId
router.get('/user/:userId', getPickupsByCitizen);

// --- COLLECTOR ROUTES ---

// @route   GET /api/pickup/available
router.get('/available', getAvailablePickups);

// @route   PUT /api/pickup/:id/status
router.put('/:id/status', updatePickupStatus);

// @route   PUT /api/pickup/:id/assign
router.put('/:id/assign', assignPickup);

// @route   GET /api/pickup/collector/:collectorId
router.get('/collector/:collectorId', getCollectorPickups);

// @route   PUT /api/pickup/:id/complete
router.put('/:id/complete', completePickup);

// @route   PUT /api/pickup/:id/cancel
router.put('/:id/cancel', cancelPickup);

export default router;