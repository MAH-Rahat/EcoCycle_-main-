import express from 'express';
import {
    getPickupWithHistory,
    updatePickupStatus,
    updateCollectorLocation,
    cancelPickup,
    getPickupTracking,
    getPickupStatusHistory
} from '../controllers/pickupTrackingController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get pickup with complete history
router.get('/:pickupId/details', getPickupWithHistory);

// Get pickup tracking data for real-time updates
router.get('/:pickupId/tracking', getPickupTracking);

// Update pickup status (collector/admin only)
router.put('/:pickupId/status', authorize('collector', 'admin'), updatePickupStatus);

// Update collector location (collector only)
router.put('/:pickupId/location', authorize('collector'), updateCollectorLocation);

// Cancel pickup (citizen, collector, or admin)
router.put('/:pickupId/cancel', cancelPickup);

// Get status history (admin only)
router.get('/:pickupId/history', authorize('admin'), getPickupStatusHistory);

export default router;