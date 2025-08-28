const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const logger = require('./config/logger');
const database = require('./database/database');
const jwtService = require('./auth/jwtService');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const botRoutes = require('./routes/bots');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.set('trust proxy', 1);

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001'
        ];
        
        if (NODE_ENV === 'development') {
            allowedOrigins.push(origin);
        }
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', {
        stream: {
            write: (message) => logger.info(message.trim())
        }
    }));
}

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    if (NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    next();
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
        version: require('./package.json').version
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bots', botRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api', (req, res) => {
    res.json({
        name: 'Auto Buy Bot API',
        version: require('./package.json').version,
        description: 'RESTful API for Auto Buy Bot with authentication and RBAC',
        endpoints: {
            auth: {
                'POST /api/auth/login': 'User login',
                'POST /api/auth/logout': 'User logout',
                'POST /api/auth/refresh': 'Refresh access token',
                'GET /api/auth/profile': 'Get user profile',
                'PUT /api/auth/profile': 'Update user profile',
                'POST /api/auth/change-password': 'Change password'
            },
            users: {
                'GET /api/users': 'Get all users (Staff/Admin)',
                'GET /api/users/:id': 'Get user by ID',
                'POST /api/users': 'Create user (Admin)',
                'PUT /api/users/:id': 'Update user',
                'DELETE /api/users/:id': 'Delete user (Admin)',
                'POST /api/users/:id/reset-password': 'Reset user password (Admin)'
            },
            bots: {
                'GET /api/bots/status': 'Get bot status',
                'POST /api/bots/:botType/start': 'Start bot',
                'POST /api/bots/:botType/stop': 'Stop bot',
                'GET /api/bots/:botType/logs': 'Get bot logs',
                'POST /api/bots/stop-all': 'Stop all bots (Admin)'
            }
        },
        supportedBots: ['yodobashi', 'biccamera', 'popmart', 'rakuten'],
        roles: ['admin', 'staff', 'viewer']
    });
});

app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.originalUrl
    });
});

app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    
    if (error.message === 'Not allowed by CORS') {
        return res.status(403).json({
            success: false,
            message: 'CORS: Origin not allowed'
        });
    }
    
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON in request body'
        });
    }
    
    res.status(error.status || 500).json({
        success: false,
        message: NODE_ENV === 'development' ? error.message : 'Internal server error',
        ...(NODE_ENV === 'development' && { stack: error.stack })
    });
});

const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    try {
        database.close();
        
        await jwtService.cleanupExpiredTokens();
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

const server = app.listen(PORT, () => {
    logger.info(`Auto Buy Bot API Server running on port ${PORT}`);
    logger.info(`Environment: ${NODE_ENV}`);
    logger.info(`API Documentation: http://localhost:${PORT}/api`);
    logger.info(`Health Check: http://localhost:${PORT}/health`);
    
    jwtService.cleanupExpiredTokens().catch(error => {
        logger.error('Failed to cleanup expired tokens on startup:', error);
    });
    
    setInterval(() => {
        jwtService.cleanupExpiredTokens().catch(error => {
            logger.error('Failed to cleanup expired tokens:', error);
        });
    }, 60 * 60 * 1000);
});

module.exports = app;




