import express from 'express';
// We import the functions we just created in the controller
import { 
    getAllUsers, 
    getUserActivity, 
    deleteUser,
    updateUser,
    getPendingWasteSubmissions,
    moderateWasteSubmission
} from '../controllers/AdminUserManagementController.js';
import { protect, requireAdmin } from '../middleware/authMiddleware.js';
import { checkAdminOperation, auditLogger } from '../middleware/rbacMiddleware.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protect);
router.use(requireAdmin);
router.use(auditLogger({ category: 'ADMIN_USER_MANAGEMENT' }));

/**
 * @desc    Get all users with filtering and pagination
 * @route   GET /api/users/all
 * @access  Admin only - User Management
 */
router.get('/all', checkAdminOperation('USER_MANAGEMENT'), getAllUsers);

/**
 * @desc    Get user activity details
 * @route   GET /api/users/activity/:id
 * @access  Admin only - User Management
 */
router.get('/activity/:id', checkAdminOperation('USER_MANAGEMENT'), getUserActivity);

/**
 * @desc    Update user account
 * @route   PUT /api/users/:id
 * @access  Admin only - User Management
 */
router.put('/:id', checkAdminOperation('USER_MANAGEMENT'), updateUser);

/**
 * @desc    Delete user account
 * @route   DELETE /api/users/:id
 * @access  Admin only - User Management
 */
router.delete('/:id', checkAdminOperation('USER_MANAGEMENT'), deleteUser);

/**
 * @desc    Get pending waste submissions for moderation
 * @route   GET /api/users/waste/pending
 * @access  Admin only - Content Moderation
 */
router.get('/waste/pending', checkAdminOperation('USER_MANAGEMENT'), getPendingWasteSubmissions);

/**
 * @desc    Moderate waste submission (approve/reject)
 * @route   PUT /api/users/waste/:id/moderate
 * @access  Admin only - Content Moderation
 */
router.put('/waste/:id/moderate', checkAdminOperation('USER_MANAGEMENT'), moderateWasteSubmission);

// Correctly exporting the defined router
export default router;