import Pickup from '../models/Pickup.js';
import WasteLog, { Waste } from '../models/Waste.js'; 

// --- CREATE PICKUP & SYNC WITH WASTELOG ---
export const createPickup = async (req, res) => {
    try {
        let { citizenId, wasteLogIds, address, scheduledTime, priority, notes, wasteItem, citizen } = req.body;
        
        // Support all variations of citizen/user identification passed from client or token
        let resolvedCitizenId = citizenId || citizen;
        if (!resolvedCitizenId && req.user) {
            resolvedCitizenId = req.user.id || req.user._id;
        }

        // Support both wasteLogIds array and single wasteItem ID from modal
        let targetWasteIds = wasteLogIds || [];
        if (wasteItem && !targetWasteIds.includes(wasteItem)) {
            targetWasteIds.push(wasteItem);
        }

        // Calculate estimated weight and pull details from waste logs if provided
        let estimatedWeight = 1;
        if (targetWasteIds.length > 0) {
            const wasteLogs = await WasteLog.find({ _id: { $in: targetWasteIds } });
            const legacyWaste = await Waste.find({ _id: { $in: targetWasteIds } });
            const combinedLogs = [...wasteLogs, ...legacyWaste];
            
            estimatedWeight = combinedLogs.reduce((sum, log) => sum + (Number(log.weight) || 0), 0) || 1;
            
            // If citizenId wasn't provided directly, try to pull it from the first waste log entry
            if (!resolvedCitizenId && combinedLogs.length > 0) {
                resolvedCitizenId = combinedLogs[0].citizenId || combinedLogs[0].citizen;
            }
        }

        // Normalize address format
        let formattedAddress = {
            street: 'Dhaka Central',
            city: 'Dhaka',
            zipCode: '1000',
            coordinates: { type: 'Point', coordinates: [90.4125, 23.8103] }
        };

        if (typeof address === 'string') {
            formattedAddress.street = address;
        } else if (address && typeof address === 'object') {
            formattedAddress.street = address.street || 'Dhaka Central';
            formattedAddress.city = address.city || 'Dhaka';
            formattedAddress.zipCode = address.zipCode || '1000';
            if (address.coordinates) {
                formattedAddress.coordinates = address.coordinates;
            }
        }
        
        const newPickup = new Pickup({
            citizenId: resolvedCitizenId || undefined,
            wasteLogIds: targetWasteIds,
            address: formattedAddress,
            scheduledTime: scheduledTime || new Date(),
            priority: priority || 'medium',
            estimatedWeight,
            notes: notes || '',
            status: 'pending'
        });

        await newPickup.save();

        // Update waste logs to mark as requested so citizen activity view reflects 'Scheduled'
        if (targetWasteIds.length > 0) {
            await WasteLog.updateMany(
                { _id: { $in: targetWasteIds } }, 
                { 
                    $set: { 
                        'pickupDetails.isRequested': true,
                        'pickupDetails.address': formattedAddress.street,
                        'pickupDetails.requestedTime': scheduledTime || new Date(),
                        'pickupStatus': 'Requested'
                    } 
                }
            );

            await Waste.updateMany(
                { _id: { $in: targetWasteIds } }, 
                { 
                    $set: { 
                        'pickupDetails.isRequested': true,
                        'pickupDetails.address': formattedAddress.street,
                        'pickupDetails.requestedTime': scheduledTime || new Date(),
                        'pickupStatus': 'Requested'
                    } 
                }
            );
        }

        res.status(201).json({ 
            success: true,
            message: "Pickup scheduled successfully!", 
            data: newPickup 
        });
    } catch (error) {
        console.error("Pickup Scheduling Error:", error);
        res.status(500).json({ 
            success: false,
            message: "Error scheduling pickup", 
            error: error.message 
        });
    }
};

export const getPickupsByCitizen = async (req, res) => {
    try {
        const pickups = await Pickup.find({ citizenId: req.params.userId })
            .populate('wasteLogIds')
            .populate('assignedCollectorId', 'name email');
        res.status(200).json(pickups);
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: "Error fetching pickups" 
        });
    }
};

// --- COLLECTOR & ADMIN LOGIC ---

export const getAvailablePickups = async (req, res) => {
    try {
        const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
        
        const pickups = await Pickup.find({ status: 'pending' })
            .populate('citizenId', 'name mobile email')
            .populate('wasteLogIds')
            .sort({ createdAt: 1 });
            
        const sortedPickups = pickups.sort((a, b) => {
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return a.createdAt.getTime() - b.createdAt.getTime();
        });
        
        res.status(200).json(sortedPickups);
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching available pickups" });
    }
};

export const updatePickupStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, collectorId } = req.body;

        const updateData = { status };
        
        if (status === 'assigned' && collectorId) {
            updateData.assignedCollectorId = collectorId;
            updateData.assignedAt = new Date();
        }

        const updatedPickup = await Pickup.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );

        res.status(200).json({ success: true, data: updatedPickup });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error updating status" });
    }
};

export const assignPickup = async (req, res) => {
    try {
        const { id } = req.params;
        const { collectorId } = req.body;

        const pickup = await Pickup.findById(id);
        if (!pickup) {
            return res.status(404).json({ success: false, message: "Pickup not found" });
        }

        pickup.status = 'assigned';
        pickup.assignedCollectorId = collectorId;
        pickup.assignedAt = new Date();
        
        await pickup.save();

        res.status(200).json({ success: true, data: pickup });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error assigning pickup" });
    }
};

export const getCollectorPickups = async (req, res) => {
    try {
        const { collectorId } = req.params;
        const { status } = req.query;

        const query = { assignedCollectorId: collectorId };
        if (status) {
            query.status = status;
        }

        const pickups = await Pickup.find(query)
            .populate('citizenId', 'name mobile email')
            .populate('wasteLogIds')
            .sort({ assignedAt: -1 });

        res.status(200).json({ success: true, data: pickups });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching collector pickups" });
    }
};

export const completePickup = async (req, res) => {
    try {
        const { id } = req.params;
        const { actualWeight, notes, photos, collectorId } = req.body;

        const pickup = await Pickup.findById(id);
        if (!pickup) {
            return res.status(404).json({ success: false, message: "Pickup not found" });
        }

        const result = pickup.completePickup(collectorId, {
            actualWeight,
            notes,
            photos
        });

        if (!result.success) {
            return res.status(400).json({ success: false, message: result.message });
        }

        await pickup.save();

        res.status(200).json({ 
            success: true, 
            message: result.message,
            data: pickup.getCollectionReport()
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error completing pickup" });
    }
};

export const cancelPickup = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, userId } = req.body;

        const pickup = await Pickup.findById(id);
        if (!pickup) {
            return res.status(404).json({ success: false, message: "Pickup not found" });
        }

        const result = pickup.cancelPickup(userId, reason);

        if (!result.success) {
            return res.status(400).json({ success: false, message: result.message });
        }

        await pickup.save();

        res.status(200).json({ 
            success: true, 
            message: result.message,
            data: pickup
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error cancelling pickup" });
    }
};