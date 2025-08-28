const express = require('express');
const authController = require('../controllers/authController');
const { authenticate, adminOnly } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/login', authLimiter, authController.login);
router.post('/refresh', authLimiter, authController.refreshToken);

router.use(authenticate);

router.post('/logout', generalLimiter, authController.logout);
router.post('/logout-all', generalLimiter, authController.logoutAll);
router.get('/profile', generalLimiter, authController.getProfile);
router.put('/profile', generalLimiter, authController.updateProfile);
router.post('/change-password', authLimiter, authController.changePassword);

router.post('/register', adminOnly, authController.register);

module.exports = router;


