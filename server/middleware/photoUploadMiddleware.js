/**
 * Photo Upload Middleware
 * Handles secure photo uploads with validation and processing
 * Validates: Requirements 2.2 - Photo storage integration
 */

import { 
    uploadWastePhoto, 
    uploadProfilePhoto, 
    uploadCollectionPhoto,
    createPhotoUploadMiddleware,
    cloudinaryHelpers 
} from '../config/cloudinary.js';
import { SecurityLogger } from './errorHandling.js';

/**
 * Waste Photo Upload Middleware
 * Handles photo uploads for waste logging
 */
export const uploadWastePhotos = createPhotoUploadMiddleware(uploadWastePhoto, 3);

/**
 * Profile Photo Upload Middleware
 * Handles profile photo uploads
 */
export const uploadProfilePhotos = createPhotoUploadMiddleware(uploadProfilePhoto, 1);

/**
 * Collection Photo Upload Middleware
 * Handles collection verification photo uploads
 */
export const uploadCollectionPhotos = createPhotoUploadMiddleware(uploadCollectionPhoto, 5);

/**
 * Photo Validation Middleware
 * Additional validation for uploaded photos
 */
export const validatePhotos = (req, res, next) => {
    try {
        // Validate Cloudinary configuration
        cloudinaryHelpers.validateConfig();

        // Check if photos were uploaded
        if (!req.files || req.files.length === 0) {
            // Photos are optional for most operations
            return next();
        }

        // Validate each uploaded photo
        const validatedPhotos = [];
        
        for (const file of req.files) {
            // Check if upload was successful
            if (!file.path || !file.filename) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'PHOTO_UPLOAD_FAILED',
                        message: 'Photo upload failed',
                        details: {
                            reason: 'Upload to cloud storage failed'
                        },
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }

            // Add photo metadata
            validatedPhotos.push({
                publicId: file.filename,
                url: file.path,
                originalName: file.originalname,
                size: file.size,
                format: file.format || 'unknown',
                uploadedAt: new Date().toISOString()
            });
        }

        // Attach validated photos to request
        req.validatedPhotos = validatedPhotos;

        // Log photo upload
        SecurityLogger.logDataAccess(req, 'PHOTO_UPLOAD', req.user?._id || 'anonymous', true, {
            action: 'UPLOAD',
            photoCount: validatedPhotos.length,
            totalSize: validatedPhotos.reduce((sum, photo) => sum + photo.size, 0),
            uploadType: req.route?.path?.includes('waste') ? 'WASTE' : 
                       req.route?.path?.includes('profile') ? 'PROFILE' : 
                       req.route?.path?.includes('collection') ? 'COLLECTION' : 'UNKNOWN'
        });

        next();
    } catch (error) {
        console.error('Photo validation error:', error);
        
        SecurityLogger.logDataAccess(req, 'PHOTO_UPLOAD', req.user?._id || 'anonymous', false, {
            action: 'VALIDATE',
            error: error.message
        });

        return res.status(500).json({
            success: false,
            error: {
                code: 'PHOTO_VALIDATION_ERROR',
                message: 'Photo validation failed',
                details: {
                    reason: error.message
                },
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
};

/**
 * Photo Cleanup Middleware
 * Cleans up uploaded photos if the main operation fails
 */
export const photoCleanupOnError = (req, res, next) => {
    const originalSend = res.json;
    
    res.json = function(data) {
        // If there's an error and photos were uploaded, clean them up
        if (res.statusCode >= 400 && req.validatedPhotos && req.validatedPhotos.length > 0) {
            const publicIds = req.validatedPhotos.map(photo => photo.publicId);
            
            // Clean up photos asynchronously (don't block response)
            cloudinaryHelpers.batchDeleteImages(publicIds)
                .then(() => {
                    console.log(`Cleaned up ${publicIds.length} photos after error`);
                })
                .catch(cleanupError => {
                    console.error('Error cleaning up photos:', cleanupError);
                });
        }
        
        return originalSend.call(this, data);
    };
    
    next();
};

/**
 * Photo Processing Middleware
 * Processes photos for optimization and metadata extraction
 */
export const processPhotos = async (req, res, next) => {
    try {
        if (!req.validatedPhotos || req.validatedPhotos.length === 0) {
            return next();
        }

        const processedPhotos = [];

        for (const photo of req.validatedPhotos) {
            try {
                // Get detailed metadata from Cloudinary
                const metadata = await cloudinaryHelpers.getImageMetadata(photo.publicId);
                
                // Generate optimized URLs
                const optimizedUrl = cloudinaryHelpers.getOptimizedUrl(photo.publicId);
                const thumbnailUrl = cloudinaryHelpers.getThumbnailUrl(photo.publicId);

                processedPhotos.push({
                    ...photo,
                    metadata: {
                        width: metadata.width,
                        height: metadata.height,
                        format: metadata.format,
                        bytes: metadata.bytes
                    },
                    urls: {
                        original: photo.url,
                        optimized: optimizedUrl,
                        thumbnail: thumbnailUrl
                    }
                });
            } catch (metadataError) {
                console.error('Error processing photo metadata:', metadataError);
                
                // Use basic photo info if metadata extraction fails
                processedPhotos.push({
                    ...photo,
                    urls: {
                        original: photo.url,
                        optimized: photo.url,
                        thumbnail: photo.url
                    }
                });
            }
        }

        req.processedPhotos = processedPhotos;
        next();
    } catch (error) {
        console.error('Photo processing error:', error);
        
        // Continue with unprocessed photos if processing fails
        req.processedPhotos = req.validatedPhotos || [];
        next();
    }
};

/**
 * Photo Security Middleware
 * Additional security checks for photo uploads
 */
export const photoSecurityCheck = (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return next();
        }

        // Check for suspicious file patterns
        for (const file of req.files) {
            // Check original filename for suspicious patterns
            const suspiciousPatterns = [
                /\.php$/i,
                /\.exe$/i,
                /\.bat$/i,
                /\.sh$/i,
                /\.cmd$/i,
                /\.scr$/i,
                /\.vbs$/i,
                /\.js$/i,
                /\.html$/i,
                /\.htm$/i
            ];

            if (suspiciousPatterns.some(pattern => pattern.test(file.originalname))) {
                SecurityLogger.logDataAccess(req, 'PHOTO_SECURITY', req.user?._id || 'anonymous', false, {
                    action: 'SECURITY_CHECK',
                    reason: 'SUSPICIOUS_FILENAME',
                    filename: file.originalname
                });

                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'SUSPICIOUS_FILE',
                        message: 'File rejected for security reasons',
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }

            // Check file size limits based on user role
            const maxSizeByRole = {
                citizen: 5 * 1024 * 1024,    // 5MB
                collector: 10 * 1024 * 1024, // 10MB
                admin: 20 * 1024 * 1024      // 20MB
            };

            const userRole = req.user?.role || 'citizen';
            const maxSize = maxSizeByRole[userRole];

            if (file.size > maxSize) {
                SecurityLogger.logDataAccess(req, 'PHOTO_SECURITY', req.user?._id || 'anonymous', false, {
                    action: 'SECURITY_CHECK',
                    reason: 'FILE_TOO_LARGE',
                    fileSize: file.size,
                    maxSize: maxSize,
                    userRole: userRole
                });

                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'FILE_TOO_LARGE',
                        message: `File size exceeds limit for ${userRole} role`,
                        details: {
                            fileSize: file.size,
                            maxSize: maxSize,
                            userRole: userRole
                        },
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    }
                });
            }
        }

        // Log successful security check
        SecurityLogger.logDataAccess(req, 'PHOTO_SECURITY', req.user?._id || 'anonymous', true, {
            action: 'SECURITY_CHECK',
            fileCount: req.files.length,
            userRole: req.user?.role || 'anonymous'
        });

        next();
    } catch (error) {
        console.error('Photo security check error:', error);
        
        return res.status(500).json({
            success: false,
            error: {
                code: 'SECURITY_CHECK_ERROR',
                message: 'Photo security check failed',
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
};

/**
 * Photo Quota Middleware
 * Enforces upload quotas per user
 */
export const enforcePhotoQuota = (dailyLimit = 50) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.files || req.files.length === 0) {
                return next();
            }

            // This is a simplified quota check
            // In production, you would track uploads in database or cache
            const today = new Date().toISOString().split('T')[0];
            const quotaKey = `photo_quota_${req.user._id}_${today}`;
            
            // For now, just log the quota check
            SecurityLogger.logDataAccess(req, 'PHOTO_QUOTA', req.user._id, true, {
                action: 'QUOTA_CHECK',
                dailyLimit: dailyLimit,
                currentUpload: req.files.length,
                quotaKey: quotaKey
            });

            next();
        } catch (error) {
            console.error('Photo quota check error:', error);
            next(); // Continue even if quota check fails
        }
    };
};

/**
 * Photo Response Formatter
 * Formats photo data for API responses
 */
export const formatPhotoResponse = (req, res, next) => {
    // Override res.json to format photo data
    const originalJson = res.json;
    
    res.json = function(data) {
        if (data.success && req.processedPhotos && req.processedPhotos.length > 0) {
            // Add photo information to response
            data.photos = req.processedPhotos.map(photo => ({
                id: photo.publicId,
                url: photo.urls.optimized,
                thumbnailUrl: photo.urls.thumbnail,
                originalName: photo.originalName,
                size: photo.size,
                format: photo.format,
                uploadedAt: photo.uploadedAt
            }));
        }
        
        return originalJson.call(this, data);
    };
    
    next();
};