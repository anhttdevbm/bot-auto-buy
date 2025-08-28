const express = require('express');
const userController = require('../controllers/userController');
const { authenticate, adminOnly, staffOrAdmin } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

const userModificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

router.use(authenticate);

router.get('/', staffOrAdmin, generalLimiter, userController.getUsers);
router.get('/stats', adminOnly, generalLimiter, userController.getUserStats);
router.get('/:id', staffOrAdmin, generalLimiter, userController.getUserById);

router.post('/', adminOnly, userModificationLimiter, userController.createUser);
router.put('/:id', userModificationLimiter, userController.updateUser);
router.delete('/:id', adminOnly, userModificationLimiter, userController.deleteUser);
router.post('/:id/reset-password', adminOnly, userModificationLimiter, userController.resetUserPassword);

module.exports = router;

