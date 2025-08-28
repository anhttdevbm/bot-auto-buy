const User = require('../models/User');
const jwtService = require('../auth/jwtService');
const logger = require('../config/logger');
const validator = require('validator');

class AuthController {
    async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password are required'
                });
            }

            if (!validator.isEmail(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email format'
                });
            }

            const user = await User.findByEmail(email);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                logger.warn(`Failed login attempt for email: ${email}`);
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            await User.updateLastLogin(user.id);

            const tokens = jwtService.generateTokens(user);

            logger.info(`User logged in: ${user.email} (${user.role})`);

            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: user.toJSON(),
                    ...tokens
                }
            });

        } catch (error) {
            logger.error('Login error:', error.message);
            res.status(500).json({
                success: false,
                message: 'Login failed',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    async register(req, res) {
        try {
            const { email, password, role, first_name, last_name } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password are required'
                });
            }

            if (!validator.isEmail(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email format'
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 6 characters long'
                });
            }

            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'User with this email already exists'
                });
            }

            const newUser = new User({
                email,
                password,
                role: role || 'viewer',
                first_name,
                last_name
            });

            const userId = await newUser.save();
            const createdUser = await User.findById(userId);

            logger.info(`New user registered: ${email} (${role || 'viewer'}) by ${req.user.email}`);

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: {
                    user: createdUser.toJSON()
                }
            });

        } catch (error) {
            logger.error('Registration error:', error.message);
            
            if (error.message.includes('Validation failed')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Registration failed',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    message: 'Refresh token is required'
                });
            }

            const tokens = await jwtService.refreshTokens(refreshToken);

            res.json({
                success: true,
                message: 'Token refreshed successfully',
                data: tokens
            });

        } catch (error) {
            logger.error('Token refresh error:', error.message);
            
            if (error.message.includes('Invalid') || error.message.includes('expired')) {
                return res.status(401).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Token refresh failed'
            });
        }
    }

    async logout(req, res) {
        try {
            const token = req.token;
            
            if (token) {
                await jwtService.revokeToken(token);
            }

            logger.info(`User logged out: ${req.user.email}`);

            res.json({
                success: true,
                message: 'Logout successful'
            });

        } catch (error) {
            logger.error('Logout error:', error.message);
            res.status(500).json({
                success: false,
                message: 'Logout failed'
            });
        }
    }

    async logoutAll(req, res) {
        try {
            await jwtService.revokeAllUserTokens(req.user.id);

            logger.info(`All sessions revoked for user: ${req.user.email}`);

            res.json({
                success: true,
                message: 'All sessions logged out successfully'
            });

        } catch (error) {
            logger.error('Logout all error:', error.message);
            res.status(500).json({
                success: false,
                message: 'Logout all failed'
            });
        }
    }

    async getProfile(req, res) {
        try {
            res.json({
                success: true,
                data: {
                    user: req.user.toJSON()
                }
            });

        } catch (error) {
            logger.error('Get profile error:', error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to get profile'
            });
        }
    }

    async updateProfile(req, res) {
        try {
            const { first_name, last_name, email } = req.body;
            const user = req.user;

            if (first_name !== undefined) user.first_name = first_name;
            if (last_name !== undefined) user.last_name = last_name;
            
            if (email !== undefined) {
                if (!validator.isEmail(email)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid email format'
                    });
                }

                const existingUser = await User.findByEmail(email);
                if (existingUser && existingUser.id !== user.id) {
                    return res.status(409).json({
                        success: false,
                        message: 'Email already in use'
                    });
                }

                user.email = email;
            }

            await user.save();
            const updatedUser = await User.findById(user.id);

            logger.info(`Profile updated for user: ${user.email}`);

            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: {
                    user: updatedUser.toJSON()
                }
            });

        } catch (error) {
            logger.error('Update profile error:', error.message);
            
            if (error.message.includes('Validation failed')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Profile update failed'
            });
        }
    }

    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password and new password are required'
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'New password must be at least 6 characters long'
                });
            }

            const isCurrentPasswordValid = await req.user.comparePassword(currentPassword);
            if (!isCurrentPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
            }

            req.user.password = newPassword;
            await req.user.save();

            await jwtService.revokeAllUserTokens(req.user.id);

            logger.info(`Password changed for user: ${req.user.email}`);

            res.json({
                success: true,
                message: 'Password changed successfully. Please login again.'
            });

        } catch (error) {
            logger.error('Change password error:', error.message);
            res.status(500).json({
                success: false,
                message: 'Password change failed'
            });
        }
    }
}

module.exports = new AuthController();


