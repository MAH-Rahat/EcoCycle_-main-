import express from 'express';
import mongoose from 'mongoose';
import { 
    logWaste, 
    updateWasteStatus,
    getWasteTypeConfigs,
    getScheduledPickups,
    assignCollectorToPickup
} from '../controllers/wasteController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import WasteLog, { Waste } from '../models/Waste.js'; 
import User from '../models/User.js'; 

const router = express.Router();

// Protected routes - require authentication
router.use(protect);

// GET /api/waste/types - Get waste type configurations
router.get('/types', getWasteTypeConfigs);

// --- NEW DISPATCHER ROUTES FOR ADMIN PICKUP ASSIGNMENTS ---
router.get('/admin/pickups', authorize('admin'), getScheduledPickups);
router.put('/admin/assign/:id', authorize('admin'), assignCollectorToPickup);
// ---------------------------------------------------------

// GET /api/waste/user/:userId - Get waste history for a specific user (Combined from both models)
router.get('/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        let queryIds = [userId];
        if (mongoose.Types.ObjectId.isValid(userId)) {
            queryIds.push(new mongoose.Types.ObjectId(userId));
        }

        const legacyUserWaste = await Waste.find({
            $or: [
                { citizen: { $in: queryIds } }, 
                { citizenId: { $in: queryIds } }
            ]
        }).lean();

        const modernUserWasteLogs = await WasteLog.find({
            $or: [
                { citizen: { $in: queryIds } }, 
                { citizenId: { $in: queryIds } }
            ]
        }).lean();

        const combinedHistory = [...legacyUserWaste, ...modernUserWasteLogs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.status(200).json(combinedHistory);
    } catch (error) {
        console.error("Get User Waste History Error:", error);
        res.status(500).json({ message: 'Error fetching user waste history' });
    }
});

// POST /api/waste/log - Log new waste
router.post('/log', logWaste);

// GET /api/waste/all - Get all waste logs (admin only) - COMBINED FROM BOTH COLLECTIONS
router.get('/all', authorize('admin'), async (req, res) => {
    try {
        const legacyWaste = await Waste.find().populate('citizen', 'name email mobile').lean();
        const modernWasteLogs = await WasteLog.find().populate('citizenId', 'name email mobile').lean();

        const normalizedLogs = modernWasteLogs.map(log => ({
            _id: log._id,
            citizen: log.citizenId || log.citizen || {
                name: 'Deleted User',
                email: 'N/A',
                mobile: 'N/A',
                isDeleted: true
            },
            material: log.material || (log.wasteType ? log.wasteType.charAt(0).toUpperCase() + log.wasteType.slice(1) : 'Plastic'),
            weight: log.weight,
            photo: log.photo || (log.photos && log.photos[0]) || null,
            status: log.status === 'pending' ? 'Pending' : log.status === 'verified' ? 'Accepted' : log.status === 'rejected' ? 'Rejected' : 'Pending',
            pickupDetails: log.pickupDetails || { address: log.location?.address?.street || 'N/A' },
            createdAt: log.createdAt,
            updatedAt: log.updatedAt
        }));

        const combinedWaste = [...legacyWaste, ...normalizedLogs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const sanitizedWaste = combinedWaste.map(item => {
            const wasteObj = { ...item };
            if (!wasteObj.citizen) {
                wasteObj.citizen = {
                    name: 'Deleted User',
                    email: 'N/A',
                    mobile: 'N/A',
                    isDeleted: true
                };
            }
            return wasteObj;
        });

        res.status(200).json(sanitizedWaste);
    } catch (error) {
        console.error("Fetch All Error:", error);
        res.status(500).json({ message: 'Error fetching all waste records' });
    }
});

// PUT /api/waste/status/:id - Update waste status (admin/collector only)
router.put('/status/:id', authorize('admin', 'collector'), updateWasteStatus);

// Legacy routes for backward compatibility
router.get('/legacy/all', authorize('admin'), async (req, res) => {
    try {
        const legacyWaste = await Waste.find().populate('citizen', 'name email mobile').lean();
        const modernWasteLogs = await WasteLog.find().populate('citizenId', 'name email mobile').lean();

        const normalizedLogs = modernWasteLogs.map(log => ({
            _id: log._id,
            citizen: log.citizenId || log.citizen || {
                name: 'Deleted User',
                email: 'N/A',
                mobile: 'N/A',
                isDeleted: true
            },
            material: log.material || (log.wasteType ? log.wasteType.charAt(0).toUpperCase() + log.wasteType.slice(1) : 'Plastic'),
            weight: log.weight,
            photo: log.photo || (log.photos && log.photos[0]) || null,
            status: log.status === 'pending' ? 'Pending' : log.status === 'verified' ? 'Accepted' : log.status === 'rejected' ? 'Rejected' : 'Pending',
            pickupDetails: log.pickupDetails || { address: log.location?.address?.street || 'N/A' },
            createdAt: log.createdAt,
            updatedAt: log.updatedAt
        }));

        const combinedWaste = [...legacyWaste, ...normalizedLogs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const sanitizedWaste = combinedWaste.map(item => {
            const wasteObj = { ...item };
            if (!wasteObj.citizen) {
                wasteObj.citizen = {
                    name: 'Deleted User',
                    email: 'N/A',
                    mobile: 'N/A',
                    isDeleted: true
                };
            }
            return wasteObj;
        });

        res.status(200).json(sanitizedWaste);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching all waste records' });
    }
});

// 2. Legacy Log Waste
router.post('/legacy/log', async (req, res) => {
    const { citizenId, material, weight, photo, pickupDetails } = req.body; 
    try {
        const materialMapping = {
            'Plastic': 'plastic',
            'Paper': 'paper',
            'Metal': 'metal',
            'Glass': 'glass',
            'E-Waste': 'electronic',
            'Organic': 'organic',
            'Other': 'hazardous'
        };

        const waste = await Waste.create({
            citizenId: citizenId,
            citizen: citizenId,
            material: material,
            wasteType: materialMapping[material] || 'plastic',
            weight: weight,
            photo: photo,
            photos: photo ? [photo] : [],
            status: 'pending',
            pickupDetails: pickupDetails,
            location: {
                address: {
                    street: pickupDetails?.address || 'N/A',
                    city: 'Dhaka',
                    zipCode: '1000'
                },
                coordinates: {
                    type: 'Point',
                    coordinates: [90.4125, 23.8103]
                }
            }
        });
        
        res.status(201).json(waste);
    } catch (error) {
        console.error("Legacy Log Route Error:", error);
        res.status(500).json({ message: error.message });
    }
});

// 3. Legacy Update Status & Verify Route
router.put('/legacy/status/:id', authorize('admin'), async (req, res) => {
    const { status, collectorId, note, isRequested } = req.body; 
    const wasteId = req.params.id;

    try {
        let wasteItem = await Waste.findById(wasteId);
        let isWasteLog = false;
        
        if (!wasteItem) {
            wasteItem = await WasteLog.findById(wasteId);
            isWasteLog = true;
        }

        if (!wasteItem) {
            return res.status(404).json({ message: 'Waste item not found.' });
        }

        const resolvedStatus = status || 'Accepted';
        const isAlreadyAccepted = wasteItem.status === 'Accepted' || wasteItem.status === 'Collected' || wasteItem.status === 'verified';

        const updateFields = { status: resolvedStatus === 'Accepted' ? 'verified' : resolvedStatus === 'Rejected' ? 'rejected' : resolvedStatus };
        if ((resolvedStatus === 'Accepted' || resolvedStatus === 'verified') && collectorId) updateFields.collector = collectorId;
        if (note) updateFields.adminNote = note;
        if (isRequested) {
            updateFields['pickupDetails.isRequested'] = true;
            updateFields['pickupDetails.requestedTime'] = new Date();
            updateFields.pickupStatus = 'Requested';
        }

        const ModelToUse = isWasteLog ? WasteLog : Waste;
        const updatedWaste = await ModelToUse.findByIdAndUpdate(
            wasteId, 
            updateFields, 
            { new: true }
        ).populate('citizen citizenId', 'name email mobile');

        if ((resolvedStatus === 'Accepted' || resolvedStatus === 'verified') && !isAlreadyAccepted) {
            const pointsEarned = Math.floor(updatedWaste.weight * 10);
            const targetCitizenId = updatedWaste.citizen?._id || updatedWaste.citizenId?._id || updatedWaste.citizenId || updatedWaste.citizen;
            if (targetCitizenId) {
                await User.findByIdAndUpdate(targetCitizenId, { 
                    $inc: { points: pointsEarned } 
                });
            }
        }

        res.status(200).json(updatedWaste);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Could not update waste status.' });
    }
});

// Support for /verify/:id route used in AdminDashboard
router.put('/verify/:id', authorize('admin'), async (req, res) => {
    const wasteId = req.params.id;
    try {
        let wasteItem = await Waste.findById(wasteId);
        let isWasteLog = false;
        if (!wasteItem) {
            wasteItem = await WasteLog.findById(wasteId);
            isWasteLog = true;
        }
        if (!wasteItem) return res.status(404).json({ message: 'Not found' });

        const ModelToUse = isWasteLog ? WasteLog : Waste;
        const updated = await ModelToUse.findByIdAndUpdate(wasteId, { status: 'verified' }, { new: true });
        
        const pointsEarned = Math.floor(updated.weight * 10);
        const targetId = updated.citizenId || updated.citizen;
        if (targetId) {
            await User.findByIdAndUpdate(targetId, { $inc: { points: pointsEarned } });
        }

        res.status(200).json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. Stats & User History
router.get('/stats/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        let queryIds = [userId];
        if (mongoose.Types.ObjectId.isValid(userId)) {
            queryIds.push(new mongoose.Types.ObjectId(userId));
        }

        const totalItems = await Waste.countDocuments({ 
            $or: [
                { citizen: { $in: queryIds }, status: { $nin: ['Rejected', 'rejected'] } },
                { citizenId: { $in: queryIds }, status: { $nin: ['Rejected', 'rejected'] } }
            ]
        });
        const user = await User.findById(userId).select('points');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        res.status(200).json({ points: user.points, itemsLogged: totalItems });
    } catch (error) {
        res.status(500).json({ message: 'Could not fetch user stats.' });
    }
});

export default router;