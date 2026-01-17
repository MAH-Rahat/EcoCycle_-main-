import Pickup from '../models/Pickup.js';
// --- IMPORT ADDED ---
import Waste from '../models/Waste.js'; 

export const createPickup = async (req, res) => {
    try {
        const { citizen, wasteItem, address, scheduledDate, timeSlot } = req.body;
        
        // 1. Create and Save the new Pickup
        const newPickup = new Pickup({
            citizen,
            wasteItem,
            address,
            scheduledDate,
            timeSlot
        });

        await newPickup.save();

        // --- UPDATED LOGIC TO BLOCK BUTTON ---
        // 2. Update the specific Waste item to mark it as requested
        // This ensures pickupDetails.isRequested becomes true in MongoDB
        await Waste.findByIdAndUpdate(
            wasteItem, 
            { 
                $set: { 
                    'pickupDetails.isRequested': true,
                    'pickupDetails.address': address,
                    'pickupDetails.requestedTime': new Date(scheduledDate)
                } 
            },
            { new: true }
        );

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
        const pickups = await Pickup.find({ citizen: req.params.userId }).populate('wasteItem');
        res.status(200).json(pickups);
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: "Error fetching pickups" 
        });
    }
};