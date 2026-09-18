import Pickup from '../models/Pickup.js';
import PickupStatusHistory from '../models/PickupStatusHistory.js';
import socketService from '../services/socketService.js';

// Get pickup with complete history
export const getPickupWithHistory = async (req, res) => {
    try {
        const { pickupId } = req.params;
        
        const result = await Pickup.getPickupWithHistory(pickupId);
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Pickup not found'
            });
        }
        
        // Check if user has permission to view this pickup
        const userId = req.user.id;
        const userRole = req.user.role;
        
        if (userRole !== 'admin' && 
            result.pickup.citizen._id.toString() !== userId && 
            result.pickup.assignedCollector?._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Get pickup with history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve pickup details',
            error: error.message
        });
    }
};

// Update pickup status
export const updatePickupStatus = async (req, res) => {
    try {
        const { pickupId } = req.params;
        const { status, reason, estimatedArrival } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
        
        const pickup = await Pickup.findById(pickupId)
            .populate('citizen', 'name email')
            .populate('assignedCollector', 'name email');
        
        if (!pickup) {
            return res.status(404).json({
                success: false,
                message: 'Pickup not found'
            });
        }
        
        // Check permissions
        if (userRole !== 'admin' && 
            pickup.assignedCollector?._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Only assigned collectors or admins can update pickup status'
            });
        }
        
        // Validate status transition
        const validTransitions = {
            'pending': ['assigned', 'cancelled'],
            'assigned': ['en_route', 'cancelled'],
            'en_route': ['arrived', 'cancelled'],
            'arrived': ['in_progress', 'cancelled'],
            'in_progress': ['completed', 'cancelled'],
            'completed': [], // No transitions from completed
            'cancelled': [] // No transitions from cancelled
        };
        
        if (!validTransitions[pickup.status].includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status transition from ${pickup.status} to ${status}`
            });
        }
        
        // Update pickup
        const oldStatus = pickup.status;
        pickup.status = status;
        
        // Set additional fields based on status
        if (status === 'assigned' && !pickup.assignedAt) {
            pickup.assignedAt = new Date();
        }
        
        if (status === 'en_route' && estimatedArrival) {
            pickup.estimatedArrival = new Date(estimatedArrival);
        }
        
        await pickup.save();
        
        // Send real-time updates
        socketService.emitPickupStatusUpdate(pickupId, {
            pickupId: pickup._id,
            status: pickup.status,
            estimatedArrival: pickup.estimatedArrival,
            updatedBy: req.user.name,
            timestamp: new Date()
        });
        
        // Send notifications
        let notificationMessage = '';
        let notificationType = 'pickup_status_updated';
        
        switch (status) {
            case 'assigned':
                notificationMessage = `Your pickup has been assigned to ${pickup.assignedCollector?.name || 'a collector'}`;
                break;
            case 'en_route':
                notificationMessage = `Your collector is on the way${pickup.estimatedArrival ? ` (ETA: ${pickup.estimatedArrival.toLocaleTimeString()})` : ''}`;
                break;
            case 'arrived':
                notificationMessage = 'Your collector has arrived at the pickup location';
                break;
            case 'completed':
                notificationMessage = 'Your pickup has been completed successfully';
                notificationType = 'pickup_completed';
                break;
            case 'cancelled':
                notificationMessage = `Your pickup has been cancelled${reason ? `: ${reason}` : ''}`;
                notificationType = 'pickup_cancelled';
                break;
        }
        
        if (notificationMessage) {
            socketService.sendNotification(pickup.citizen._id.toString(), {
                type: notificationType,
                title: 'Pickup Status Update',
                message: notificationMessage,
                data: {
                    pickupId: pickup._id,
                    status: pickup.status,
                    estimatedArrival: pickup.estimatedArrival
                }
            });
        }
        
        res.json({
            success: true,
            message: 'Pickup status updated successfully',
            data: {
                pickup: {
                    _id: pickup._id,
                    status: pickup.status,
                    estimatedArrival: pickup.estimatedArrival,
                    updatedAt: new Date()
                }
            }
        });
    } catch (error) {
        console.error('Update pickup status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update pickup status',
            error: error.message
        });
    }
};

// Update collector location
export const updateCollectorLocation = async (req, res) => {
    try {
        const { pickupId } = req.params;
        const { lat, lng } = req.body;
        const userId = req.user.id;
        
        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }
        
        const pickup = await Pickup.findById(pickupId);
        
        if (!pickup) {
            return res.status(404).json({
                success: false,
                message: 'Pickup not found'
            });
        }
        
        // Check if user is the assigned collector
        if (pickup.assignedCollector?.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Only assigned collectors can update location'
            });
        }
        
        // Update location
        await pickup.updateLocation(lat, lng);
        
        // Broadcast location update to subscribers
        socketService.broadcastCollectorLocation(pickupId, {
            collectorId: userId,
            pickupId: pickup._id,
            lat,
            lng,
            timestamp: new Date()
        });
        
        res.json({
            success: true,
            message: 'Location updated successfully',
            data: {
                location: {
                    lat,
                    lng,
                    updatedAt: pickup.collectorLocation.updatedAt
                }
            }
        });
    } catch (error) {
        console.error('Update collector location error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update location',
            error: error.message
        });
    }
};

// Cancel pickup
export const cancelPickup = async (req, res) => {
    try {
        const { pickupId } = req.params;
        const { reason } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
        
        const pickup = await Pickup.findById(pickupId)
            .populate('citizen', 'name email')
            .populate('assignedCollector', 'name email');
        
        if (!pickup) {
            return res.status(404).json({
                success: false,
                message: 'Pickup not found'
            });
        }
        
        // Check permissions - citizen, assigned collector, or admin can cancel
        if (userRole !== 'admin' && 
            pickup.citizen._id.toString() !== userId && 
            pickup.assignedCollector?._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        // Cancel pickup
        const cancelResult = pickup.cancelPickup(userId, reason);
        
        if (!cancelResult.success) {
            return res.status(400).json({
                success: false,
                message: cancelResult.message
            });
        }
        
        await pickup.save();
        
        // Send real-time updates
        socketService.emitPickupStatusUpdate(pickupId, {
            pickupId: pickup._id,
            status: pickup.status,
            cancelledAt: pickup.cancelledAt,
            cancellationReason: pickup.cancellationReason,
            cancelledBy: req.user.name
        });
        
        // Send notifications
        const recipientId = pickup.citizen._id.toString() === userId 
            ? pickup.assignedCollector?._id.toString() 
            : pickup.citizen._id.toString();
        
        if (recipientId) {
            const isCollectorCancelling = pickup.assignedCollector?._id.toString() === userId;
            socketService.sendNotification(recipientId, {
                type: 'pickup_cancelled',
                title: 'Pickup Cancelled',
                message: `Pickup has been cancelled by ${isCollectorCancelling ? 'collector' : 'citizen'}${reason ? `: ${reason}` : ''}`,
                data: {
                    pickupId: pickup._id,
                    cancelledBy: req.user.name,
                    reason
                }
            });
        }
        
        res.json({
            success: true,
            message: 'Pickup cancelled successfully',
            data: {
                pickup: {
                    _id: pickup._id,
                    status: pickup.status,
                    cancelledAt: pickup.cancelledAt,
                    cancellationReason: pickup.cancellationReason
                }
            }
        });
    } catch (error) {
        console.error('Cancel pickup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel pickup',
            error: error.message
        });
    }
};

// Get pickup tracking data for real-time updates
export const getPickupTracking = async (req, res) => {
    try {
        const { pickupId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        
        const pickup = await Pickup.findById(pickupId)
            .populate('citizen', 'name email')
            .populate('assignedCollector', 'name email');
        
        if (!pickup) {
            return res.status(404).json({
                success: false,
                message: 'Pickup not found'
            });
        }
        
        // Check permissions
        if (userRole !== 'admin' && 
            pickup.citizen._id.toString() !== userId && 
            pickup.assignedCollector?._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        // Get recent status history
        const recentHistory = await PickupStatusHistory.find({ pickupId })
            .populate('changedBy', 'name role')
            .sort({ timestamp: -1 })
            .limit(10);
        
        const trackingData = {
            pickup: {
                _id: pickup._id,
                status: pickup.status,
                estimatedArrival: pickup.estimatedArrival,
                collectorLocation: pickup.collectorLocation,
                qrVerified: pickup.qrVerified,
                completedAt: pickup.completedAt
            },
            collector: pickup.assignedCollector ? {
                name: pickup.assignedCollector.name,
                email: pickup.assignedCollector.email
            } : null,
            recentUpdates: recentHistory.map(h => ({
                status: h.toStatus,
                timestamp: h.timestamp,
                changedBy: h.changedBy.name,
                reason: h.reason,
                metadata: h.metadata
            }))
        };
        
        res.json({
            success: true,
            data: trackingData
        });
    } catch (error) {
        console.error('Get pickup tracking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve tracking data',
            error: error.message
        });
    }
};

// Get status history for a pickup (admin function)
export const getPickupStatusHistory = async (req, res) => {
    try {
        const { pickupId } = req.params;
        
        const history = await PickupStatusHistory.getPickupHistory(pickupId);
        
        res.json({
            success: true,
            data: {
                pickupId,
                history
            }
        });
    } catch (error) {
        console.error('Get pickup status history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve status history',
            error: error.message
        });
    }
};