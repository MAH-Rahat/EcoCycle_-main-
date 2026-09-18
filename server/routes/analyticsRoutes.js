// Add or update this route inside your server/routes/analyticsRoutes.js or server/controllers/analyticsController.js
import express from 'express';
import { Waste } from '../models/Waste.js';
import WasteLog from '../models/Waste.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/waste-stats', protect, authorize('admin'), async (req, res) => {
    try {
        const legacyWaste = await Waste.find().lean();
        const modernLogs = await WasteLog.find().lean();

        const allRecords = [...legacyWaste, ...modernLogs];

        let globalTotal = 0;
        const areaMap = {};

        allRecords.forEach(record => {
            const weight = Number(record.weight) || 0;
            globalTotal += weight;

            // Extract area/city from address string or location object
            let area = 'Dhaka Central';
            const addressStr = record.pickupDetails?.address || record.location?.address?.street || '';
            
            if (addressStr) {
                const parts = addressStr.split(',');
                if (parts.length > 1) {
                    area = parts[parts.length - 1].trim(); // Get division or city part
                }
            }

            areaMap[area] = (areaMap[area] || 0) + weight;
        });

        const areaStats = Object.keys(areaMap).map(area => ({
            _id: area,
            totalWeight: areaMap[area]
        })).sort((a, b) => b.totalWeight - a.totalWeight);

        res.status(200).json({
            globalTotal: Math.round(globalTotal),
            totalRequests: allRecords.length,
            areaStats
        });
    } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ message: 'Server error fetching analytics stats' });
    }
});

export default router;