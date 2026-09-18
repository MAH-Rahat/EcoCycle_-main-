import User from '../models/User.js';
import { 
    SecureError, 
    ValidationErrors, 
    SecurityLogger, 
    RequestValidator,
    asyncHandler 
} from '../middleware/errorHandling.js';

/**
 * @desc    Get user profile
 * @route   GET /api/profile
 * @access  Private
 */
export const getProfile = asyncHandler(async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password -adminCode');
        
        if (!user) {
            SecurityLogger.logDataAccess(req, 'USER', req.user._id, false, {
                action: 'READ',
                purpose: 'PROFILE_ACCESS',
                error: 'USER_NOT_FOUND'
            });
            throw ValidationErrors.USER_NOT_FOUND;
        }

        SecurityLogger.logDataAccess(req, 'USER', user._id, true, {
            action: 'READ',
            purpose: 'PROFILE_ACCESS'
        });

        res.json({
            success: true,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                username: user.username,
                role: user.role,
                points: user.points,
                profile: user.profile,
                lastLogin: user.lastLogin,
                activityCount: user.activityCount,
                isActive: user.isActive,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            },
            message: 'Profile retrieved successfully'
        });
    } catch (error) {
        if (error instanceof SecureError) {
            throw error;
        }
        
        console.error('[PROFILE_ERROR] Get profile failed:', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            userId: req.user._id
        });

        throw ValidationErrors.OPERATION_FAILED;
    }
});

/**
 * @desc    Update user profile
 * @route   PUT /api/profile
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
    const { firstName, lastName, phone, preferences } = req.body;

    try {
        const user = await User.findById(req.user._id);
        
        if (!user) {
            SecurityLogger.logDataAccess(req, 'USER', req.user._id, false, {
                action: 'UPDATE',
                purpose: 'PROFILE_UPDATE',
                error: 'USER_NOT_FOUND'
            });
            throw ValidationErrors.USER_NOT_FOUND;
        }

        // Validate input data
        if (firstName !== undefined) {
            RequestValidator.validateString(firstName, 'firstName', 1, 50);
            user.profile.firstName = firstName.trim();
        }

        if (lastName !== undefined) {
            RequestValidator.validateString(lastName, 'lastName', 1, 50);
            user.profile.lastName = lastName.trim();
        }

        if (phone !== undefined) {
            if (phone && !/^\+?[1-9]\d{1,14}$/.test(phone)) {
                throw ValidationErrors.INVALID_PHONE_FORMAT;
            }
            user.profile.phone = phone ? phone.trim() : undefined;
        }

        if (preferences !== undefined) {
            // Validate preferences structure
            if (typeof preferences !== 'object' || preferences === null) {
                throw ValidationErrors.INVALID_PREFERENCES_FORMAT;
            }

            // Update notification preferences
            if (preferences.notifications) {
                if (typeof preferences.notifications !== 'object') {
                    throw ValidationErrors.INVALID_PREFERENCES_FORMAT;
                }
                
                if (preferences.notifications.pickup !== undefined) {
                    user.profile.preferences.notifications.pickup = Boolean(preferences.notifications.pickup);
                }
                if (preferences.notifications.rewards !== undefined) {
                    user.profile.preferences.notifications.rewards = Boolean(preferences.notifications.rewards);
                }
                if (preferences.notifications.challenges !== undefined) {
                    user.profile.preferences.notifications.challenges = Boolean(preferences.notifications.challenges);
                }
            }

            // Update privacy preferences
            if (preferences.privacy) {
                if (typeof preferences.privacy !== 'object') {
                    throw ValidationErrors.INVALID_PREFERENCES_FORMAT;
                }
                
                if (preferences.privacy.showInLeaderboard !== undefined) {
                    user.profile.preferences.privacy.showInLeaderboard = Boolean(preferences.privacy.showInLeaderboard);
                }
                if (preferences.privacy.shareImpactData !== undefined) {
                    user.profile.preferences.privacy.shareImpactData = Boolean(preferences.privacy.shareImpactData);
                }
            }
        }

        await user.save();

        SecurityLogger.logDataAccess(req, 'USER', user._id, true, {
            action: 'UPDATE',
            purpose: 'PROFILE_UPDATE',
            fieldsUpdated: Object.keys(req.body)
        });

        res.json({
            success: true,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                username: user.username,
                role: user.role,
                points: user.points,
                profile: user.profile,
                lastLogin: user.lastLogin,
                activityCount: user.activityCount,
                isActive: user.isActive,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            },
            message: 'Profile updated successfully'
        });
    } catch (error) {
        if (error instanceof SecureError) {
            throw error;
        }
        
        console.error('[PROFILE_ERROR] Update profile failed:', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            userId: req.user._id
        });

        throw ValidationErrors.OPERATION_FAILED;
    }
});

/**
 * @desc    Add new address
 * @route   POST /api/profile/addresses
 * @access  Private
 */
export const addAddress = asyncHandler(async (req, res) => {
    const { street, city, zipCode, coordinates, isDefault } = req.body;

    // Validate required fields
    RequestValidator.validateRequired(
        { street, city, zipCode, coordinates },
        ['street', 'city', 'zipCode', 'coordinates'],
        {
            street: 'Street Address',
            city: 'City',
            zipCode: 'ZIP Code',
            coordinates: 'Coordinates'
        }
    );

    try {
        const user = await User.findById(req.user._id);
        
        if (!user) {
            SecurityLogger.logDataAccess(req, 'USER', req.user._id, false, {
                action: 'UPDATE',
                purpose: 'ADDRESS_ADD',
                error: 'USER_NOT_FOUND'
            });
            throw ValidationErrors.USER_NOT_FOUND;
        }

        // Validate input data
        RequestValidator.validateString(street, 'street', 1, 200);
        RequestValidator.validateString(city, 'city', 1, 100);
        RequestValidator.validateString(zipCode, 'zipCode', 1, 20);

        // Validate coordinates
        if (!Array.isArray(coordinates) || coordinates.length !== 2) {
            throw ValidationErrors.INVALID_COORDINATES_FORMAT;
        }

        const [longitude, latitude] = coordinates;
        if (typeof longitude !== 'number' || typeof latitude !== 'number' ||
            longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
            throw ValidationErrors.INVALID_COORDINATES_RANGE;
        }

        // If this is set as default, unset other default addresses
        if (isDefault) {
            user.profile.addresses.forEach(addr => {
                addr.isDefault = false;
            });
        }

        // Add new address
        const newAddress = {
            street: street.trim(),
            city: city.trim(),
            zipCode: zipCode.trim(),
            coordinates: {
                type: 'Point',
                coordinates: [longitude, latitude]
            },
            isDefault: Boolean(isDefault) || user.profile.addresses.length === 0 // First address is default
        };

        user.profile.addresses.push(newAddress);
        await user.save();

        SecurityLogger.logDataAccess(req, 'USER', user._id, true, {
            action: 'UPDATE',
            purpose: 'ADDRESS_ADD',
            addressCount: user.profile.addresses.length
        });

        res.status(201).json({
            success: true,
            data: {
                address: user.profile.addresses[user.profile.addresses.length - 1],
                totalAddresses: user.profile.addresses.length
            },
            message: 'Address added successfully'
        });
    } catch (error) {
        if (error instanceof SecureError) {
            throw error;
        }
        
        console.error('[PROFILE_ERROR] Add address failed:', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            userId: req.user._id
        });

        throw ValidationErrors.OPERATION_FAILED;
    }
});

/**
 * @desc    Update existing address
 * @route   PUT /api/profile/addresses/:addressId
 * @access  Private
 */
export const updateAddress = asyncHandler(async (req, res) => {
    const { addressId } = req.params;
    const { street, city, zipCode, coordinates, isDefault } = req.body;

    try {
        const user = await User.findById(req.user._id);
        
        if (!user) {
            SecurityLogger.logDataAccess(req, 'USER', req.user._id, false, {
                action: 'UPDATE',
                purpose: 'ADDRESS_UPDATE',
                error: 'USER_NOT_FOUND'
            });
            throw ValidationErrors.USER_NOT_FOUND;
        }

        // Find the address to update
        const address = user.profile.addresses.id(addressId);
        if (!address) {
            throw ValidationErrors.ADDRESS_NOT_FOUND;
        }

        // Validate and update fields
        if (street !== undefined) {
            RequestValidator.validateString(street, 'street', 1, 200);
            address.street = street.trim();
        }

        if (city !== undefined) {
            RequestValidator.validateString(city, 'city', 1, 100);
            address.city = city.trim();
        }

        if (zipCode !== undefined) {
            RequestValidator.validateString(zipCode, 'zipCode', 1, 20);
            address.zipCode = zipCode.trim();
        }

        if (coordinates !== undefined) {
            if (!Array.isArray(coordinates) || coordinates.length !== 2) {
                throw ValidationErrors.INVALID_COORDINATES_FORMAT;
            }

            const [longitude, latitude] = coordinates;
            if (typeof longitude !== 'number' || typeof latitude !== 'number' ||
                longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
                throw ValidationErrors.INVALID_COORDINATES_RANGE;
            }

            address.coordinates = {
                type: 'Point',
                coordinates: [longitude, latitude]
            };
        }

        if (isDefault !== undefined && isDefault) {
            // Unset other default addresses
            user.profile.addresses.forEach(addr => {
                if (addr._id.toString() !== addressId) {
                    addr.isDefault = false;
                }
            });
            address.isDefault = true;
        } else if (isDefault === false) {
            address.isDefault = false;
        }

        await user.save();

        SecurityLogger.logDataAccess(req, 'USER', user._id, true, {
            action: 'UPDATE',
            purpose: 'ADDRESS_UPDATE',
            addressId: addressId,
            fieldsUpdated: Object.keys(req.body)
        });

        res.json({
            success: true,
            data: {
                address: address,
                totalAddresses: user.profile.addresses.length
            },
            message: 'Address updated successfully'
        });
    } catch (error) {
        if (error instanceof SecureError) {
            throw error;
        }
        
        console.error('[PROFILE_ERROR] Update address failed:', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            userId: req.user._id,
            addressId: addressId
        });

        throw ValidationErrors.OPERATION_FAILED;
    }
});

/**
 * @desc    Delete address
 * @route   DELETE /api/profile/addresses/:addressId
 * @access  Private
 */
export const deleteAddress = asyncHandler(async (req, res) => {
    const { addressId } = req.params;

    try {
        const user = await User.findById(req.user._id);
        
        if (!user) {
            SecurityLogger.logDataAccess(req, 'USER', req.user._id, false, {
                action: 'UPDATE',
                purpose: 'ADDRESS_DELETE',
                error: 'USER_NOT_FOUND'
            });
            throw ValidationErrors.USER_NOT_FOUND;
        }

        // Find the address to delete
        const address = user.profile.addresses.id(addressId);
        if (!address) {
            throw ValidationErrors.ADDRESS_NOT_FOUND;
        }

        // Check if this is the only address
        if (user.profile.addresses.length === 1) {
            throw ValidationErrors.CANNOT_DELETE_LAST_ADDRESS;
        }

        const wasDefault = address.isDefault;
        
        // Remove the address
        user.profile.addresses.pull(addressId);

        // If the deleted address was default, set the first remaining address as default
        if (wasDefault && user.profile.addresses.length > 0) {
            user.profile.addresses[0].isDefault = true;
        }

        await user.save();

        SecurityLogger.logDataAccess(req, 'USER', user._id, true, {
            action: 'UPDATE',
            purpose: 'ADDRESS_DELETE',
            addressId: addressId,
            remainingAddresses: user.profile.addresses.length
        });

        res.json({
            success: true,
            data: {
                deletedAddressId: addressId,
                totalAddresses: user.profile.addresses.length
            },
            message: 'Address deleted successfully'
        });
    } catch (error) {
        if (error instanceof SecureError) {
            throw error;
        }
        
        console.error('[PROFILE_ERROR] Delete address failed:', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            userId: req.user._id,
            addressId: addressId
        });

        throw ValidationErrors.OPERATION_FAILED;
    }
});

/**
 * @desc    Set default address
 * @route   PUT /api/profile/addresses/:addressId/default
 * @access  Private
 */
export const setDefaultAddress = asyncHandler(async (req, res) => {
    const { addressId } = req.params;

    try {
        const user = await User.findById(req.user._id);
        
        if (!user) {
            SecurityLogger.logDataAccess(req, 'USER', req.user._id, false, {
                action: 'UPDATE',
                purpose: 'ADDRESS_SET_DEFAULT',
                error: 'USER_NOT_FOUND'
            });
            throw ValidationErrors.USER_NOT_FOUND;
        }

        // Find the address to set as default
        const address = user.profile.addresses.id(addressId);
        if (!address) {
            throw ValidationErrors.ADDRESS_NOT_FOUND;
        }

        // Unset all other default addresses and set this one as default
        user.profile.addresses.forEach(addr => {
            addr.isDefault = addr._id.toString() === addressId;
        });

        await user.save();

        SecurityLogger.logDataAccess(req, 'USER', user._id, true, {
            action: 'UPDATE',
            purpose: 'ADDRESS_SET_DEFAULT',
            addressId: addressId
        });

        res.json({
            success: true,
            data: {
                address: address,
                totalAddresses: user.profile.addresses.length
            },
            message: 'Default address updated successfully'
        });
    } catch (error) {
        if (error instanceof SecureError) {
            throw error;
        }
        
        console.error('[PROFILE_ERROR] Set default address failed:', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            userId: req.user._id,
            addressId: addressId
        });

        throw ValidationErrors.OPERATION_FAILED;
    }
});

/**
 * @desc    Get all addresses
 * @route   GET /api/profile/addresses
 * @access  Private
 */
export const getAddresses = asyncHandler(async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('profile.addresses');
        
        if (!user) {
            SecurityLogger.logDataAccess(req, 'USER', req.user._id, false, {
                action: 'READ',
                purpose: 'ADDRESSES_ACCESS',
                error: 'USER_NOT_FOUND'
            });
            throw ValidationErrors.USER_NOT_FOUND;
        }

        SecurityLogger.logDataAccess(req, 'USER', user._id, true, {
            action: 'READ',
            purpose: 'ADDRESSES_ACCESS',
            addressCount: user.profile.addresses.length
        });

        res.json({
            success: true,
            data: {
                addresses: user.profile.addresses,
                totalAddresses: user.profile.addresses.length
            },
            message: 'Addresses retrieved successfully'
        });
    } catch (error) {
        if (error instanceof SecureError) {
            throw error;
        }
        
        console.error('[PROFILE_ERROR] Get addresses failed:', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            userId: req.user._id
        });

        throw ValidationErrors.OPERATION_FAILED;
    }
});