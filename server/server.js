import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createServer } from 'http';
import socketService from './services/socketService.js';

// Import Security Middleware
import {
    httpsEnforcement,
    securityHeaders,
    corsConfig,
    authRateLimit,
    generalRateLimit,
    authSlowDown,
    requestId,
    securityLogging,
    contentTypeValidation,
    bodySizeLimit,
    inputSanitization,
    authAttemptMonitoring,
    securityHeadersValidation
} from './middleware/securityMiddleware.js';

// Import Error Handling Middleware
import {
    authErrorHandler,
    secureErrorHandler,
    notFoundHandler
} from './middleware/errorHandling.js';

// Import Routes
import authRoutes from './routes/authRoutes.js';
import wasteRoutes from './routes/wasteRoutes.js'; 
import pickupRoutes from './routes/pickupRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js'; 
import rewardRoutes from './routes/rewardRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import adminUserManagementRoutes from './routes/AdminUserManagementRoutes.js'; 
import userRoutes from './routes/userRoutes.js'; 
import aiAgentRoutes from './routes/aiAgentRoutes.js'; // <-- Newly added for AI Assistant Agent
import ecoPointsRoutes from './routes/ecoPointsRoutes.js'; 
import qrVerificationRoutes from './routes/qrVerificationRoutes.js';
import pickupTrackingRoutes from './routes/pickupTrackingRoutes.js';
import impactDashboardRoutes from './routes/impactDashboardRoutes.js';
import securityRoutes from './routes/securityRoutes.js';
import profileRoutes from './routes/profileRoutes.js'; 
import photoRoutes from './routes/photoRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js'; 
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first'); // Forces Node to follow the system's success

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
socketService.initialize(server);

// Trust proxy for accurate IP addresses (important for rate limiting)
app.set('trust proxy', 1);

// Security Middleware (Applied in order of importance)
app.use(requestId); // Add request ID for tracking
app.use(httpsEnforcement); // Enforce HTTPS for auth endpoints
app.use(securityHeaders); // Apply security headers
app.use(corsConfig); // Configure CORS with security considerations
app.use(securityLogging); // Log security-relevant events
app.use(bodySizeLimit); // Prevent large payload attacks
app.use(contentTypeValidation); // Validate content types
app.use(inputSanitization); // Sanitize user input
app.use(securityHeadersValidation); // Validate security headers

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply general rate limiting to all routes
app.use(generalRateLimit);

// Database Connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connection established successfully.');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

// API Route Registration with Security Middleware
// Authentication routes with enhanced rate limiting, monitoring, and error handling
app.use('/api/auth', authRateLimit, authSlowDown, authAttemptMonitoring, authRoutes, authErrorHandler);

// Other API routes with general rate limiting
app.use('/api/waste', wasteRoutes); 
app.use('/api/pickup', pickupRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/rewards', rewardRoutes); 
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin-users', adminUserManagementRoutes); 
app.use('/api/users', userRoutes); 
app.use('/api/ai', aiAgentRoutes); // <-- AI Agent endpoint registration
app.use('/api/ecopoints', ecoPointsRoutes); 
app.use('/api/qr', qrVerificationRoutes);
app.use('/api/tracking', pickupTrackingRoutes);
app.use('/api/impact', impactDashboardRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/profile', profileRoutes); 
app.use('/api/photos', photoRoutes);
app.use('/api/notifications', notificationRoutes); 

// Health Check for Render
app.get('/', (req, res) => {
    res.send('EcoCycle API is running on Render...');
});

// Error Handling Middleware (Must be after all routes)
// 404 Handler for non-existent routes
app.use(notFoundHandler);

// Global Secure Error Handler
app.use(secureErrorHandler);

// Only connect to MongoDB if not in test mode (test setup handles this)
if (process.env.NODE_ENV !== 'test') {
    connectDB().then(() => {
        // Only start the server if not in test mode
        if (process.env.NODE_ENV !== 'test') {
            server.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
        }
    });
}

export default app;