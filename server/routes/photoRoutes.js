/**
 * Photo Upload Routes
 * Handles photo upload endpoints for different use cases
 * Validates: Requirements 2.2 - Photo storage integration
 */

import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { 
    uploadWastePhotos,
    uploadProfilePhotos,
    uploadCollectionPhotos,
    validatePhotos,
    photoCleanupOnError,
    processPhotos,
    photoSecurityCheck,
    enforcePhotoQuota,
    formatPhotoResponse
} from '../middleware/photoUploadMiddleware.js';
import { SecurityLogger, asyncHandler } from '../middleware/errorHandling.js';

const router = express.Router();

// All photo routes require authentication
router.use(protect);

/**
 * @desc    Upload waste photos
 * @route   POST /api/photos/waste
 * @access  Private (Citizens)
 */
router.post('/waste',
    photoSecurityCheck,
    enforcePhotoQuota(20), // 20 photos per day for waste
    uploadWastePhotos,
    validatePhotos,
    processPhotos,
    photoCleanupOnError,
    formatPhotoResponse,
    asyncHandler(async (req, res) => {
        try {
            if (!req.processedPhotos || req.processedPhotos.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'NO_PHOTOS_UPLOADED',
                        message: 'No photos were uploaded',
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }

            SecurityLogger.logDataAccess(req, 'WASTE_PHOTO', req.user._id, true, {
                action: 'UPLOAD_SUCCESS',
                photoCount: req.processedPhotos.length,
                totalSize: req.processedPhotos.reduce((sum, photo) => sum + photo.size, 0)
            });

            res.status(201).json({
                success: true,
                message: 'Waste photos uploaded successfully',
                data: {
                    uploadedCount: req.processedPhotos.length,
                    photos: req.processedPhotos.map(photo => ({
                        id: photo.publicId,
                        url: photo.urls.optimized,
                        thumbnailUrl: photo.urls.thumbnail,
                        originalName: photo.originalName,
                        size: photo.size,
                        format: photo.format,
                        uploadedAt: photo.uploadedAt
                    }))
                }
            });
        } catch (error) {
            console.error('Waste photo upload error:', error);
            
            return res.status(500).json({
                success: false,
                error: {
                    code: 'PHOTO_UPLOAD_ERROR',
                    message: 'Failed to process waste photos',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }
    })
);

/**
 * @desc    Upload profile photo
 * @route   POST /api/photos/profile
 * @access  Private
 */
router.post('/profile',
    photoSecurityCheck,
    enforcePhotoQuota(5), // 5 profile photos per day
    uploadProfilePhotos,
    validatePhotos,
    processPhotos,
    photoCleanupOnError,
    formatPhotoResponse,
    asyncHandler(async (req, res) => {
        try {
            if (!req.processedPhotos || req.processedPhotos.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'NO_PHOTOS_UPLOADED',
                        message: 'No profile photo was uploaded',
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }

            const photo = req.processedPhotos[0]; // Only one profile photo allowed

            SecurityLogger.logDataAccess(req, 'PROFILE_PHOTO', req.user._id, true, {
                action: 'UPLOAD_SUCCESS',
                photoSize: photo.size
            });

            res.status(201).json({
                success: true,
                message: 'Profile photo uploaded successfully',
                data: {
                    photo: {
                        id: photo.publicId,
                        url: photo.urls.optimized,
                        thumbnailUrl: photo.urls.thumbnail,
                        originalName: photo.originalName,
                        size: photo.size,
                        format: photo.format,
                        uploadedAt: photo.uploadedAt
                    }
                }
            });
        } catch (error) {
            console.error('Profile photo upload error:', error);
            
            return res.status(500).json({
                success: false,
                error: {
                    code: 'PHOTO_UPLOAD_ERROR',
                    message: 'Failed to process profile photo',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }
    })
);

/**
 * @desc    Upload collection verification photos
 * @route   POST /api/photos/collection/:pickupId
 * @access  Private (Collectors)
 */
router.post('/collection/:pickupId',
    photoSecurityCheck,
    enforcePhotoQuota(30), // 30 collection photos per day
    uploadCollectionPhotos,
    validatePhotos,
    processPhotos,
    photoCleanupOnError,
    formatPhotoResponse,
    asyncHandler(async (req, res) => {
        try {
            if (!req.processedPhotos || req.processedPhotos.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'NO_PHOTOS_UPLOADED',
                        message: 'No collection photos were uploaded',
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }

            const { pickupId } = req.params;

            SecurityLogger.logDataAccess(req, 'COLLECTION_PHOTO', req.user._id, true, {
                action: 'UPLOAD_SUCCESS',
                pickupId: pickupId,
                photoCount: req.processedPhotos.length,
                totalSize: req.processedPhotos.reduce((sum, photo) => sum + photo.size, 0)
            });

            res.status(201).json({
                success: true,
                message: 'Collection photos uploaded successfully',
                data: {
                    pickupId: pickupId,
                    uploadedCount: req.processedPhotos.length,
                    photos: req.processedPhotos.map(photo => ({
                        id: photo.publicId,
                        url: photo.urls.optimized,
                        thumbnailUrl: photo.urls.thumbnail,
                        originalName: photo.originalName,
                        size: photo.size,
                        format: photo.format,
                        uploadedAt: photo.uploadedAt
                    }))
                }
            });
        } catch (error) {
            console.error('Collection photo upload error:', error);
            
            return res.status(500).json({
                success: false,
                error: {
                    code: 'PHOTO_UPLOAD_ERROR',
                    message: 'Failed to process collection photos',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }
    })
);

/**
 * @desc    Delete photo
 * @route   DELETE /api/photos/:publicId
 * @access  Private
 */
router.delete('/:publicId',
    asyncHandler(async (req, res) => {
        try {
            const { publicId } = req.params;
            
            // Import cloudinary helpers
            const { cloudinaryHelpers } = await import('../config/cloudinary.js');
            
            // Delete photo from Cloudinary
            const result = await cloudinaryHelpers.deleteImage(publicId);
            
            if (result.result === 'ok') {
                SecurityLogger.logDataAccess(req, 'PHOTO_DELETE', req.user._id, true, {
                    action: 'DELETE_SUCCESS',
                    publicId: publicId
                });

                res.json({
                    success: true,
                    message: 'Photo deleted successfully',
                    data: {
                        publicId: publicId,
                        deleted: true
                    }
                });
            } else {
                SecurityLogger.logDataAccess(req, 'PHOTO_DELETE', req.user._id, false, {
                    action: 'DELETE_FAILED',
                    publicId: publicId,
                    reason: 'CLOUDINARY_ERROR'
                });

                res.status(400).json({
                    success: false,
                    error: {
                        code: 'PHOTO_DELETE_FAILED',
                        message: 'Failed to delete photo',
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }
        } catch (error) {
            console.error('Photo delete error:', error);
            
            SecurityLogger.logDataAccess(req, 'PHOTO_DELETE', req.user._id, false, {
                action: 'DELETE_ERROR',
                publicId: req.params.publicId,
                error: error.message
            });
            
            return res.status(500).json({
                success: false,
                error: {
                    code: 'PHOTO_DELETE_ERROR',
                    message: 'Error deleting photo',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }
    })
);

/**
 * @desc    Get photo metadata
 * @route   GET /api/photos/:publicId/metadata
 * @access  Private
 */
router.get('/:publicId/metadata',
    asyncHandler(async (req, res) => {
        try {
            const { publicId } = req.params;
            
            // Import cloudinary helpers
            const { cloudinaryHelpers } = await import('../config/cloudinary.js');
            
            // Get photo metadata
            const metadata = await cloudinaryHelpers.getImageMetadata(publicId);
            
            SecurityLogger.logDataAccess(req, 'PHOTO_METADATA', req.user._id, true, {
                action: 'METADATA_ACCESS',
                publicId: publicId
            });

            res.json({
                success: true,
                message: 'Photo metadata retrieved successfully',
                data: {
                    metadata: metadata
                }
            });
        } catch (error) {
            console.error('Photo metadata error:', error);
            
            if (error.http_code === 404) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'PHOTO_NOT_FOUND',
                        message: 'Photo not found',
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }
            
            return res.status(500).json({
                success: false,
                error: {
                    code: 'METADATA_ERROR',
                    message: 'Error retrieving photo metadata',
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }
    })
);

export default router;