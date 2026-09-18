import mongoose from 'mongoose';
import User from '../models/User.js';
import {
    getProfile,
    updateProfile,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    getAddresses
} from '../controllers/profileController.js';
import jwt from 'jsonwebtoken';

describe('Profile Controller', () => {
    let testUser;
    let authToken;

    beforeAll(async () => {
        // Connect to test database
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
        }
    });

    beforeEach(async () => {
        // Clean up database
        await User.deleteMany({});

        // Create test user
        testUser = await User.create({
            name: 'Test User',
            email: 'test@example.com',
            username: 'testuser',
            password: 'hashedpassword123',
            role: 'citizen',
            profile: {
                firstName: 'Test',
                lastName: 'User',
                phone: '+1234567890',
                addresses: [{
                    street: '123 Test St',
                    city: 'Test City',
                    zipCode: '12345',
                    coordinates: {
                        type: 'Point',
                        coordinates: [-74.006, 40.7128] // NYC coordinates
                    },
                    isDefault: true
                }],
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

        // Generate auth token
        authToken = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET || 'testsecret');
    });

    afterEach(async () => {
        await User.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    describe('getProfile', () => {
        test('should get user profile successfully', async () => {
            const mockReq = {
                user: { _id: testUser._id },
                requestId: 'test-request'
            };
            const mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const mockNext = jest.fn();

            await getProfile(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        _id: testUser._id.toString(),
                        email: testUser.email,
                        profile: expect.objectContaining({
                            firstName: 'Test',
                            lastName: 'User'
                        })
                    })
                })
            );
        });

        test('should handle non-existent user', async () => {
            const fakeUserId = new mongoose.Types.ObjectId();
            const mockReq = {
                user: { _id: fakeUserId },
                requestId: 'test-request'
            };
            const mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const mockNext = jest.fn();

            await expect(getProfile(mockReq, mockRes, mockNext)).rejects.toThrow();
        });
    });

    describe('updateProfile', () => {
        test('should update profile successfully', async () => {
            const updateData = {
                firstName: 'Updated',
                lastName: 'Name',
                phone: '+9876543210',
                preferences: {
                    notifications: {
                        pickup: false,
                        rewards: true,
                        challenges: false
                    },
                    privacy: {
                        showInLeaderboard: false,
                        shareImpactData: true
                    }
                }
            };

            const mockReq = {
                user: { _id: testUser._id },
                body: updateData,
                requestId: 'test-request'
            };
            const mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const mockNext = jest.fn();

            await updateProfile(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        profile: expect.objectContaining({
                            firstName: 'Updated',
                            lastName: 'Name',
                            phone: '+9876543210',
                            preferences: expect.objectContaining({
                                notifications: expect.objectContaining({
                                    pickup: false
                                }),
                                privacy: expect.objectContaining({
                                    showInLeaderboard: false
                                })
                            })
                        })
                    })
                })
            );
        });

        test('should validate firstName length', async () => {
            const mockReq = {
                user: { _id: testUser._id },
                body: { firstName: '' },
                requestId: 'test-request'
            };
            const mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const mockNext = jest.fn();

            await expect(updateProfile(mockReq, mockRes, mockNext)).rejects.toThrow();
        });

        test('should validate phone format', async () => {
            const mockReq = {
                user: { _id: testUser._id },
                body: { phone: 'invalid-phone' },
                requestId: 'test-request'
            };
            const mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const mockNext = jest.fn();

            await expect(updateProfile(mockReq, mockRes, mockNext)).rejects.toThrow();
        });

        test('should allow partial updates', async () => {
            const mockReq = {
                user: { _id: testUser._id },
                body: { firstName: 'OnlyFirst' },
                requestId: 'test-request'
            };
            const mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const mockNext = jest.fn();

            await updateProfile(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        profile: expect.objectContaining({
                            firstName: 'OnlyFirst',
                            lastName: 'User' // Should remain unchanged
                        })
                    })
                })
            );
        });
    });

    describe('addAddress', () => {
        test('should add new address successfully', async () => {
            const newAddress = {
                street: '456 New St',
                city: 'New City',
                zipCode: '67890',
                coordinates: [-73.935, 40.730],
                isDefault: false
            };

            const mockReq = {
                user: { _id: testUser._id },
                body: newAddress,
                requestId: 'test-request'
            };
            const mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const mockNext = jest.fn();

            await addAddress(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        address: expect.objectContaining({
                            street: '456 New St',
                            city: 'New City',
                            zipCode: '67890'
                        }),
                        totalAddresses: 2
                    })
                })
            );
        });

        test('should validate required fields', async () => {
            const mockReq = {
                user: { _id: testUser._id },
                body: { street: '123 Test St' }, // Missing required fields
                requestId: 'test-request'
            };
            const mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const mockNext = jest.fn();

            await expect(addAddress(mockReq, mockRes, mockNext)).rejects.toThrow();
        });

        test('should validate coordinates format', async () => {
            const invalidAddress = {
                street: '456 New St',
                city: 'New City',
                zipCode: '67890',
                coordinates: 'invalid'
            };

            const mockReq = {
                user: { _id: testUser._id },
                body: invalidAddress,
                requestId: 'test-request'
            };
            const mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const mockNext = jest.fn();

            await expect(addAddress(mockReq, mockRes, mockNext)).rejects.toThrow();
        });
    });

    describe('deleteAddress', () => {
        beforeEach(async () => {
            // Add a second address for deletion tests
            await User.findByIdAndUpdate(testUser._id, {
                $push: {
                    'profile.addresses': {
                        street: '456 Second St',
                        city: 'Second City',
                        zipCode: '67890',
                        coordinates: {
                            type: 'Point',
                            coordinates: [-73.935, 40.730]
                        },
                        isDefault: false
                    }
                }
            });
        });

        test('should delete address successfully', async () => {
            const user = await User.findById(testUser._id);
            const addressToDelete = user.profile.addresses.find(addr => 
                addr.street === '456 Second St'
            );

            const mockReq = {
                user: { _id: testUser._id },
                params: { addressId: addressToDelete._id },
                requestId: 'test-request'
            };
            const mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const mockNext = jest.fn();

            await deleteAddress(mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        deletedAddressId: addressToDelete._id.toString(),
                        totalAddresses: 1
                    })
                })
            );
        });

        test('should not allow deleting last address', async () => {
            // Delete all but one address
            const user = await User.findById(testUser._id);
            const addressToKeep = user.profile.addresses[0]._id;
            
            await User.findByIdAndUpdate(testUser._id, {
                'profile.addresses': user.profile.addresses.filter(addr => 
                    addr._id.toString() === addressToKeep.toString()
                )
            });

            const mockReq = {
                user: { _id: testUser._id },
                params: { addressId: addressToKeep },
                requestId: 'test-request'
            };
            const mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };
            const mockNext = jest.fn();

            await expect(deleteAddress(mockReq, mockRes, mockNext)).rejects.toThrow();
        });
    });
});