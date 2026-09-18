/**
 * Cloudinary Configuration
 * Handles cloud-based image storage and processing
 * Validates: Requirements 2.2 - Photo storage integration
 */

import cloudinary from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configure Cloudinary v1
const cloudinaryV2 = cloudinary.v2;
cloudinaryV2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

/**
 * Cloudinary Storage Configuration for Waste Photos
 */
const wastePhotoStorage = new CloudinaryStorage({
    cloudinary: cloudinaryV2,
    params: {
        folder: 'ecocycle/waste-photos',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
            {
                width: 800,
                height: 600,
                crop: 'limit',
                quality: 'auto:good',
                fetch_format: 'auto'
            }
        ],
        public_id: (req, file) => {
            const timestamp = Date.now();
            const userId = req.user?._id || 'anonymous';
            return `waste_${userId}_${timestamp}`;
        }
    }
});

/**
 * Cloudinary Storage Configuration for Profile Photos
 */
const profilePhotoStorage = new CloudinaryStorage({
    cloudinary: cloudinaryV2,
    params: {
        folder: 'ecocycle/profile-photos',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
            {
                width: 400,
                height: 400,
                crop: 'fill',
                gravity: 'face',
                quality: 'auto:good',
                fetch_format: 'auto'
            }
        ],
        public_id: (req, file) => {
            const timestamp = Date.now();
            const userId = req.user?._id || 'anonymous';
            return `profile_${userId}_${timestamp}`;
        }
    }
});

/**
 * Cloudinary Storage Configuration for Collection Verification Photos
 */
const collectionPhotoStorage = new CloudinaryStorage({
    cloudinary: cloudinaryV2,
    params: {
        folder: 'ecocycle/collection-photos',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
            {
                width: 1200,
                height: 900,
                crop: 'limit',
                quality: 'auto:good',
                fetch_format: 'auto'
            }
        ],
        public_id: (req, file) => {
            const timestamp = Date.now();
            const collectorId = req.user?._id || 'anonymous';
            const pickupId = req.params?.pickupId || 'unknown';
            return `collection_${pickupId}_${collectorId}_${timestamp}`;
        }
    }
});

/**
 * File Filter Function
 * Validates uploaded files for security and format compliance
 */
const fileFilter = (req, file, cb) => {
    // Check file type
    if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed'), false);
    }

    // Check allowed formats
    const allowedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedFormats.includes(file.mimetype)) {
        return cb(new Error('Invalid image format. Only JPEG, PNG, and WebP are allowed'), false);
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        return cb(new Error('File size too large. Maximum size is 5MB'), false);
    }

    cb(null, true);
};

/**
 * Multer Upload Configurations
 */
export const uploadWastePhoto = multer({
    storage: wastePhotoStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 3 // Maximum 3 photos per waste log
    }
});

export const uploadProfilePhoto = multer({
    storage: profilePhotoStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB for profile photos
        files: 1 // Only one profile photo
    }
});

export const uploadCollectionPhoto = multer({
    storage: collectionPhotoStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB for collection verification
        files: 5 // Maximum 5 photos per collection
    }
});

/**
 * Cloudinary Helper Functions
 */
export const cloudinaryHelpers = {
    /**
     * Delete image from Cloudinary
     */
    deleteImage: async (publicId) => {
        try {
            const result = await cloudinaryV2.uploader.destroy(publicId);
            return result;
        } catch (error) {
            console.error('Error deleting image from Cloudinary:', error);
            throw error;
        }
    },

    /**
     * Get optimized image URL
     */
    getOptimizedUrl: (publicId, options = {}) => {
        const defaultOptions = {
            quality: 'auto:good',
            fetch_format: 'auto',
            ...options
        };
        
        return cloudinaryV2.url(publicId, defaultOptions);
    },

    /**
     * Generate thumbnail URL
     */
    getThumbnailUrl: (publicId, width = 150, height = 150) => {
        return cloudinaryV2.url(publicId, {
            width: width,
            height: height,
            crop: 'fill',
            quality: 'auto:good',
            fetch_format: 'auto'
        });
    },

    /**
     * Validate Cloudinary configuration
     */
    validateConfig: () => {
        const requiredVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
        const missing = requiredVars.filter(varName => !process.env[varName]);
        
        if (missing.length > 0) {
            throw new Error(`Missing Cloudinary configuration: ${missing.join(', ')}`);
        }
        
        return true;
    },

    /**
     * Extract public ID from Cloudinary URL
     */
    extractPublicId: (cloudinaryUrl) => {
        if (!cloudinaryUrl) return null;
        
        try {
            const urlParts = cloudinaryUrl.split('/');
            const filename = urlParts[urlParts.length - 1];
            const publicId = filename.split('.')[0];
            
            // Include folder path if present
            const folderIndex = urlParts.findIndex(part => part === 'ecocycle');
            if (folderIndex !== -1) {
                const folderPath = urlParts.slice(folderIndex, -1).join('/');
                return `${folderPath}/${publicId}`;
            }
            
            return publicId;
        } catch (error) {
            console.error('Error extracting public ID from URL:', error);
            return null;
        }
    },

    /**
     * Batch delete images
     */
    batchDeleteImages: async (publicIds) => {
        try {
            const result = await cloudinaryV2.api.delete_resources(publicIds);
            return result;
        } catch (error) {
            console.error('Error batch deleting images:', error);
            throw error;
        }
    },

    /**
     * Get image metadata
     */
    getImageMetadata: async (publicId) => {
        try {
            const result = await cloudinaryV2.api.resource(publicId);
            return {
                publicId: result.public_id,
                format: result.format,
                width: result.width,
                height: result.height,
                bytes: result.bytes,
                url: result.secure_url,
                createdAt: result.created_at
            };
        } catch (error) {
            console.error('Error getting image metadata:', error);
            throw error;
        }
    }
};

/**
 * Photo Upload Middleware with Error Handling
 */
export const createPhotoUploadMiddleware = (uploadConfig, maxFiles = 1) => {
    return (req, res, next) => {
        const upload = uploadConfig.array('photos', maxFiles);
        
        upload(req, res, (error) => {
            if (error) {
                console.error('Photo upload error:', error);
                
                let errorMessage = 'Photo upload failed';
                let statusCode = 400;
                
                if (error.code === 'LIMIT_FILE_SIZE') {
                    errorMessage = 'File size too large';
                } else if (error.code === 'LIMIT_FILE_COUNT') {
                    errorMessage = `Too many files. Maximum ${maxFiles} files allowed`;
                } else if (error.message.includes('Only image files')) {
                    errorMessage = 'Only image files are allowed';
                } else if (error.message.includes('Invalid image format')) {
                    errorMessage = 'Invalid image format. Only JPEG, PNG, and WebP are allowed';
                }
                
                return res.status(statusCode).json({
                    success: false,
                    error: {
                        code: 'PHOTO_UPLOAD_ERROR',
                        message: errorMessage,
                        details: {
                            reason: error.message
                        },
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }
            
            // Add uploaded file information to request
            if (req.files && req.files.length > 0) {
                req.uploadedPhotos = req.files.map(file => ({
                    publicId: file.filename,
                    url: file.path,
                    originalName: file.originalname,
                    size: file.size,
                    format: file.format
                }));
            }
            
            next();
        });
    };
};

export default cloudinaryV2;