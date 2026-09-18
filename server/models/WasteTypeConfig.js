import mongoose from 'mongoose';

const wasteTypeConfigSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        unique: true,
        enum: ['plastic', 'paper', 'metal', 'glass', 'electronic', 'organic', 'hazardous']
    },
    pointsPerKg: {
        type: Number,
        required: true,
        min: 0
    },
    co2SavedPerKg: {
        type: Number,
        required: true,
        min: 0,
        description: 'CO2 saved in kg per kg of waste recycled'
    },
    description: {
        type: String,
        required: true
    },
    recyclingTips: [{
        type: String
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Static method to calculate points for waste
wasteTypeConfigSchema.statics.calculatePoints = async function(wasteType, weight) {
    const config = await this.findOne({ type: wasteType.toLowerCase(), isActive: true });
    
    if (!config) {
        throw new Error(`No configuration found for waste type: ${wasteType}`);
    }
    
    return Math.round(config.pointsPerKg * weight);
};

// Static method to calculate CO2 savings
wasteTypeConfigSchema.statics.calculateCO2Savings = async function(wasteType, weight) {
    const config = await this.findOne({ type: wasteType.toLowerCase(), isActive: true });
    
    if (!config) {
        throw new Error(`No configuration found for waste type: ${wasteType}`);
    }
    
    return config.co2SavedPerKg * weight;
};

// Static method to get all active waste types
wasteTypeConfigSchema.statics.getActiveTypes = function() {
    return this.find({ isActive: true }).sort({ type: 1 });
};

const WasteTypeConfig = mongoose.model('WasteTypeConfig', wasteTypeConfigSchema);

// Initialize default configurations
const initializeDefaultConfigs = async () => {
    const existingConfigs = await WasteTypeConfig.countDocuments();
    
    if (existingConfigs === 0) {
        const defaultConfigs = [
            {
                type: 'plastic',
                pointsPerKg: 10,
                co2SavedPerKg: 2.0,
                description: 'Plastic bottles, containers, and packaging materials',
                recyclingTips: [
                    'Clean containers before recycling',
                    'Remove caps and labels when possible',
                    'Check recycling codes on plastic items'
                ]
            },
            {
                type: 'paper',
                pointsPerKg: 8,
                co2SavedPerKg: 1.5,
                description: 'Newspapers, magazines, cardboard, and office paper',
                recyclingTips: [
                    'Keep paper dry and clean',
                    'Remove staples and plastic windows from envelopes',
                    'Flatten cardboard boxes to save space'
                ]
            },
            {
                type: 'metal',
                pointsPerKg: 15,
                co2SavedPerKg: 3.0,
                description: 'Aluminum cans, steel cans, and metal containers',
                recyclingTips: [
                    'Rinse containers to remove food residue',
                    'Aluminum cans are infinitely recyclable',
                    'Separate different types of metals when possible'
                ]
            },
            {
                type: 'glass',
                pointsPerKg: 12,
                co2SavedPerKg: 2.5,
                description: 'Glass bottles and jars',
                recyclingTips: [
                    'Remove caps and lids',
                    'Rinse to remove food residue',
                    'Separate by color when required by local facilities'
                ]
            },
            {
                type: 'electronic',
                pointsPerKg: 25,
                co2SavedPerKg: 5.0,
                description: 'Electronic devices, batteries, and computer equipment',
                recyclingTips: [
                    'Remove personal data from devices',
                    'Take to certified e-waste recycling centers',
                    'Never throw electronics in regular trash'
                ]
            },
            {
                type: 'organic',
                pointsPerKg: 5,
                co2SavedPerKg: 1.0,
                description: 'Food scraps and yard waste for composting',
                recyclingTips: [
                    'Separate from non-organic materials',
                    'Consider home composting',
                    'Avoid meat and dairy in home compost'
                ]
            },
            {
                type: 'hazardous',
                pointsPerKg: 3,
                co2SavedPerKg: 0.5,
                description: 'Mixed or hazardous materials requiring special handling',
                recyclingTips: [
                    'Check with local recycling guidelines',
                    'When in doubt, contact your waste management provider',
                    'Consider reducing consumption of hard-to-recycle items'
                ]
            }
        ];
        
        await WasteTypeConfig.insertMany(defaultConfigs);
        console.log('✅ Default waste type configurations initialized');
    }
};

// Call initialization when the model is loaded
initializeDefaultConfigs().catch(console.error);

export default WasteTypeConfig;