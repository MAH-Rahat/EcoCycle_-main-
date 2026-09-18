import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import Waste from '../models/Waste.js';

/**
 * @desc    Get all users with comprehensive search and filtering
 * @route   GET /api/users/all
 * @access  Admin only
 * Validates: Requirements 12.1 - Admin search functionality
 */
export const getAllUsers = async (req, res) => {
    try {
        const { 
            role, 
            search, 
            isActive, 
            sortBy = 'createdAt', 
            sortOrder = 'desc',
            page = 1,
            limit = 20
        } = req.query;

        // Build filter query
        const filter = {};
        
        if (role) {
            filter.role = role;
        }
        
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }
        
        // Search across multiple fields
        if (search) {
            filter.$or = [
                { 'profile.firstName': { $regex: search, $options: 'i' } },
                { 'profile.lastName': { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { 'profile.phone': { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        // Execute query with pagination
        const users = await User.find(filter)
            .select('-password -adminCode')
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const total = await User.countDocuments(filter);

        res.status(200).json({
            users,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Fetch All Users Error:", error);
        res.status(500).json({ 
            error: {
                code: 'SERVER_ERROR',
                message: "Server Error fetching account records",
                timestamp: new Date().toISOString()
            }
        });
    }
};

/**
 * @desc    Get activity logs for a specific user
 * @route   GET /api/users/activity/:id
 * @access  Admin only
 * Validates: Requirements 12.2 - Admin audit logging
 */
export const getUserActivity = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const logs = await ActivityLog.find({ performedBy: req.params.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await ActivityLog.countDocuments({ performedBy: req.params.id });

        res.status(200).json({
            logs,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Fetch Activity Error:", error);
        res.status(500).json({ 
            error: {
                code: 'SERVER_ERROR',
                message: "Error fetching activity logs",
                timestamp: new Date().toISOString()
            }
        });
    }
};

/**
 * @desc    Delete any user by ID
 * @route   DELETE /api/users/:id
 * @access  Admin only
 * Validates: Requirements 12.2 - Admin audit logging
 */
export const deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ 
                error: {
                    code: 'USER_NOT_FOUND',
                    message: "User not found",
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Log the deletion action
        await ActivityLog.create({
            performedBy: req.user._id,
            targetUser: userId,
            action: 'DELETE_USER',
            details: `Deleted user ${user.profile?.firstName} ${user.profile?.lastName} (${user.email}) with role ${user.role}`
        });

        await User.findByIdAndDelete(userId);
        
        res.status(200).json({ 
            success: true, 
            message: `Account for ${user.profile?.firstName || user.email} (${user.role}) has been removed.` 
        });
    } catch (error) {
        console.error("Delete User Error:", error);
        res.status(500).json({ 
            error: {
                code: 'SERVER_ERROR',
                message: "Internal server error during deletion",
                timestamp: new Date().toISOString()
            }
        });
    }
};

/**
 * @desc    Update user account details
 * @route   PUT /api/users/:id
 * @access  Admin only
 * Validates: Requirements 12.2 - Admin audit logging
 */
export const updateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const updates = req.body;

        // Prevent updating sensitive fields directly
        delete updates.password;
        delete updates.adminCode;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                error: {
                    code: 'USER_NOT_FOUND',
                    message: "User not found",
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Track what changed for audit log
        const changes = [];
        Object.keys(updates).forEach(key => {
            if (JSON.stringify(user[key]) !== JSON.stringify(updates[key])) {
                changes.push(`${key}: ${JSON.stringify(user[key])} -> ${JSON.stringify(updates[key])}`);
            }
        });

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password -adminCode');

        // Log the modification
        await ActivityLog.create({
            performedBy: req.user._id,
            targetUser: userId,
            action: 'UPDATE_USER',
            details: `Modified user account: ${changes.join(', ')}`
        });

        res.status(200).json({
            success: true,
            user: updatedUser,
            message: 'User account updated successfully'
        });
    } catch (error) {
        console.error("Update User Error:", error);
        res.status(500).json({ 
            error: {
                code: 'SERVER_ERROR',
                message: "Error updating user account",
                timestamp: new Date().toISOString()
            }
        });
    }
};

/**
 * @desc    Get pending waste submissions for moderation
 * @route   GET /api/users/waste/pending
 * @access  Admin only
 * Validates: Requirements 12.3 - Waste submission moderation
 */
export const getPendingWasteSubmissions = async (req, res) => {
    try {
        const { page = 1, limit = 20, wasteType } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const filter = { status: 'pending' };
        if (wasteType) {
            filter.wasteType = wasteType;
        }

        const submissions = await Waste.find(filter)
            .populate('citizenId', 'profile.firstName profile.lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Waste.countDocuments(filter);

        res.status(200).json({
            submissions,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Fetch Pending Waste Error:", error);
        res.status(500).json({ 
            error: {
                code: 'SERVER_ERROR',
                message: "Error fetching pending waste submissions",
                timestamp: new Date().toISOString()
            }
        });
    }
};

/**
 * @desc    Approve or reject waste submission
 * @route   PUT /api/users/waste/:id/moderate
 * @access  Admin only
 * Validates: Requirements 12.3 - Waste submission moderation
 */
export const moderateWasteSubmission = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, note } = req.body; // action: 'approve' or 'reject'

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ 
                error: {
                    code: 'INVALID_ACTION',
                    message: "Action must be 'approve' or 'reject'",
                    timestamp: new Date().toISOString()
                }
            });
        }

        const wasteLog = await Waste.findById(id);
        if (!wasteLog) {
            return res.status(404).json({ 
                error: {
                    code: 'WASTE_LOG_NOT_FOUND',
                    message: "Waste log not found",
                    timestamp: new Date().toISOString()
                }
            });
        }

        if (wasteLog.status !== 'pending') {
            return res.status(400).json({ 
                error: {
                    code: 'ALREADY_MODERATED',
                    message: "This waste submission has already been moderated",
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Update waste log status
        wasteLog.status = action === 'approve' ? 'verified' : 'rejected';
        wasteLog.verifiedBy = req.user._id;
        wasteLog.verifiedAt = new Date();
        if (note) {
            wasteLog.adminNote = note;
        }
        if (action === 'reject' && note) {
            wasteLog.rejectionReason = note;
        }

        await wasteLog.save();

        // Log the moderation action
        await ActivityLog.create({
            performedBy: req.user._id,
            targetUser: wasteLog.citizenId,
            action: action === 'approve' ? 'APPROVE_WASTE' : 'REJECT_WASTE',
            details: `${action === 'approve' ? 'Approved' : 'Rejected'} waste submission ${id}${note ? `: ${note}` : ''}`
        });

        res.status(200).json({
            success: true,
            wasteLog,
            message: `Waste submission ${action === 'approve' ? 'approved' : 'rejected'} successfully`
        });
    } catch (error) {
        console.error("Moderate Waste Error:", error);
        res.status(500).json({ 
            error: {
                code: 'SERVER_ERROR',
                message: "Error moderating waste submission",
                timestamp: new Date().toISOString()
            }
        });
    }
};