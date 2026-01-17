import express from 'express';
import Waste from '../models/Waste.js'; 
import User from '../models/User.js'; 

const router = express.Router();

// 1. Fetch ALL for Admin (Handles Deleted Users & History)
router.get('/all', async (req, res) => {
    try {
        const waste = await Waste.find()
            .populate('citizen', 'name email mobile')
            .sort({ createdAt: -1 });

        const sanitizedWaste = waste.map(item => {
            const wasteObj = item.toObject();
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

// 2. Log Waste (POINTS REMOVED FROM HERE)
router.post('/log', async (req, res) => {
    const { citizenId, material, weight, photo, pickupDetails } = req.body; 
    try {
        const waste = await Waste.create({
            citizen: citizenId,
            material,
            weight,
            photo,
            status: 'Pending',
            pickupDetails: pickupDetails 
        });
        
        // We no longer update the User points here. 
        // Points are only awarded upon Admin approval.

        res.status(201).json(waste);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 3. Update Status (POINTS ADDED HERE UPON ACCEPTANCE)
router.put('/status/:id', async (req, res) => {
    const { status, collectorId, note } = req.body; 
    const wasteId = req.params.id;

    if (!['Accepted', 'Collected', 'Rejected', 'On Hold'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided.' });
    }

    try {
        // Find the waste record first to check current status and get details
        const wasteItem = await Waste.findById(wasteId);
        if (!wasteItem) {
            return res.status(404).json({ message: 'Waste item not found.' });
        }

        // PREVENT DOUBLE POINTING: 
        // Only award points if the status is changing TO Accepted from something else (like Pending or On Hold)
        const isAlreadyAccepted = wasteItem.status === 'Accepted' || wasteItem.status === 'Collected';

        const updateFields = { status };
        if (status === 'Accepted' && collectorId) updateFields.collector = collectorId;
        if (note) updateFields.adminNote = note;

        const updatedWaste = await Waste.findByIdAndUpdate(
            wasteId, 
            updateFields, 
            { new: true }
        ).populate('citizen', 'name email mobile');

        // AWARD POINTS ONLY IF ADMIN ACCEPTS AND IT WASN'T PREVIOUSLY AWARDED
        if (status === 'Accepted' && !isAlreadyAccepted) {
            const pointsEarned = Math.floor(updatedWaste.weight * 10);
            await User.findByIdAndUpdate(updatedWaste.citizen._id, { 
                $inc: { points: pointsEarned } 
            });
            console.log(`Awarded ${pointsEarned} points to user ${updatedWaste.citizen.name}`);
        }

        res.status(200).json(updatedWaste);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Could not update waste status.' });
    }
});

// 4. Stats & User History
router.get('/stats/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const totalItems = await Waste.countDocuments({ citizen: userId, status: { $ne: 'Rejected' } });
        const user = await User.findById(userId).select('points');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        res.status(200).json({ points: user.points, itemsLogged: totalItems });
    } catch (error) {
        res.status(500).json({ message: 'Could not fetch user stats.' });
    }
});

router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const history = await Waste.find({ citizen: userId }).sort({ createdAt: -1 });
        res.status(200).json(history);
    } catch (error) {
        res.status(500).json({ message: 'Could not fetch waste history.' });
    }
});

export default router;