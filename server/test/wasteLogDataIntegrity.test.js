import fc from 'fast-check';
import mongoose from 'mongoose';
import Waste from '../models/Waste.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';
import { logWaste, getUserWasteHistory, updateWasteStatus } from '../controllers/wasteController.js';

// Feature: ecocycle-platform, Property 6: Waste Log Data Integrity
describe('Waste Log Data Integrity Property-Based Tests', () => {
    let testCitizen, testCollector, testAdmin;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
        }
    });

    beforeEach(async () => {
        await Waste.deleteMany({});
        await WasteTypeConfig.deleteMany({});
        
        // Create test users
        testCitizen = {
            _id: new mongoose.Types.ObjectId(),
            name: 'Test Citizen',
            email: 'citizen@test.com',
            role: 'citizen'
        };

        testCollector = {
            _id: new mongoose.Types.ObjectId(),
            name: 'Test Collector',
            email: 'collector@test.com',
            role: 'collector'
        };

        testAdmin = {
            _id: new mongoose.Types.ObjectId(),
            name: 'Test Admin',
            email: 'admin@test.com',
            role: 'admin'
        };

        // Initialize test waste type configurations
        await WasteTypeConfig.insertMany([
            {
                type: 'Plastic',
                pointsPerKg: 10,
                co2SavedPerKg: 2.0,
                description: 'Plastic materials',
                recyclingTips: ['Clean before recycling'],
                isActive: true
            },
            {
                type: 'Paper',
                pointsPerKg: 8,
                co2SavedPerKg: 1.5,
                description: 'Paper materials',
                recyclingTips: ['Keep dry'],
                isActive: true
            },
            {
                type: 'Metal',
                pointsPerKg: 15,
                co2SavedPerKg: 3.0,
                description: 'Metal materials',
                recyclingTips: ['Rinse containers'],
                isActive: true
            }
        ]);
    });

    afterEach(async () => {
        await Waste.deleteMany({});
        await WasteTypeConfig.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    // Custom generators for waste log testing
    const validWasteTypeGen = () => fc.constantFrom('Plastic', 'Paper', 'Metal', 'Glass', 'E-Waste', 'Organic', 'Other');
    
    const validWeightGen = () => fc.float({ min: 0.1, max: 100 });
    
    const validPhotoUrlGen = () => fc.oneof(
        fc.webUrl(),
        fc.constant(''),
        fc.constant(null),
        fc.constant(undefined)
    );

    const validPickupDetailsGen = () => fc.record({
        isRequested: fc.boolean(),
        address: fc.string({ minLength: 5, maxLength: 200 }),
        requestedTime: fc.date({ min: new Date(), max: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })
    });

    const validWasteLogGen = () => fc.record({
        citizen: fc.constant(testCitizen._id),
        material: validWasteTypeGen(),
        weight: validWeightGen(),
        photo: validPhotoUrlGen(),
        pickupDetails: fc.option(validPickupDetailsGen())
    });

    const wasteStatusGen = () => fc.constantFrom('Pending', 'Accepted', 'Collected', 'Rejected', 'On Hold');

    // Property 6: Waste Log Data Integrity
    describe('Property 6: Waste Log Data Integrity', () => {
        test('For any waste log entry, all required fields (type, weight) should be stored correctly and optional fields (photos, description) should be preserved when provided', () => {
            return fc.assert(fc.asyncProperty(
                validWasteLogGen(),
                fc.option(fc.string({ minLength: 1, maxLength: 500 })), // description
                async (wasteData, description) => {
                    const requestData = { ...wasteData };
                    if (description) {
                        requestData.description = description;
                    }

                    const mockReq = {
                        body: requestData,
                        user: testCitizen
                    };

                    const mockRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn()
                    };

                    await logWaste(mockReq, mockRes);

                    // Should succeed
                    expect(mockRes.status).toHaveBeenCalledWith(201);

                    // Verify data integrity in database
                    const savedWaste = await Waste.findOne({ 
                        citizen: wasteData.citizen,
                        material: wasteData.material,
                        weight: wasteData.weight
                    });

                    expect(savedWaste).toBeTruthy();
                    
                    // Required fields should be preserved exactly
                    expect(savedWaste.citizen.toString()).toBe(wasteData.citizen.toString());
                    expect(savedWaste.material).toBe(wasteData.material);
                    expect(savedWaste.weight).toBe(wasteData.weight);
                    
                    // Optional fields should be preserved when provided
                    if (wasteData.photo) {
                        expect(savedWaste.photo).toBe(wasteData.photo);
                    }
                    if (description) {
                        expect(savedWaste.description).toBe(description);
                    }
                    
                    // Default values should be set correctly
                    expect(savedWaste.status).toBe('Pending');
                    expect(savedWaste.pointsAwarded).toBe(false);
                    expect(savedWaste.createdAt).toBeInstanceOf(Date);
                    expect(savedWaste.updatedAt).toBeInstanceOf(Date);
                }
            ), { numRuns: 10 });
        });

        test('For any waste log retrieval, data should be returned exactly as stored without corruption', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(validWasteLogGen(), { minLength: 1, maxLength: 5 }),
                async (wasteLogs) => {
                    const createdWasteLogs = [];

                    // Create multiple waste logs
                    for (const wasteData of wasteLogs) {
                        const mockReq = {
                            body: wasteData,
                            user: testCitizen
                        };

                        const mockRes = {
                            status: jest.fn().mockReturnThis(),
                            json: jest.fn()
                        };

                        await logWaste(mockReq, mockRes);
                        
                        const responseData = mockRes.json.mock.calls[0][0];
                        createdWasteLogs.push(responseData.data.wasteLog);
                    }

                    // Retrieve waste history
                    const historyReq = {
                        params: { userId: testCitizen._id },
                        user: testCitizen
                    };

                    const historyRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn()
                    };

                    await getUserWasteHistory(historyReq, historyRes);

                    expect(historyRes.status).toHaveBeenCalledWith(200);
                    const historyData = historyRes.json.mock.calls[0][0];
                    
                    expect(historyData.success).toBe(true);
                    expect(historyData.data).toHaveLength(wasteLogs.length);

                    // Verify each waste log maintains data integrity
                    historyData.data.forEach((retrievedLog, index) => {
                        const originalData = wasteLogs[index];
                        
                        expect(retrievedLog.citizen.toString()).toBe(originalData.citizen.toString());
                        expect(retrievedLog.material).toBe(originalData.material);
                        expect(retrievedLog.weight).toBe(originalData.weight);
                        
                        if (originalData.photo) {
                            expect(retrievedLog.photo).toBe(originalData.photo);
                        }
                    });
                }
            ), { numRuns: 6 });
        });
    });

    // Property: Status Update Integrity
    describe('Property: Status Update Integrity', () => {
        test('For any status update, waste log data should remain unchanged except for status and related fields', () => {
            return fc.assert(fc.asyncProperty(
                validWasteLogGen(),
                wasteStatusGen(),
                fc.option(fc.string({ minLength: 1, maxLength: 200 })), // admin note
                async (wasteData, newStatus, adminNote) => {
                    // First create a waste log
                    const mockReq = {
                        body: wasteData,
                        user: testCitizen
                    };

                    const mockRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn()
                    };

                    await logWaste(mockReq, mockRes);
                    
                    const responseData = mockRes.json.mock.calls[0][0];
                    const wasteLogId = responseData.data.wasteLog._id;

                    // Store original data for comparison
                    const originalWaste = await Waste.findById(wasteLogId);
                    const originalData = {
                        citizen: originalWaste.citizen,
                        material: originalWaste.material,
                        weight: originalWaste.weight,
                        photo: originalWaste.photo,
                        createdAt: originalWaste.createdAt
                    };

                    // Update status
                    const updateReq = {
                        params: { id: wasteLogId },
                        body: { 
                            status: newStatus,
                            adminNote: adminNote,
                            collector: testCollector._id
                        },
                        user: testAdmin
                    };

                    const updateRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn()
                    };

                    await updateWasteStatus(updateReq, updateRes);

                    // Verify update succeeded
                    expect(updateRes.status).toHaveBeenCalledWith(200);

                    // Verify data integrity after update
                    const updatedWaste = await Waste.findById(wasteLogId);
                    
                    // Core data should remain unchanged
                    expect(updatedWaste.citizen.toString()).toBe(originalData.citizen.toString());
                    expect(updatedWaste.material).toBe(originalData.material);
                    expect(updatedWaste.weight).toBe(originalData.weight);
                    expect(updatedWaste.photo).toBe(originalData.photo);
                    expect(updatedWaste.createdAt.getTime()).toBe(originalData.createdAt.getTime());

                    // Status-related fields should be updated
                    expect(updatedWaste.status).toBe(newStatus);
                    if (adminNote) {
                        expect(updatedWaste.adminNote).toBe(adminNote);
                    }
                    if (newStatus === 'Accepted') {
                        expect(updatedWaste.collector.toString()).toBe(testCollector._id.toString());
                    }

                    // Updated timestamp should be more recent
                    expect(updatedWaste.updatedAt.getTime()).toBeGreaterThanOrEqual(originalData.createdAt.getTime());
                }
            ), { numRuns: 7 });
        });
    });

    // Property: Concurrent Access Integrity
    describe('Property: Concurrent Access Integrity', () => {
        test('For any concurrent waste log operations, data integrity should be maintained', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(validWasteLogGen(), { minLength: 2, maxLength: 5 }),
                async (wasteLogs) => {
                    // Create waste logs concurrently
                    const createPromises = wasteLogs.map(async (wasteData) => {
                        const mockReq = {
                            body: wasteData,
                            user: testCitizen
                        };

                        const mockRes = {
                            status: jest.fn().mockReturnThis(),
                            json: jest.fn()
                        };

                        await logWaste(mockReq, mockRes);
                        return mockRes.json.mock.calls[0][0];
                    });

                    const results = await Promise.all(createPromises);

                    // Verify all operations succeeded
                    results.forEach(result => {
                        expect(result.success).toBe(true);
                        expect(result.data.wasteLog).toBeTruthy();
                    });

                    // Verify data integrity in database
                    const savedWasteLogs = await Waste.find({ citizen: testCitizen._id });
                    expect(savedWasteLogs).toHaveLength(wasteLogs.length);

                    // Verify each waste log maintains its unique data
                    const savedData = savedWasteLogs.map(log => ({
                        material: log.material,
                        weight: log.weight,
                        photo: log.photo
                    }));

                    const originalData = wasteLogs.map(log => ({
                        material: log.material,
                        weight: log.weight,
                        photo: log.photo
                    }));

                    // Each original should have a corresponding saved entry
                    originalData.forEach(original => {
                        const found = savedData.find(saved => 
                            saved.material === original.material &&
                            saved.weight === original.weight &&
                            saved.photo === original.photo
                        );
                        expect(found).toBeTruthy();
                    });
                }
            ), { numRuns: 5 });
        });
    });

    // Property: Timestamp Consistency
    describe('Property: Timestamp Consistency', () => {
        test('For any waste log operations, timestamps should be consistent and chronological', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(validWasteLogGen(), { minLength: 2, maxLength: 4 }),
                async (wasteLogs) => {
                    const timestamps = [];

                    // Create waste logs with small delays
                    for (let i = 0; i < wasteLogs.length; i++) {
                        const wasteData = wasteLogs[i];
                        
                        const mockReq = {
                            body: wasteData,
                            user: testCitizen
                        };

                        const mockRes = {
                            status: jest.fn().mockReturnThis(),
                            json: jest.fn()
                        };

                        const beforeTime = new Date();
                        await logWaste(mockReq, mockRes);
                        const afterTime = new Date();

                        const responseData = mockRes.json.mock.calls[0][0];
                        const wasteLog = responseData.data.wasteLog;

                        // Verify timestamp is within expected range
                        expect(wasteLog.createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
                        expect(wasteLog.createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
                        expect(wasteLog.updatedAt.getTime()).toBeGreaterThanOrEqual(wasteLog.createdAt.getTime());

                        timestamps.push(wasteLog.createdAt);

                        // Small delay to ensure different timestamps
                        if (i < wasteLogs.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1));
                        }
                    }

                    // Verify timestamps are in chronological order
                    for (let i = 1; i < timestamps.length; i++) {
                        expect(timestamps[i].getTime()).toBeGreaterThanOrEqual(timestamps[i - 1].getTime());
                    }
                }
            ), { numRuns: 5 });
        });
    });

    // Property: Data Type Consistency
    describe('Property: Data Type Consistency', () => {
        test('For any waste log, data types should be preserved correctly throughout storage and retrieval', () => {
            return fc.assert(fc.asyncProperty(
                validWasteLogGen(),
                async (wasteData) => {
                    const mockReq = {
                        body: wasteData,
                        user: testCitizen
                    };

                    const mockRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn()
                    };

                    await logWaste(mockReq, mockRes);

                    const savedWaste = await Waste.findOne({ 
                        citizen: wasteData.citizen,
                        material: wasteData.material,
                        weight: wasteData.weight
                    });

                    // Verify data types are preserved
                    expect(typeof savedWaste.citizen).toBe('object'); // ObjectId
                    expect(typeof savedWaste.material).toBe('string');
                    expect(typeof savedWaste.weight).toBe('number');
                    expect(typeof savedWaste.status).toBe('string');
                    expect(typeof savedWaste.pointsAwarded).toBe('boolean');
                    expect(savedWaste.createdAt).toBeInstanceOf(Date);
                    expect(savedWaste.updatedAt).toBeInstanceOf(Date);

                    if (savedWaste.photo) {
                        expect(typeof savedWaste.photo).toBe('string');
                    }

                    if (savedWaste.pointsEarned !== undefined) {
                        expect(typeof savedWaste.pointsEarned).toBe('number');
                    }

                    if (savedWaste.co2Saved !== undefined) {
                        expect(typeof savedWaste.co2Saved).toBe('number');
                    }
                }
            ), { numRuns: 7 });
        });
    });

    // Property: Unique Identification
    describe('Property: Unique Identification', () => {
        test('For any waste log, each entry should have a unique identifier that remains constant', () => {
            return fc.assert(fc.asyncProperty(
                validWasteLogGen(),
                async (wasteData) => {
                    const mockReq = {
                        body: wasteData,
                        user: testCitizen
                    };

                    const mockRes = {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn()
                    };

                    await logWaste(mockReq, mockRes);

                    const responseData = mockRes.json.mock.calls[0][0];
                    const originalId = responseData.data.wasteLog._id;

                    // Verify ID is a valid ObjectId
                    expect(mongoose.Types.ObjectId.isValid(originalId)).toBe(true);

                    // Retrieve the same waste log multiple times
                    for (let i = 0; i < 3; i++) {
                        const retrievedWaste = await Waste.findById(originalId);
                        expect(retrievedWaste).toBeTruthy();
                        expect(retrievedWaste._id.toString()).toBe(originalId.toString());
                    }

                    // Update the waste log and verify ID remains the same
                    await updateWasteStatus({
                        params: { id: originalId },
                        body: { status: 'Accepted' },
                        user: testAdmin
                    }, {
                        status: jest.fn().mockReturnThis(),
                        json: jest.fn()
                    });

                    const updatedWaste = await Waste.findById(originalId);
                    expect(updatedWaste._id.toString()).toBe(originalId.toString());
                }
            ), { numRuns: 6 });
        });
    });
});