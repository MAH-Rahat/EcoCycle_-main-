import express from 'express';
import {
    getProfile,
    updateProfile,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    getAddresses
} from '../controllers/profileController.js';
import { protect, requireOwnership } from '../middleware/authMiddleware.js';
import { checkPermissions, protectRoute } from '../middleware/rbacMiddleware.js';
import { PERMISSIONS } from '../middleware/rbacConfig.js';

const router = express.Router();

// All profile routes require authentication
router.use(protect);

/**
 * @desc    Get user profile
 * @route   GET /api/profile
 * @access  Private - Own profile or Admin
 */
router.get('/', 
    protectRoute('OWN_RESOURCE'),
    checkPermissions(PERMISSIONS.PROFILE_READ_OWN),
    getProfile
);

/**
 * @desc    Update user profile
 * @route   PUT /api/profile
 * @access  Private - Own profile or Admin
 */
router.put('/', 
    protectRoute('OWN_RESOURCE'),
    checkPermissions(PERMISSIONS.PROFILE_UPDATE_OWN),
    updateProfile
);

/**
 * @desc    Get all addresses
 * @route   GET /api/profile/addresses
 * @access  Private - Own addresses or Admin
 */
router.get('/addresses', 
    protectRoute('OWN_RESOURCE'),
    checkPermissions(PERMISSIONS.PROFILE_READ_OWN),
    getAddresses
);

/**
 * @desc    Add new address
 * @route   POST /api/profile/addresses
 * @access  Private - Own profile or Admin
 */
router.post('/addresses', 
    protectRoute('OWN_RESOURCE'),
    checkPermissions(PERMISSIONS.PROFILE_UPDATE_OWN),
    addAddress
);

/**
 * @desc    Update existing address
 * @route   PUT /api/profile/addresses/:addressId
 * @access  Private - Own address or Admin
 */
router.put('/addresses/:addressId', 
    protectRoute('OWN_RESOURCE'),
    checkPermissions(PERMISSIONS.PROFILE_UPDATE_OWN),
    updateAddress
);

/**
 * @desc    Delete address
 * @route   DELETE /api/profile/addresses/:addressId
 * @access  Private - Own address or Admin
 */
router.delete('/addresses/:addressId', 
    protectRoute('OWN_RESOURCE'),
    checkPermissions(PERMISSIONS.PROFILE_UPDATE_OWN),
    deleteAddress
);

/**
 * @desc    Set default address
 * @route   PUT /api/profile/addresses/:addressId/default
 * @access  Private - Own address or Admin
 */
router.put('/addresses/:addressId/default', 
    protectRoute('OWN_RESOURCE'),
    checkPermissions(PERMISSIONS.PROFILE_UPDATE_OWN),
    setDefaultAddress
);

export default router;