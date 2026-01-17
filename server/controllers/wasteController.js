import Waste from '../models/Waste.js';

// Logic to get all logs for a specific user
export const getUserWasteHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Finding logs where 'citizen' matches the logged-in user's ID
        const history = await Waste.find({ citizen: userId }).sort({ createdAt: -1 });
        
        res.status(200).json(history);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Failed to fetch waste history", 
            error: error.message 
        });
    }
};

// Logic to log new waste
export const logWaste = async (req, res) => {
    try {
        const { citizen, material, weight } = req.body;
        const newWaste = new Waste({
            citizen,
            material,
            weight,
            pointsEarned: Number(weight) * 10 
        });
        await newWaste.save();
        res.status(201).json({ success: true, message: "Waste logged successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};