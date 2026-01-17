import express from 'express';
import Waste from '../models/Waste.js';
import Pickup from '../models/Pickup.js';

const router = express.Router();

router.get('/waste-stats', async (req, res) => {
    try {
        const areaStats = await Waste.aggregate([
            {
                // Join Waste with Pickups to get the geographical address
                $lookup: {
                    from: 'pickups',       // The MongoDB collection name for Pickups
                    localField: '_id',     // The _id of the Waste document
                    foreignField: 'wasteItem', // The field in Pickup model (matched to your model)
                    as: 'locationInfo'
                }
            },
            {
                // Extract the address from the joined locationInfo array
                $addFields: {
                    address: { $arrayElemAt: ["$locationInfo.address", 0] }
                }
            },
            {
                // Group by the address extracted from the Pickup
                $group: {
                    _id: { $ifNull: [ "$address", "Unspecified Area" ] },
                    totalWeight: { $sum: "$weight" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { totalWeight: -1 } }
        ]);

        // Calculate the total weight across all groups
        const globalTotal = areaStats.reduce((acc, curr) => acc + (curr.totalWeight || 0), 0);
        
        res.status(200).json({
            areaStats,
            globalTotal: globalTotal.toFixed(1),
            totalRequests: await Waste.countDocuments()
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;