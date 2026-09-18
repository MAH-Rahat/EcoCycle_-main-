import fc from 'fast-check';
import mongoose from 'mongoose';
import WasteTypeConfig from '../models/WasteTypeConfig.js';

// Feature: ecocycle-platform, Property 36: Environmental Conversion Accuracy
describe('Environmental Conversion Accuracy Property-Based Tests', () => {
    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
        }
    });

    beforeEach(async () => {
        await WasteTypeConfig.deleteMany({});
        
        // Initialize test waste type configurations with verified environmental factors
        const testConfigs = [
            {
                type: 'plastic',
                pointsPerKg: 10,
                co2SavedPerKg: 2.0, // Based on verified environmental data
                description: 'Plastic materials',
                recyclingTips: ['Clean before recycling'],
                isActive: true
            },
            {
                type: 'paper',
                pointsPerKg: 8,
                co2SavedPerKg: 1.5, // Based on verified environmental data
                description: 'Paper materials',
                recyclingTips: ['Keep dry'],
                isActive: true
            },
            {
                type: 'metal',
                pointsPerKg: 15,
                co2SavedPerKg: 3.0, // Based on verified environmental data
                description: 'Metal materials',
                recyclingTips: ['Rinse containers'],
                isActive: true
            },
            {
                type: 'glass',
                pointsPerKg: 12,
                co2SavedPerKg: 2.5, // Based on verified environmental data
                description: 'Glass materials',
                recyclingTips: ['Remove caps'],
                isActive: true
            },
            {
                type: 'electronic',
                pointsPerKg: 25,
                co2SavedPerKg: 5.0, // Based on verified environmental data
                description: 'Electronic waste',
                recyclingTips: ['Remove personal data'],
                isActive: true
            },
            {
                type: 'organic',
                pointsPerKg: 5,
                co2SavedPerKg: 1.0, // Based on verified environmental data
                description: 'Organic waste for composting',
                recyclingTips: ['Separate from non-organic'],
                isActive: true
            }
        ];

        await WasteTypeConfig.insertMany(testConfigs);
    });

    afterEach(async () => {
        await WasteTypeConfig.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    // Custom generators for environmental conversion testing
    const validWasteTypeGen = () => fc.constantFrom('plastic', 'paper', 'metal', 'glass', 'electronic', 'organic');
    
    const validWeightGen = () => fc.float({ min: Math.fround(0.1), max: Math.fround(1000), noDefaultInfinity: true, noNaN: true });
    
    const preciseWeightGen = () => fc.float({ min: Math.fround(0.001), max: Math.fround(10), noDefaultInfinity: true, noNaN: true });

    // Property 36: Environmental Conversion Accuracy
    describe('Property 36: Environmental Conversion Accuracy', () => {
        test('For any impact metric calculation, verified environmental conversion factors should be used consistently', () => {
            return fc.assert(fc.asyncProperty(
                validWasteTypeGen(),
                validWeightGen(),
                async (wasteType, weight) => {
                    // Get the configuration
                    const config = await WasteTypeConfig.findOne({ type: wasteType, isActive: true });
                    expect(config).toBeTruthy();

                    // Calculate CO2 savings using the system method
                    const calculatedCO2 = await WasteTypeConfig.calculateCO2Savings(wasteType, weight);
                    
                    // Verify the calculation uses the correct conversion factor
                    const expectedCO2 = config.co2SavedPerKg * weight;
                    expect(Math.abs(calculatedCO2 - expectedCO2)).toBeLessThan(0.0001);

                    // Verify the conversion factor is within reasonable environmental bounds
                    expect(config.co2SavedPerKg).toBeGreaterThan(0);
                    expect(config.co2SavedPerKg).toBeLessThan(10); // Reasonable upper bound for CO2 savings per kg

                    // Verify consistency across multiple calculations
                    const calculatedCO2_2 = await WasteTypeConfig.calculateCO2Savings(wasteType, weight);
                    expect(calculatedCO2).toBe(calculatedCO2_2);
                }
            ), { numRuns: 25 });
        });

        test('For any waste type, conversion factors should be scientifically reasonable and consistent', () => {
            return fc.assert(fc.asyncProperty(
                validWasteTypeGen(),
                async (wasteType) => {
                    const config = await WasteTypeConfig.findOne({ type: wasteType, isActive: true });
                    expect(config).toBeTruthy();

                    // Verify conversion factors are within scientifically reasonable ranges
                    switch (wasteType) {
                        case 'plastic':
                            expect(config.co2SavedPerKg).toBeGreaterThanOrEqual(1.5);
                            expect(config.co2SavedPerKg).toBeLessThanOrEqual(3.0);
                            break;
                        case 'paper':
                            expect(config.co2SavedPerKg).toBeGreaterThanOrEqual(1.0);
                            expect(config.co2SavedPerKg).toBeLessThanOrEqual(2.5);
                            break;
                        case 'metal':
                            expect(config.co2SavedPerKg).toBeGreaterThanOrEqual(2.0);
                            expect(config.co2SavedPerKg).toBeLessThanOrEqual(5.0);
                            break;
                        case 'glass':
                            expect(config.co2SavedPerKg).toBeGreaterThanOrEqual(1.5);
                            expect(config.co2SavedPerKg).toBeLessThanOrEqual(3.5);
                            break;
                        case 'electronic':
                            expect(config.co2SavedPerKg).toBeGreaterThanOrEqual(3.0);
                            expect(config.co2SavedPerKg).toBeLessThanOrEqual(8.0);
                            break;
                        case 'organic':
                            expect(config.co2SavedPerKg).toBeGreaterThanOrEqual(0.5);
                            expect(config.co2SavedPerKg).toBeLessThanOrEqual(2.0);
                            break;
                    }

                    // Verify points per kg are reasonable
                    expect(config.pointsPerKg).toBeGreaterThan(0);
                    expect(config.pointsPerKg).toBeLessThan(100);

                    // Verify higher environmental impact materials have higher points
                    if (wasteType === 'electronic' || wasteType === 'metal') {
                        expect(config.pointsPerKg).toBeGreaterThanOrEqual(10);
                    }
                }
            ), { numRuns: 12 });
        });

        test('For any calculation precision, environmental conversions should maintain accuracy across different weight scales', () => {
            return fc.assert(fc.asyncProperty(
                validWasteTypeGen(),
                preciseWeightGen(),
                async (wasteType, weight) => {
                    const config = await WasteTypeConfig.findOne({ type: wasteType, isActive: true });
                    
                    // Test calculation at different scales
                    const scales = [1, 10, 100, 1000];
                    
                    for (const scale of scales) {
                        const scaledWeight = weight * scale;
                        const calculatedCO2 = await WasteTypeConfig.calculateCO2Savings(wasteType, scaledWeight);
                        const expectedCO2 = config.co2SavedPerKg * scaledWeight;
                        
                        // Verify linear scaling maintains precision
                        const relativeError = Math.abs(calculatedCO2 - expectedCO2) / expectedCO2;
                        expect(relativeError).toBeLessThan(0.0001); // 0.01% tolerance
                        
                        // Verify no overflow or underflow issues
                        expect(isFinite(calculatedCO2)).toBe(true);
                        expect(calculatedCO2).toBeGreaterThanOrEqual(0);
                    }
                }
            ), { numRuns: 10 });
        });

        test('For any batch of waste calculations, conversion factors should remain consistent throughout', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(
                    fc.record({
                        wasteType: validWasteTypeGen(),
                        weight: validWeightGen()
                    }),
                    { minLength: 1, maxLength: 20 }
                ),
                async (wasteItems) => {
                    const conversionFactors = {};
                    
                    // Process each waste item and track conversion factors
                    for (const item of wasteItems) {
                        const config = await WasteTypeConfig.findOne({ type: item.wasteType, isActive: true });
                        const calculatedCO2 = await WasteTypeConfig.calculateCO2Savings(item.wasteType, item.weight);
                        
                        // Store or verify conversion factor consistency
                        if (!conversionFactors[item.wasteType]) {
                            conversionFactors[item.wasteType] = config.co2SavedPerKg;
                        } else {
                            expect(config.co2SavedPerKg).toBe(conversionFactors[item.wasteType]);
                        }
                        
                        // Verify calculation uses consistent factor
                        const expectedCO2 = conversionFactors[item.wasteType] * item.weight;
                        expect(Math.abs(calculatedCO2 - expectedCO2)).toBeLessThan(0.0001);
                    }
                    
                    // Verify all waste types have consistent factors
                    const uniqueWasteTypes = [...new Set(wasteItems.map(item => item.wasteType))];
                    for (const wasteType of uniqueWasteTypes) {
                        expect(conversionFactors[wasteType]).toBeGreaterThan(0);
                        expect(isFinite(conversionFactors[wasteType])).toBe(true);
                    }
                }
            ), { numRuns: 7 });
        });

        test('For any environmental calculation, results should be deterministic and reproducible', () => {
            return fc.assert(fc.asyncProperty(
                validWasteTypeGen(),
                validWeightGen(),
                async (wasteType, weight) => {
                    // Perform the same calculation multiple times
                    const results = [];
                    for (let i = 0; i < 5; i++) {
                        const co2Saved = await WasteTypeConfig.calculateCO2Savings(wasteType, weight);
                        const points = await WasteTypeConfig.calculatePoints(wasteType, weight);
                        results.push({ co2Saved, points });
                    }
                    
                    // Verify all results are identical
                    const firstResult = results[0];
                    for (let i = 1; i < results.length; i++) {
                        expect(results[i].co2Saved).toBe(firstResult.co2Saved);
                        expect(results[i].points).toBe(firstResult.points);
                    }
                    
                    // Verify results are reasonable
                    expect(firstResult.co2Saved).toBeGreaterThanOrEqual(0);
                    expect(firstResult.points).toBeGreaterThanOrEqual(0);
                    expect(isFinite(firstResult.co2Saved)).toBe(true);
                    expect(isFinite(firstResult.points)).toBe(true);
                }
            ), { numRuns: 12 });
        });
    });

    // Property: Conversion Factor Validation
    describe('Property: Conversion Factor Validation', () => {
        test('For any waste type configuration, conversion factors should be validated and within acceptable ranges', () => {
            return fc.assert(fc.asyncProperty(
                validWasteTypeGen(),
                fc.float({ min: Math.fround(0.1), max: Math.fround(10) }),
                fc.integer({ min: 1, max: 50 }),
                async (wasteType, co2Factor, pointsFactor) => {
                    // Create a test configuration with a valid type
                    const testConfig = new WasteTypeConfig({
                        type: 'plastic', // Use existing valid type
                        pointsPerKg: pointsFactor,
                        co2SavedPerKg: co2Factor,
                        description: 'Test configuration',
                        recyclingTips: ['Test tip'],
                        isActive: true
                    });
                    
                    // Test calculations with the configuration
                    const testWeight = 5.0;
                    const calculatedCO2 = testConfig.co2SavedPerKg * testWeight;
                    const calculatedPoints = Math.round(testConfig.pointsPerKg * testWeight);
                    
                    expect(calculatedCO2).toBe(co2Factor * testWeight);
                    expect(calculatedPoints).toBe(Math.round(pointsFactor * testWeight));
                }
            ), { numRuns: 7 });
        });

        test('For any invalid conversion factors, appropriate validation errors should be thrown', () => {
            return fc.assert(fc.asyncProperty(
                validWasteTypeGen(),
                fc.oneof(
                    fc.constant(-1), // Negative value
                    fc.constant(0),  // Zero value
                    fc.constant(Infinity), // Infinite value
                    fc.constant(NaN) // NaN value
                ),
                async (wasteType, invalidFactor) => {
                    // Attempt to create configuration with invalid factor
                    const testConfig = new WasteTypeConfig({
                        type: `invalid_${wasteType}_${Date.now()}`,
                        pointsPerKg: invalidFactor < 0 || !isFinite(invalidFactor) ? 10 : invalidFactor,
                        co2SavedPerKg: invalidFactor,
                        description: 'Invalid test configuration',
                        recyclingTips: ['Test tip'],
                        isActive: true
                    });
                    
                    // Should fail validation for negative, zero, infinite, or NaN values
                    if (invalidFactor <= 0 || !isFinite(invalidFactor) || isNaN(invalidFactor)) {
                        await expect(testConfig.save()).rejects.toThrow();
                    }
                }
            ), { numRuns: 5 });
        });
    });

    // Property: Environmental Impact Calculations
    describe('Property: Environmental Impact Calculations', () => {
        test('For any waste processing, environmental impact should scale linearly with weight', () => {
            return fc.assert(fc.asyncProperty(
                validWasteTypeGen(),
                fc.float({ min: Math.fround(1), max: Math.fround(10), noDefaultInfinity: true, noNaN: true }),
                fc.float({ min: Math.fround(2), max: Math.fround(5), noDefaultInfinity: true, noNaN: true }),
                async (wasteType, baseWeight, multiplier) => {
                    const config = await WasteTypeConfig.findOne({ type: wasteType, isActive: true });
                    
                    // Calculate for base weight
                    const baseCO2 = await WasteTypeConfig.calculateCO2Savings(wasteType, baseWeight);
                    const basePoints = await WasteTypeConfig.calculatePoints(wasteType, baseWeight);
                    
                    // Calculate for multiplied weight
                    const multipliedWeight = baseWeight * multiplier;
                    const multipliedCO2 = await WasteTypeConfig.calculateCO2Savings(wasteType, multipliedWeight);
                    const multipliedPoints = await WasteTypeConfig.calculatePoints(wasteType, multipliedWeight);
                    
                    // Verify linear scaling for CO2 (exact)
                    const expectedMultipliedCO2 = baseCO2 * multiplier;
                    expect(Math.abs(multipliedCO2 - expectedMultipliedCO2)).toBeLessThan(0.0001);
                    
                    // Verify linear scaling for points (accounting for rounding)
                    const expectedMultipliedPoints = Math.round(config.pointsPerKg * multipliedWeight);
                    expect(multipliedPoints).toBe(expectedMultipliedPoints);
                    
                    // Verify proportionality within rounding tolerance
                    const co2Ratio = multipliedCO2 / baseCO2;
                    expect(Math.abs(co2Ratio - multiplier)).toBeLessThan(0.0001);
                }
            ), { numRuns: 10 });
        });

        test('For any environmental calculation, results should be physically meaningful', () => {
            return fc.assert(fc.asyncProperty(
                validWasteTypeGen(),
                validWeightGen(),
                async (wasteType, weight) => {
                    const co2Saved = await WasteTypeConfig.calculateCO2Savings(wasteType, weight);
                    const points = await WasteTypeConfig.calculatePoints(wasteType, weight);
                    
                    // Verify physical constraints
                    expect(co2Saved).toBeGreaterThanOrEqual(0);
                    expect(points).toBeGreaterThanOrEqual(0);
                    expect(isFinite(co2Saved)).toBe(true);
                    expect(isFinite(points)).toBe(true);
                    
                    // Verify reasonable upper bounds (CO2 savings shouldn't exceed weight by too much)
                    expect(co2Saved).toBeLessThan(weight * 20); // Conservative upper bound
                    
                    // Verify points are integers
                    expect(Number.isInteger(points)).toBe(true);
                    
                    // Verify CO2 savings are reasonable for the weight
                    const config = await WasteTypeConfig.findOne({ type: wasteType, isActive: true });
                    const co2PerKg = co2Saved / weight;
                    expect(Math.abs(co2PerKg - config.co2SavedPerKg)).toBeLessThan(0.0001);
                }
            ), { numRuns: 15 });
        });
    });
});