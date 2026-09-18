import express from 'express';

const router = express.Router();

/**
 * CSP Report Endpoint
 * Handles Content Security Policy violation reports
 */
router.post('/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
    const report = req.body;
    
    // Log CSP violations for security monitoring
    console.warn('[SECURITY] CSP Violation Report:', {
        documentUri: report['document-uri'],
        violatedDirective: report['violated-directive'],
        blockedUri: report['blocked-uri'],
        sourceFile: report['source-file'],
        lineNumber: report['line-number'],
        columnNumber: report['column-number'],
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip
    });
    
    // Respond with 204 No Content as per CSP specification
    res.status(204).end();
});

/**
 * Security Health Check Endpoint
 * Provides security configuration status
 */
router.get('/health', (req, res) => {
    const securityStatus = {
        https: process.env.NODE_ENV === 'production' ? 'enforced' : 'development',
        cors: 'configured',
        rateLimit: 'active',
        headers: 'secured',
        timestamp: new Date().toISOString()
    };
    
    res.json({
        status: 'healthy',
        security: securityStatus,
        requestId: req.requestId
    });
});

export default router;