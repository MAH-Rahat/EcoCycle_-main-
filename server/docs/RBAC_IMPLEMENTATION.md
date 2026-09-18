# Role-Based Access Control (RBAC) Implementation

## Overview

The EcoCycle platform implements a comprehensive Role-Based Access Control (RBAC) system that provides granular permission management and secure access control for all system resources. This implementation validates Requirements 12.4, 12.5, and 16.3.

## Architecture

### Core Components

1. **Authentication Middleware** (`authMiddleware.js`)
   - JWT token validation
   - User authentication and session management
   - Account status verification

2. **RBAC Configuration** (`rbacConfig.js`)
   - Permission definitions
   - Role-permission matrix
   - Resource access rules
   - Admin operation categories

3. **RBAC Middleware** (`rbacMiddleware.js`)
   - Advanced authorization functions
   - Dynamic permission checking
   - Resource-based access control
   - Audit logging

## User Roles

### Citizen
- **Purpose**: End users who log waste and request pickups
- **Key Permissions**:
  - Create and manage waste logs
  - Create and manage pickup requests
  - View personal impact dashboard
  - Redeem rewards
  - Participate in challenges

### Collector
- **Purpose**: Personnel responsible for waste collection and verification
- **Key Permissions**:
  - View assigned pickup requests
  - Update pickup status
  - Verify QR codes
  - Create collection reports
  - Update tracking information

### Admin
- **Purpose**: System administrators with full platform access
- **Key Permissions**:
  - All system operations
  - User management
  - System configuration
  - Analytics and reporting
  - Content management

## Permission System

### Permission Format
Permissions follow the format: `resource:action:scope`

Examples:
- `waste:create` - Create waste logs
- `pickup:read:own` - Read own pickup requests
- `admin:users` - Admin user management operations

### Permission Categories

#### Waste Management
- `waste:create` - Create waste logs
- `waste:read:own` - Read own waste logs
- `waste:read:all` - Read all waste logs (admin)
- `waste:update:own` - Update own waste logs
- `waste:verify` - Verify waste logs (collector)

#### Pickup Management
- `pickup:create` - Create pickup requests
- `pickup:read:assigned` - Read assigned pickups (collector)
- `pickup:complete` - Complete pickups (collector)
- `pickup:assign` - Assign pickups (admin)

#### User Management
- `user:read:own` - Read own user data
- `user:read:all` - Read all user data (admin)
- `user:update:all` - Update any user (admin)
- `user:activate` - Activate/deactivate users (admin)

## Middleware Usage

### Basic Authentication
```javascript
import { protect } from '../middleware/authMiddleware.js';

// Require authentication for all routes
router.use(protect);
```

### Role-Based Authorization
```javascript
import { authorize } from '../middleware/authMiddleware.js';

// Allow only admins and collectors
router.get('/admin-data', protect, authorize('admin', 'collector'), handler);
```

### Permission-Based Authorization
```javascript
import { requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../middleware/rbacConfig.js';

// Require specific permission
router.post('/waste', protect, requirePermission(PERMISSIONS.WASTE_CREATE), handler);
```

### Resource Ownership
```javascript
import { requireOwnership } from '../middleware/authMiddleware.js';

// Users can only access their own resources (admins can access all)
router.get('/profile/:id', protect, requireOwnership('id'), handler);
```

### Admin Operations
```javascript
import { requireAdmin } from '../middleware/authMiddleware.js';
import { checkAdminOperation } from '../middleware/rbacMiddleware.js';

// Require admin role and specific admin operation permissions
router.get('/admin/users', 
    protect, 
    requireAdmin, 
    checkAdminOperation('USER_MANAGEMENT'), 
    handler
);
```

### Dynamic Permission Checking
```javascript
import { checkPermissions } from '../middleware/rbacMiddleware.js';

// Single permission
router.post('/data', protect, checkPermissions(PERMISSIONS.DATA_CREATE), handler);

// Multiple permissions (ALL required)
router.put('/data', protect, checkPermissions([
    PERMISSIONS.DATA_UPDATE,
    PERMISSIONS.DATA_VERIFY
]), handler);

// Any permission (OR logic)
router.get('/data', protect, checkPermissions({
    any: [PERMISSIONS.DATA_READ_OWN, PERMISSIONS.DATA_READ_ALL]
}), handler);

// Dynamic permission function
router.delete('/data/:id', protect, checkPermissions((user, req) => ({
    allowed: user.role === 'admin' || req.params.id === user._id.toString(),
    permissions: ['data:delete']
})), handler);
```

### Route Protection Configurations
```javascript
import { protectRoute } from '../middleware/rbacMiddleware.js';

// Use predefined protection configurations
router.get('/public-data', protectRoute('PUBLIC'), handler);
router.get('/user-data', protectRoute('AUTHENTICATED'), handler);
router.get('/admin-data', protectRoute('ADMIN_ONLY'), handler);
router.get('/own-data', protectRoute('OWN_RESOURCE'), handler);
```

### Resource-Based Access Control
```javascript
import { checkResourceAccess } from '../middleware/rbacMiddleware.js';

// Check access to specific resource types
router.get('/waste/:id', 
    protect, 
    checkResourceAccess('wasteLog', 'read', async (req) => {
        // Load the waste log resource
        return await WasteLog.findById(req.params.id);
    }), 
    handler
);
```

## Security Features

### Audit Logging
All authorization attempts are logged for security monitoring:

```javascript
import { auditLogger } from '../middleware/rbacMiddleware.js';

// Add audit logging to sensitive routes
router.use('/admin', auditLogger({ category: 'ADMIN_OPERATIONS' }));
```

### Time-Based Access Control
```javascript
import { timeBasedAccess } from '../middleware/rbacMiddleware.js';

// Restrict access to business hours
router.use('/sensitive-operations', timeBasedAccess({
    allowedHours: { start: 9, end: 17 }, // 9 AM to 5 PM
    allowedDays: [1, 2, 3, 4, 5] // Monday to Friday
}));
```

### IP-Based Access Control
```javascript
import { ipBasedAccess } from '../middleware/rbacMiddleware.js';

// Restrict admin access to specific IPs
router.use('/admin', ipBasedAccess({
    allowedIPs: ['192.168.1.100', '10.0.0.50'],
    blockedIPs: ['192.168.1.200']
}));
```

## Error Handling

The RBAC system provides standardized error responses:

### Authentication Errors
- `AUTHENTICATION_REQUIRED` - No authentication provided
- `TOKEN_INVALID` - Invalid or expired token
- `USER_NOT_FOUND` - User account not found
- `ACCOUNT_DISABLED` - User account is disabled

### Authorization Errors
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `INSUFFICIENT_ROLE` - User role not authorized
- `RESOURCE_ACCESS_DENIED` - Cannot access specific resource
- `ADMIN_ACCESS_REQUIRED` - Admin privileges required

### Example Error Response
```json
{
    "error": {
        "code": "INSUFFICIENT_PERMISSIONS",
        "message": "Insufficient permissions for this operation",
        "details": {
            "userRole": "citizen",
            "requiredPermissions": ["admin:users"],
            "resource": "/api/admin/users"
        },
        "timestamp": "2024-01-15T10:30:00Z",
        "requestId": "req_123456789"
    }
}
```

## Best Practices

### 1. Principle of Least Privilege
- Grant users only the minimum permissions needed
- Use specific permissions rather than broad role checks
- Regularly review and audit permissions

### 2. Defense in Depth
- Apply multiple layers of authorization
- Combine role-based and permission-based checks
- Validate resource ownership where applicable

### 3. Secure by Default
- Deny access by default
- Require explicit permission grants
- Log all authorization attempts

### 4. Performance Considerations
- Cache permission lookups where possible
- Use efficient permission checking algorithms
- Minimize database queries in authorization logic

## Testing

### Unit Tests
Test individual middleware functions:

```javascript
describe('RBAC Middleware', () => {
    test('should allow admin access', () => {
        const req = { user: { role: 'admin' } };
        const middleware = authorize('admin');
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
```

### Integration Tests
Test complete authorization flows:

```javascript
test('should protect admin routes', async () => {
    const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${citizenToken}`);
    
    expect(response.status).toBe(403);
});
```

### Property-Based Tests
Validate universal properties:

```javascript
test('Property: Role-based access control enforcement', () => {
    // Test that each role can only access authorized operations
    testRolePermissions('citizen', allowedOps, deniedOps);
    testRolePermissions('collector', allowedOps, deniedOps);
    testRolePermissions('admin', allowedOps, deniedOps);
});
```

## Configuration

### Environment Variables
```bash
# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Security Settings
RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=5
GENERAL_RATE_LIMIT_MAX=100

# Admin Settings
ADMIN_SECRET_CODE=your-admin-code
```

### Permission Customization
Modify `rbacConfig.js` to add new permissions or roles:

```javascript
export const PERMISSIONS = {
    // Add new permissions
    NEW_FEATURE_CREATE: 'new-feature:create',
    NEW_FEATURE_READ: 'new-feature:read'
};

export const ROLE_PERMISSIONS = {
    citizen: [
        // Add permissions to existing roles
        PERMISSIONS.NEW_FEATURE_CREATE
    ],
    // Add new roles
    moderator: [
        PERMISSIONS.NEW_FEATURE_READ,
        PERMISSIONS.USER_READ_ALL
    ]
};
```

## Monitoring and Maintenance

### Security Monitoring
- Monitor failed authorization attempts
- Track permission usage patterns
- Alert on suspicious access patterns
- Regular security audits

### Performance Monitoring
- Track authorization middleware performance
- Monitor database query efficiency
- Optimize permission checking logic
- Cache frequently accessed permissions

### Maintenance Tasks
- Regular permission reviews
- User role audits
- Security policy updates
- Performance optimizations

## Compliance

This RBAC implementation helps ensure compliance with:

- **Data Protection Regulations**: Granular access control to personal data
- **Security Standards**: Defense in depth and least privilege principles
- **Audit Requirements**: Comprehensive logging and monitoring
- **Access Control Standards**: Role-based and attribute-based access control

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Check user role and permissions
   - Verify token validity
   - Review resource ownership

2. **Performance Issues**
   - Optimize permission queries
   - Implement permission caching
   - Review middleware order

3. **Configuration Problems**
   - Validate permission definitions
   - Check role-permission mappings
   - Verify environment variables

### Debug Mode
Enable detailed logging for troubleshooting:

```javascript
// Add to middleware for debugging
console.log('User:', req.user);
console.log('Required permissions:', requiredPermissions);
console.log('User permissions:', getUserPermissions(req.user.role));
```

This comprehensive RBAC system provides secure, scalable, and maintainable access control for the EcoCycle platform while meeting all specified requirements.