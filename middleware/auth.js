const jwtService = require('../auth/jwtService');
const User = require('../models/User');
const logger = require('../config/logger');
    
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        const token = authHeader.substring(7);
        
        const decoded = jwtService.verifyToken(token);
        
        if (decoded.jti && decoded.type === 'refresh') {
            const isRevoked = await jwtService.isTokenRevoked(decoded.jti, 'refresh');
            if (isRevoked) {
                return res.status(401).json({
                    success: false,
                    message: 'Token has been revoked'
                });
            }
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        req.user = user;
        req.token = token;
        
        next();
    } catch (error) {
        logger.error('Authentication error:', error.message);
        
        if (error.message.includes('expired')) {
            return res.status(401).json({
                success: false,
                message: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
        }
        
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
};

const authorize = (resource, action) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const hasPermission = await req.user.hasPermission(resource, action);
            
            if (!hasPermission) {
                logger.warn(`Access denied: User ${req.user.email} (${req.user.role}) tried to ${action} on ${resource}`);
                
                return res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions',
                    required: `${action} on ${resource}`,
                    userRole: req.user.role
                });
            }

            next();
        } catch (error) {
            logger.error('Authorization error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Authorization check failed'
            });
        }
    };
};

const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            logger.warn(`Access denied: User ${req.user.email} (${req.user.role}) tried to access resource requiring roles: ${roles.join(', ')}`);
            
            return res.status(403).json({
                success: false,
                message: 'Insufficient role permissions',
                required: roles,
                userRole: req.user.role
            });
        }

        next();
    };
};

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.substring(7);
        const decoded = jwtService.verifyToken(token);
        
        if (decoded.jti && decoded.type === 'refresh') {
            const isRevoked = await jwtService.isTokenRevoked(decoded.jti, 'refresh');
            if (isRevoked) {
                return next();
            }
        }

        const user = await User.findById(decoded.id);
        if (user) {
            req.user = user;
            req.token = token;
        }
        
        next();
    } catch (error) {
        next();
    }
};

const adminOnly = requireRole('admin');

const staffOrAdmin = requireRole('staff', 'admin');

const ownDataOrAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    const targetUserId = parseInt(req.params.userId || req.params.id);
    const isOwnData = req.user.id === targetUserId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwnData && !isAdmin) {
        return res.status(403).json({
            success: false,
            message: 'Access denied: Can only access own data or admin access required'
        });
    }

    next();
};

module.exports = {
    authenticate,
    authorize,
    requireRole,
    optionalAuth,
    adminOnly,
    staffOrAdmin,
    ownDataOrAdmin
};


