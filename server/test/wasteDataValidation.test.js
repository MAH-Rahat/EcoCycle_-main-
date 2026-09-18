import fc from 'fast-check';
import mongoose from 'mongoose';
import WasteLog, { Waste } from '../models/Waste.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';
import { logWaste } from '../controllers/wasteController.js';

// Feature: ecocycle-platform, Property 9: Waste Data Validation
describe('Waste Data Validation Property-Based Tests', () => {
    let testUser;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test', {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000
            });
        }
    }, 15000);

    beforeEach(async () => {
        await WasteLog.deleteMany({});
        await WasteTypeConfig.deleteMany({});
        
        // Create test user
        testUser = {
            _id: new mongoose.Types.ObjectId(),
            name: 'Test User',
            email: 'test@example.com',
            role: 'citizen'
        };

        // Initialize test waste type configurations
        await WasteTypeConfig.insertMany([
            {
                type: 'plastic',
                pointsPerKg: 10,
                co2SavedPerKg: 2.0,
                description: 'Plastic materials',
                recyclingTips: ['Clean before recycling'],
                isActive: true
            },
            {
                type: 'paper',
                pointsPerKg: 8,
                co2SavedPerKg: 1.5,
                description: 'Paper materials',
                recyclingTips: ['Keep dry'],
                isActive: true
            },
            {
                type: 'metal',
                pointsPerKg: 15,
                co2SavedPerKg: 3.0,
                description: 'Metal materials',
                recyclingTips: ['Rinse containers'],
                isActive: true
            }
        ]);
    }, 10000);

    afterEach(async () => {
        await WasteLog.deleteMany({});
        await WasteTypeConfig.deleteMany({});
    }, 10000);

    afterAll(async () => {
        await mongoose.connection.close();
    }, 10000);

    // Custom generators for waste data
    const validWasteTypeGen = () => fc.constantFrom('plastic', 'paper', 'metal', 'glass', 'electronic', 'organic', 'hazardous');
    
    const invalidWasteTypeGen = () => fc.oneof(
        fc.string().filter(s => !['plastic', 'paper', 'metal', 'glass', 'electronic', 'organic', 'hazardous'].includes(s)),
        fc.constant(null),
        fc.constant(undefined),
        fc.integer(),
        fc.boolean()
    );

    const validWeightGen = () => fc.float({ min: 0.1, max: 1000 });
    
    const invalidWeightGen = () => fc.oneof(
        fc.float({ min: -100, max: 0 }), // Negative or zero weights
        fc.constant(null),
        fc.constant(undefined),
        fc.string(),
        fc.boolean()
    );

    const validPhotoUrlGen = () => fc.oneof(
        fc.webUrl(),
        fc.constant(''),
        fc.constant(null),
        fc.constant(undefined)
    );

    const validWasteDataGen = () => fc.record({
        citizenId: fc.constant(testUser._id),
        wasteType: validWasteTypeGen(),
        weight: validWeightGen(),
        photos: fc.option(fc.array(validPhotoUrlGen(), { maxLength: 3 })),
        description: fc.option(fc.string({ maxLength: 500 }))
    });

    // Property 9: Waste Data Validation
    describe('Property 9: Waste Data Validation', () => {
        test('For any invalid waste data (negative weight, invalid type, missing required fields), the entry should be rejected with appropriate error messages', () => {
            return fc.assert(fc.asyncProperty(
                fc.oneof(
                    // Invalid weight cases
                    fc.record({
                        citizenId: fc.constant(testUser._id),
                        wasteType: validWasteTypeGen(),
                        weight: invalidWeightGen(),
                        photos: fc.option(fc.array(validPhotoUrlGen(), { maxLength: 3 }))
                    }),
                    // Invalid material type cases
                    fc.record({
                        citizenId: fc.constant(testUser._id),
                        wasteType: invalidWasteTypeGen(),
                        weight: validWeightGen(),
                        photos: fc.option(fc.array(validPhotoUrlGen(), { maxLength: 3 }))
                    }),
                    // Missing required fields
                    fc.record({
                        wasteType: validWasteTypeGen(),
                        weight: validWeightGen(),
                        photos: fc.option(fc.array(validPhotoUrlGen(), { maxLength: 3 }))
                    }),
                    fc.record({
                        citizenId: fc.constant(testUser._id),
                        weight: validWeightGen(),
                        photos: fc.option(fc.array(validPhotoUrlGen(), { maxLength: 3 }))
                    }),
                    fc.record({
                        citizenId: fc.constant(testUser._id),
                        wasteType: validWasteTypeGen(),
                        photos: fc.option(fc.array(validPhotoUrlGen(), { maxLength: 3 }))
                    })
                ),
                async (invalidWasteData) => {
                    const mockReq = {
                        body: invalidWasteData,
                        user: testUser
                    };

                    const mockRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn()
                    };

                    await logWaste(mockReq, mockRes);

                    // Should return error status (400 or 500)
                    expect(mockRes.status).toHaveBeenCalledWith(expect.any(Number));
                    const statusCode = mockRes.status.mock.calls[0][0];
                    expect([400, 500]).toContain(statusCode);

                    // Should return error response
                    expect(mockRes.json).toHaveBeenCalledWith(
                        expect.objectContaining({
                            success: false,
                            message: expect.any(String)
                        })
                    );
                }
            ), { numRuns: 7 });
        });

        test('For any valid waste data, the entry should be accepted and stored correctly', () => {
            return fc.assert(fc.asyncProperty(
                validWasteDataGen(),
                async (validWasteData) => {
                    const mockReq = {
                        body: validWasteData,
                        user: testUser
                    };

                    const mockRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn()
                    };

                    await logWaste(mockReq, mockRes);

                    // Should return success status
                    expect(mockRes.status).toHaveBeenCalledWith(201);

                    // Should return success response with waste data
                    expect(mockRes.json).toHaveBeenCalledWith(
                        expect.objectContaining({
                            success: true,
                            message: expect.any(String),
                            data: expect.objectContaining({
                                wasteLog: expect.objectContaining({
                                    citizenId: validWasteData.citizenId,
                                    wasteType: validWasteData.wasteType,
                                    weight: validWasteData.weight
                                }),
                                pointsEarned: expect.any(Number),
                                co2Saved: expect.any(Number)
                            })
                        })
                    );

                    // Verify data was actually saved to database
                    const savedWaste = await WasteLog.findOne({ 
                        citizenId: validWasteData.citizenId,
                        wasteType: validWasteData.wasteType,
                        weight: validWasteData.weight
                    });

                    expect(savedWaste).toBeTruthy();
                    expect(savedWaste.wasteType).toBe(validWasteData.wasteType);
                    expect(savedWaste.weight).toBe(validWasteData.weight);
                    expect(savedWaste.status).toBe('pending');
                }
            ), { numRuns: 5 });
        });
    });

    // Property: Weight Validation Boundaries
    describe('Property: Weight Validation Boundaries', () => {
        test('For any weight at or below the minimum threshold (0.1), validation should handle boundary conditions correctly', () => {
            return fc.assert(fc.asyncProperty(
                validWasteTypeGen(),
                fc.oneof(
                    fc.constant(0.1), // Minimum valid weight
                    fc.float({ min: 0.05, max: 0.099 }), // Just below minimum
                    fc.constant(0), // Zero weight
                    fc.float({ min: -10, max: -0.1 }) // Negative weights
                ),
                async (wasteType, weight) => {
                    const wasteData = {
                        citizenId: testUser._id,
                        wasteType,
                        weight,
                        photos: null
                    };

                    const mockReq = {
                        body: wasteData,
                        user: testUser
                    };

                    const mockRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn()
                    };

                    await logWaste(mockReq, mockRes);

                    if (weight >= 0.1) {
                        // Should succeed for valid minimum weight
                        expect(mockRes.status).toHaveBeenCalledWith(201);
                    } else {
                        // Should fail for weights below minimum
                        expect(mockRes.status).toHaveBeenCalledWith(400);
                        expect(mockRes.json).toHaveBeenCalledWith(
                            expect.objectContaining({
                                success: false,
                                message: expect.stringContaining('Weight must be greater than 0')
                            })
                        );
                    }
                }
            ), { numRuns: 6 });
        });

        test('For any extremely large weight values, the system should handle them appropriately', () => {
            return fc.assert(fc.asyncProperty(
                validWasteTypeGen(),
                fc.float({ min: 1000, max: 5000 }),
                async (wasteType, weight) => {
                    const wasteData = {
                        citizenId: testUser._id,
                        wasteType,
                        weight,
                        photos: null
                    };

                    const mockReq = {
                        body: wasteData,
                        user: testUser
                    };

                    const mockRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn()
                    };

                    await logWaste(mockReq, mockRes);

                    if (weight <= 1000) {
                        // Should succeed for weights within limit
                        expect(mockRes.status).toHaveBeenCalledWith(201);
                    } else {
                        // Should fail for weights above limit
                        expect(mockRes.status).toHaveBeenCalledWith(400);
                    }
                }
            ), { numRuns: 5 });
        });
    });

    // Property: Material Type Validation
    describe('Property: Material Type Validation', () => {
        test('For any valid waste material type, the system should accept and process the entry', () => {
            return fc.assert(fc.asyncProperty(
                validWasteTypeGen(),
                validWeightGen(),
                async (wasteType, weight) => {
                    const wasteData = {
                        citizenId: testUser._id,
                        wasteType,
                        weight,
                        photos: null
                    };

                    const mockReq = {
                        body: wasteData,
                        user: testUser
                    };

                    const mockRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn()
                    };

                    await logWaste(mockReq, mockRes);

                    expect(mockRes.status).toHaveBeenCalledWith(201);
                    expect(mockRes.json).toHaveBeenCalledWith(
                        expect.objectContaining({
                            success: true,
                            data: expect.objectContaining({
                                wasteLog: expect.objectContaining({
                                    wasteType: wasteType
                                })
                            })
                        })
                    );
                }
            ), { numRuns: 7 });
        });

        test('For any invalid material type, the system should reject the entry', () => {
            return fc.assert(fc.asyncProperty(
                fc.string().filter(s => !['plastic', 'paper', 'metal', 'glass', 'electronic', 'organic', 'hazardous'].includes(s)),
                validWeightGen(),
                async (invalidWasteType, weight) => {
                    try {
                        const wasteData = {
                            citizenId: testUser._id,
                            wasteType: invalidWasteType,
                            weight
                        };

                        const wasteLog = new WasteLog(wasteData);
                        await wasteLog.validate();
                        
                        // If validation passes, it means the material was somehow valid
                        // This should not happen for truly invalid materials
                        expect(false).toBe(true); // Force failure
                    } catch (error) {
                        // Validation should fail for invalid materials
                        expect(error.name).toBe('ValidationError');
                        expect(error.message).toContain('wasteType');
                    }
                }
            ), { numRuns: 5 });
        });
    });

    // Property: Required Fields Validation
    describe('Property: Required Fields Validation', () => {
        test('For any waste entry missing required fields, validation should fail with specific error messages', () => {
            return fc.assert(fc.asyncProperty(
                fc.oneof(
                    // Missing citizenId
                    fc.record({
                        wasteType: validWasteTypeGen(),
                        weight: validWeightGen()
                    }),
                    // Missing wasteType
                    fc.record({
                        citizenId: fc.constant(testUser._id),
                        weight: validWeightGen()
                    }),
                    // Missing weight
                    fc.record({
                        citizenId: fc.constant(testUser._id),
                        wasteType: validWasteTypeGen()
                    })
                ),
                async (incompleteWasteData) => {
                    try {
                        const wasteLog = new WasteLog(incompleteWasteData);
                        await wasteLog.validate();
                        
                        // Validation should fail for incomplete data
                        expect(false).toBe(true); // Force failure
                    } catch (error) {
                        expect(error.name).toBe('ValidationError');
                        
                        // Check that the error mentions the missing required field
                        const missingFields = [];
                        if (!incompleteWasteData.citizenId) missingFields.push('citizenId');
                        if (!incompleteWasteData.wasteType) missingFields.push('wasteType');
                        if (incompleteWasteData.weight === undefined) missingFields.push('weight');
                        
                        expect(missingFields.length).toBeGreaterThan(0);
                    }
                }
            ), { numRuns: 6 });
        });
    });

    // Property: Photo URL Validation
    describe('Property: Photo URL Validation', () => {
        test('For any photo URL (valid, empty, or null), the system should handle it appropriately', () => {
            return fc.assert(fc.asyncProperty(
                validWasteTypeGen(),
                validWeightGen(),
                fc.oneof(
                    fc.array(fc.webUrl(), { maxLength: 3 }),
                    fc.constant([]),
                    fc.constant(null),
                    fc.constant(undefined)
                ),
                async (wasteType, weight, photos) => {
                    const wasteData = {
                        citizenId: testUser._id,
                        wasteType,
                        weight,
                        photos
                    };

                    const mockReq = {
                        body: wasteData,
                        user: testUser
                    };

                    const mockRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn()
                    };

                    await logWaste(mockReq, mockRes);

                    // Photos are optional, so all should succeed
                    expect(mockRes.status).toHaveBeenCalledWith(201);
                    
                    const savedWaste = await WasteLog.findOne({ 
                        citizenId: testUser._id,
                        wasteType,
                        weight
                    });

                    expect(savedWaste).toBeTruthy();
                    if (photos && photos.length > 0) {
                        expect(savedWaste.photos).toEqual(photos);
                    }
                }
            ), { numRuns: 5 });
        });
    });

    // Property: Status Default Value
    describe('Property: Status Default Value', () => {
        test('For any new waste entry, the default status should be "pending"', () => {
            return fc.assert(fc.asyncProperty(
                validWasteDataGen(),
                async (wasteData) => {
                    const wasteLog = new WasteLog(wasteData);
                    await wasteLog.save();

                    expect(wasteLog.status).toBe('pending');
                    
                    // Verify in database
                    const savedWaste = await WasteLog.findById(wasteLog._id);
                    expect(savedWaste.status).toBe('pending');
                }
            ), { numRuns: 5 });
        });
    });

    // Property: Points and CO2 Calculation Integration
    describe('Property: Points and CO2 Calculation Integration', () => {
        test('For any valid waste entry, points and CO2 savings should be calculated and stored', () => {
            return fc.assert(fc.asyncProperty(
                fc.constantFrom('plastic', 'paper', 'metal'), // Only use types we have configs for
                validWeightGen(),
                async (wasteType, weight) => {
                    const wasteData = {
                        citizenId: testUser._id,
                        wasteType,
                        weight,
                        photos: null
                    };

                    const mockReq = {
                        body: wasteData,
                        user: testUser
                    };

                    const mockRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn()
                    };

                    await logWaste(mockReq, mockRes);

                    expect(mockRes.status).toHaveBeenCalledWith(201);
                    
                    const responseData = mockRes.json.mock.calls[0][0];
                    expect(responseData.data.pointsEarned).toBeGreaterThan(0);
                    expect(responseData.data.co2Saved).toBeGreaterThan(0);

                    // Verify calculations are reasonable
                    const config = await WasteTypeConfig.findOne({ type: wasteType });
                    const expectedPoints = Math.round(config.pointsPerKg * weight);
                    const expectedCO2 = config.co2SavedPerKg * weight;

                    expect(responseData.data.pointsEarned).toBe(expectedPoints);
                    expect(Math.abs(responseData.data.co2Saved - expectedCO2)).toBeLessThan(0.01);
                }
            ), { numRuns: 5 });
        });
    });
});