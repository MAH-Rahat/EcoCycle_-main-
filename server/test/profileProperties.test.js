import fc from 'fast-check';
import mongoose from 'mongoose';
import User from '../models/User.js';
import {
    getProfile,
    updateProfile,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress
} from '../controllers/profileController.js';
import { ValidationErrors } from '../middleware/errorHandling.js';

// Feature: ecocycle-platform, Property 3: Profile Management Persistence
describe('Profile Management Property-Based Tests', () => {
    let testUser;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
        }
    });

    beforeEach(async () => {
        await User.deleteMany({});
        
        testUser = await User.create({
            name: 'Test User',
            email: 'test@example.com',
            username: 'testuser',
            password: 'hashedpassword123',
            role: 'citizen',
            profile: {
                firstName: 'Test',
                lastName: 'User',
                addresses: [],
                preferences: {
                    notifications: {
                        pickup: true,
                        rewards: true,
                        challenges: true
                    },
                    privacy: {
                        showInLeaderboard: true,
                        shareImpactData: true
                    }
                }
            }
        });
    });

    afterEach(async () => {
        await User.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    // Custom generators for domain-specific data
    const validStringGen = (minLength = 1, maxLength = 50) => 
        fc.string({ minLength, maxLength }).filter(s => s.trim().length >= minLength);

    const coordinatesGen = () => fc.tuple(
        fc.float({ min: -180, max: 180 }), // longitude
        fc.float({ min: -90, max: 90 })    // latitude
    );

    const addressGen = () => fc.record({
        street: validStringGen(1, 200),
        city: validStringGen(1, 100),
        zipCode: validStringGen(1, 20),
        coordinates: coordinatesGen(),
        isDefault: fc.boolean()
    });

    const preferencesGen = () => fc.record({
        notifications: fc.record({
            pickup: fc.boolean(),
            rewards: fc.boolean(),
            challenges: fc.boolean()
        }),
        privacy: fc.record({
            showInLeaderboard: fc.boolean(),
            shareImpactData: fc.boolean()
        })
    });

    const phoneGen = () => fc.oneof(
        fc.constant(undefined),
        fc.string({ minLength: 10, maxLength: 15 }).map(s => '+' + s.replace(/\D/g, ''))
    );

    // Property 3: Profile Management Persistence
    describe('Property 3: Profile Management Persistence', () => {
        test('For any citizen profile update, all changes should be persisted correctly and retrievable in subsequent queries', () => {
            return fc.assert(fc.asyncProperty(
                validStringGen(1, 50), // firstName
                validStringGen(1, 50), // lastName
                phoneGen(),
                preferencesGen(),
                async (firstName, lastName, phone, preferences) => {
                    const mockReq = {
                        user: { _id: testUser._id },
                        body: { firstName, lastName, phone, preferences },
                        requestId: 'test-request'
                    };

                    const mockRes = {
                        json: jest.fn(),
                        status: jest.fn().mockReturnThis()
                    };

                    // Update profile
                    await updateProfile(mockReq, mockRes, jest.fn());

                    // Verify the update was successful
                    expect(mockRes.json).toHaveBeenCalledWith(
                        expect.objectContaining({
                            success: true,
                            data: expect.objectContaining({
                                profile: expect.objectContaining({
                                    firstName: firstName.trim(),
                                    lastName: lastName.trim(),
                                    phone: phone,
                                    preferences: expect.objectContaining(preferences)
                                })
                            })
                        })
                    );

                    // Retrieve profile and verify persistence
                    const getReq = {
                        user: { _id: testUser._id },
                        requestId: 'test-get-request'
                    };
                    const getRes = {
                        json: jest.fn(),
                        status: jest.fn().mockReturnThis()
                    };

                    await getProfile(getReq, getRes, jest.fn());

                    expect(getRes.json).toHaveBeenCalledWith(
                        expect.objectContaining({
                            success: true,
                            data: expect.objectContaining({
                                profile: expect.objectContaining({
                                    firstName: firstName.trim(),
                                    lastName: lastName.trim(),
                                    phone: phone,
                                    preferences: expect.objectContaining(preferences)
                                })
                            })
                        })
                    );
                }
            ), { numRuns: 12 });
        });
    });

    // Property: Address Management Consistency
    describe('Property: Address Management Consistency', () => {
        test('For any address operations, exactly one address should be marked as default', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(addressGen(), { minLength: 1, maxLength: 5 }),
                async (addresses) => {
                    // Add addresses one by one
                    for (const address of addresses) {
                        const mockReq = {
                            user: { _id: testUser._id },
                            body: address,
                            requestId: 'test-request'
                        };

                        const mockRes = {
                            json: jest.fn(),
                            status: jest.fn().mockReturnThis()
                        };

                        await addAddress(mockReq, mockRes, jest.fn());
                        expect(mockRes.status).toHaveBeenCalledWith(201);
                    }

                    // Verify exactly one default address exists
                    const user = await User.findById(testUser._id);
                    const defaultAddresses = user.profile.addresses.filter(addr => addr.isDefault);
                    expect(defaultAddresses).toHaveLength(1);
                }
            ), { numRuns: 7 });
        });

        test('For any address deletion, if the deleted address was default, another address should become default', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(addressGen(), { minLength: 2, maxLength: 4 }),
                async (addresses) => {
                    // Add multiple addresses
                    for (const address of addresses) {
                        const mockReq = {
                            user: { _id: testUser._id },
                            body: address,
                            requestId: 'test-request'
                        };

                        const mockRes = {
                            json: jest.fn(),
                            status: jest.fn().mockReturnThis()
                        };

                        await addAddress(mockReq, mockRes, jest.fn());
                    }

                    // Get current user state
                    let user = await User.findById(testUser._id);
                    const defaultAddress = user.profile.addresses.find(addr => addr.isDefault);
                    const totalAddresses = user.profile.addresses.length;

                    // Delete the default address
                    const deleteReq = {
                        user: { _id: testUser._id },
                        params: { addressId: defaultAddress._id },
                        requestId: 'test-delete-request'
                    };

                    const deleteRes = {
                        json: jest.fn(),
                        status: jest.fn().mockReturnThis()
                    };

                    await deleteAddress(deleteReq, deleteRes, jest.fn());

                    // Verify deletion was successful and a new default was set
                    user = await User.findById(testUser._id);
                    expect(user.profile.addresses).toHaveLength(totalAddresses - 1);
                    
                    if (user.profile.addresses.length > 0) {
                        const defaultAddresses = user.profile.addresses.filter(addr => addr.isDefault);
                        expect(defaultAddresses).toHaveLength(1);
                    }
                }
            ), { numRuns: 5 });
        });
    });

    // Property: Coordinate Validation
    describe('Property: Coordinate Validation', () => {
        test('For any coordinates outside valid ranges, address creation should fail', () => {
            return fc.assert(fc.asyncProperty(
                validStringGen(1, 200), // street
                validStringGen(1, 100), // city
                validStringGen(1, 20),  // zipCode
                fc.oneof(
                    fc.tuple(fc.float({ min: -200, max: -180.1 }), fc.float({ min: -90, max: 90 })), // Invalid longitude (too low)
                    fc.tuple(fc.float({ min: 180.1, max: 200 }), fc.float({ min: -90, max: 90 })),   // Invalid longitude (too high)
                    fc.tuple(fc.float({ min: -180, max: 180 }), fc.float({ min: -100, max: -90.1 })), // Invalid latitude (too low)
                    fc.tuple(fc.float({ min: -180, max: 180 }), fc.float({ min: 90.1, max: 100 }))    // Invalid latitude (too high)
                ),
                async (street, city, zipCode, coordinates) => {
                    const mockReq = {
                        user: { _id: testUser._id },
                        body: { street, city, zipCode, coordinates },
                        requestId: 'test-request'
                    };

                    const mockNext = jest.fn();

                    await expect(addAddress(mockReq, {}, mockNext)).rejects.toThrow();
                }
            ), { numRuns: 12 });
        });

        test('For any coordinates within valid ranges, address creation should succeed', () => {
            return fc.assert(fc.asyncProperty(
                validStringGen(1, 200), // street
                validStringGen(1, 100), // city
                validStringGen(1, 20),  // zipCode
                coordinatesGen(),
                async (street, city, zipCode, coordinates) => {
                    const mockReq = {
                        user: { _id: testUser._id },
                        body: { street, city, zipCode, coordinates },
                        requestId: 'test-request'
                    };

                    const mockRes = {
                        json: jest.fn(),
                        status: jest.fn().mockReturnThis()
                    };

                    await addAddress(mockReq, mockRes, jest.fn());

                    expect(mockRes.status).toHaveBeenCalledWith(201);
                    expect(mockRes.json).toHaveBeenCalledWith(
                        expect.objectContaining({
                            success: true,
                            data: expect.objectContaining({
                                address: expect.objectContaining({
                                    street: street.trim(),
                                    city: city.trim(),
                                    zipCode: zipCode.trim(),
                                    coordinates: expect.objectContaining({
                                        coordinates: coordinates
                                    })
                                })
                            })
                        })
                    );
                }
            ), { numRuns: 12 });
        });
    });

    // Property: String Validation
    describe('Property: String Validation', () => {
        test('For any string field exceeding maximum length, validation should fail', () => {
            return fc.assert(fc.asyncProperty(
                fc.oneof(
                    fc.record({ firstName: fc.string({ minLength: 51, maxLength: 100 }) }),
                    fc.record({ lastName: fc.string({ minLength: 51, maxLength: 100 }) })
                ),
                async (invalidData) => {
                    const mockReq = {
                        user: { _id: testUser._id },
                        body: invalidData,
                        requestId: 'test-request'
                    };

                    const mockNext = jest.fn();

                    await expect(updateProfile(mockReq, {}, mockNext)).rejects.toThrow();
                }
            ), { numRuns: 7 });
        });

        test('For any string field within valid length, validation should succeed', () => {
            return fc.assert(fc.asyncProperty(
                validStringGen(1, 50), // firstName
                validStringGen(1, 50), // lastName
                async (firstName, lastName) => {
                    const mockReq = {
                        user: { _id: testUser._id },
                        body: { firstName, lastName },
                        requestId: 'test-request'
                    };

                    const mockRes = {
                        json: jest.fn(),
                        status: jest.fn().mockReturnThis()
                    };

                    await updateProfile(mockReq, mockRes, jest.fn());

                    expect(mockRes.json).toHaveBeenCalledWith(
                        expect.objectContaining({
                            success: true,
                            data: expect.objectContaining({
                                profile: expect.objectContaining({
                                    firstName: firstName.trim(),
                                    lastName: lastName.trim()
                                })
                            })
                        })
                    );
                }
            ), { numRuns: 12 });
        });
    });

    // Property: Preferences Persistence
    describe('Property: Preferences Persistence', () => {
        test('For any valid preferences update, all preference values should be persisted as booleans', () => {
            return fc.assert(fc.asyncProperty(
                preferencesGen(),
                async (preferences) => {
                    const mockReq = {
                        user: { _id: testUser._id },
                        body: { preferences },
                        requestId: 'test-request'
                    };

                    const mockRes = {
                        json: jest.fn(),
                        status: jest.fn().mockReturnThis()
                    };

                    await updateProfile(mockReq, mockRes, jest.fn());

                    // Verify all preference values are booleans
                    const responseData = mockRes.json.mock.calls[0][0];
                    const savedPreferences = responseData.data.profile.preferences;

                    expect(typeof savedPreferences.notifications.pickup).toBe('boolean');
                    expect(typeof savedPreferences.notifications.rewards).toBe('boolean');
                    expect(typeof savedPreferences.notifications.challenges).toBe('boolean');
                    expect(typeof savedPreferences.privacy.showInLeaderboard).toBe('boolean');
                    expect(typeof savedPreferences.privacy.shareImpactData).toBe('boolean');

                    // Verify values match input
                    expect(savedPreferences.notifications.pickup).toBe(preferences.notifications.pickup);
                    expect(savedPreferences.notifications.rewards).toBe(preferences.notifications.rewards);
                    expect(savedPreferences.notifications.challenges).toBe(preferences.notifications.challenges);
                    expect(savedPreferences.privacy.showInLeaderboard).toBe(preferences.privacy.showInLeaderboard);
                    expect(savedPreferences.privacy.shareImpactData).toBe(preferences.privacy.shareImpactData);
                }
            ), { numRuns: 12 });
        });
    });
});