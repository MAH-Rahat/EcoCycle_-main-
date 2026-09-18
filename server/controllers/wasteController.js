import WasteLog, { Waste } from '../models/Waste.js';
import Pickup from '../models/Pickup.js';
import { awardPointsForWaste } from './ecoPointsController.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';
import { updateDashboardForWasteLog } from './impactDashboardController.js';

// Logic to get all logs for a specific user
export const getUserWasteHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const history = await WasteLog.find({ 
            $or: [
                { citizenId: userId },
                { citizen: userId }
            ]
        })
            .populate('citizenId', 'name email')
            .populate('citizen', 'name email')
            .populate('verifiedBy', 'name email')
            .sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            data: history
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Failed to fetch waste history", 
            error: error.message 
        });
    }
};

// Logic to log new waste with EcoPoints integration
export const logWaste = async (req, res) => {
    try {
        const { citizen, citizenId, material, wasteType, weight, photo, photos, description, pickupDetails, location } = req.body;
        
        const actualCitizenId = citizenId || citizen || req.user?.id;
        const actualWasteType = wasteType || (material ? material.toLowerCase() : null);
        
        if (!actualCitizenId || !actualWasteType || !weight) {
            return res.status(400).json({ 
                success: false, 
                message: "Citizen ID, waste type, and weight are required" 
            });
        }

        if (weight <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Weight must be greater than 0" 
            });
        }

        const validation = WasteLog.validateWasteData({
            citizenId: actualCitizenId,
            wasteType: actualWasteType,
            weight,
            description
        });

        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: validation.errors
            });
        }

        let pointsEarned = 0;
        let co2Saved = 0;
        
        try {
            const config = await WasteTypeConfig.findOne({ 
                type: actualWasteType,
                isActive: true 
            });
            
            if (config) {
                pointsEarned = Math.round(config.pointsPerKg * weight);
                co2Saved = config.co2SavedPerKg * weight;
            } else {
                pointsEarned = Math.round(weight * 10);
                co2Saved = weight * 1.5;
            }
        } catch (error) {
            pointsEarned = Math.round(weight * 10);
            co2Saved = weight * 1.5;
        }

        let photoArray = photos && Array.isArray(photos) ? photos : (photo ? [photo] : []);

        const newWasteLog = new WasteLog({
            citizenId: actualCitizenId,
            wasteType: actualWasteType,
            weight,
            photos: photoArray,
            description,
            location,
            ecoPointsEarned: pointsEarned,
            co2Saved,
            pickupDetails: pickupDetails || { isRequested: false },
            pickupStatus: pickupDetails?.isRequested ? 'Requested' : 'Not Requested',
            citizen: actualCitizenId,
            material: material || (actualWasteType.charAt(0).toUpperCase() + actualWasteType.slice(1)),
            photo: photoArray[0] || null,
            pointsEarned
        });

        await newWasteLog.save();

        try {
            await awardPointsForWaste(actualCitizenId, actualWasteType, weight, newWasteLog._id);
        } catch (error) {
            console.error('Failed to award points:', error.message);
        }

        try {
            await updateDashboardForWasteLog(actualCitizenId, newWasteLog, pointsEarned, co2Saved);
        } catch (error) {
            console.error('Failed to update impact dashboard:', error.message);
        }

        res.status(201).json({ 
            success: true, 
            message: "Waste logged successfully!",
            data: {
                wasteLog: newWasteLog,
                pointsEarned,
                co2Saved: Math.round(co2Saved * 100) / 100
            }
        });
    } catch (error) {
        console.error('Log waste error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to log waste",
            error: error.message 
        });
    }
};

// Get all waste logs (admin function)
export const getAllWasteLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        const wasteType = req.query.wasteType;
        const material = req.query.material;
        
        const filter = {};
        if (status) filter.status = status;
        if (wasteType) filter.wasteType = wasteType;
        if (material) filter.material = material;
        
        const skip = (page - 1) * limit;
        
        const wasteLogs = await WasteLog.find(filter)
            .populate('citizenId', 'name email')
            .populate('citizen', 'name email')
            .populate('verifiedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await WasteLog.countDocuments(filter);
        
        res.json({
            success: true,
            data: {
                wasteLogs,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    hasNext: skip + limit < total,
                    hasPrev: page > 1
                }
            }
        });
    } catch (error) {
        console.error('Get all waste logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve waste logs',
            error: error.message
        });
    }
};

// Update waste status (admin/collector function)
export const updateWasteStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNote, rejectionReason, collector, verifiedBy, isRequested } = req.body;
        
        const wasteLog = await WasteLog.findById(id);
        if (!wasteLog) {
            return res.status(404).json({
                success: false,
                message: 'Waste log not found'
            });
        }

        if (isRequested !== undefined) {
            wasteLog.pickupDetails = {
                ...wasteLog.pickupDetails,
                isRequested: true,
                requestedTime: new Date()
            };
            wasteLog.pickupStatus = 'Requested';
        }

        if (status === 'verified' || status === 'Accepted') {
            await wasteLog.verify(verifiedBy || req.user.id, adminNote);
        } else if (status === 'rejected' || status === 'Rejected') {
            await wasteLog.reject(verifiedBy || req.user.id, rejectionReason || adminNote);
        } else {
            const updateData = { status };
            if (adminNote) updateData.adminNote = adminNote;
            if (collector) updateData.collector = collector;
            if (verifiedBy) updateData.verifiedBy = verifiedBy;
            
            Object.assign(wasteLog, updateData);
            await wasteLog.save();
        }

        await wasteLog.populate('citizenId', 'name email');
        await wasteLog.populate('verifiedBy', 'name email');
        
        res.json({
            success: true,
            message: 'Waste status updated successfully',
            data: wasteLog
        });
    } catch (error) {
        console.error('Update waste status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update waste status',
            error: error.message
        });
    }
};

// Get waste type configurations
export const getWasteTypeConfigs = async (req, res) => {
    try {
        const configs = await WasteTypeConfig.find({ isActive: true }).sort({ type: 1 });
        res.json({ success: true, data: configs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve configurations', error: error.message });
    }
};

// --- UNIFIED PICKUP DISPATCH LOGIC (Queried from Pickup Model) ---

export const getScheduledPickups = async (req, res) => {
    try {
        const pickups = await Pickup.find()
            .populate('citizenId', 'name email mobile')
            .populate('wasteLogIds')
            .populate('assignedCollectorId', 'name email mobile')
            .sort({ scheduledTime: 1, createdAt: -1 });

        const formattedPickups = pickups.map(p => {
            const firstLog = p.wasteLogIds?.[0];
            const rawMaterial = firstLog?.material || firstLog?.wasteType || 'Recyclable Waste';
            const material = rawMaterial.charAt(0).toUpperCase() + rawMaterial.slice(1);
            const weight = p.estimatedWeight || firstLog?.weight || 1;

            return {
                _id: p._id,
                citizenId: p.citizenId,
                weight: weight,
                material: material,
                pickupDetails: {
                    address: p.address?.street || 'Dhaka Central',
                    requestedTime: p.scheduledTime
                },
                pickupStatus: p.status === 'assigned' ? 'Assigned' : p.status === 'completed' ? 'Completed' : 'Requested',
                assignedCollector: p.assignedCollectorId,
                dispatchNotes: p.notes
            };
        });

        res.status(200).json({
            success: true,
            data: formattedPickups
        });
    } catch (error) {
        console.error('Get scheduled pickups error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve scheduled pickups',
            error: error.message
        });
    }
};

export const assignCollectorToPickup = async (req, res) => {
    try {
        const { id } = req.params;
        const { collectorId, dispatchNotes } = req.body;

        const pickup = await Pickup.findById(id);
        if (!pickup) {
            return res.status(404).json({
                success: false,
                message: 'Pickup request not found'
            });
        }

        pickup.assignedCollectorId = collectorId;
        pickup.status = 'assigned';
        pickup.assignedAt = new Date();
        if (dispatchNotes) {
            pickup.notes = dispatchNotes;
        }

        await pickup.save();

        await pickup.populate('citizenId', 'name email mobile');
        await pickup.populate('assignedCollectorId', 'name email mobile');

        res.status(200).json({
            success: true,
            message: 'Collector assigned successfully',
            data: pickup
        });
    } catch (error) {
        console.error('Assign collector error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign collector',
            error: error.message
        });
    }
};