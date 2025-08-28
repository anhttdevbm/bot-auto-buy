const User = require('../models/User');
const jwtService = require('../auth/jwtService');
const logger = require('../config/logger');
const validator = require('validator');

class UserController {
    async getUsers(req, res) {
        try {
            const {
                page = 1,
                limit = 10,
                role,
                search,
                sortBy = 'created_at',
                sortOrder = 'desc'
            } = req.query;

            const offset = (parseInt(page) - 1) * parseInt(limit);
            const options = {
                limit: parseInt(limit),
                offset,
                role: role || null
            };

            const users = await User.findAll(options);
            const totalUsers = await User.count({ role: role || null });
            const totalPages = Math.ceil(totalUsers / parseInt(limit));

            let filteredUsers = users;
            if (search) {
                const searchLower = search.toLowerCase();
                filteredUsers = users.filter(user => 
                    user.email.toLowerCase().includes(searchLower) ||
                    (user.first_name && user.first_name.toLowerCase().includes(searchLower)) ||
                    (user.last_name && user.last_name.toLowerCase().includes(searchLower))
                );
            }

            res.json({
                success: true,
                data: {
                    users: filteredUsers.map(user => user.toJSON()),
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages,
                        totalUsers,
                        hasNextPage: parseInt(page) < totalPages,
                        hasPrevPage: parseInt(page) > 1
                    }
                }
            });

        } catch (error) {
            logger.error('Get users error:', error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve users'
            });
        }
    }

    async getUserById(req, res) {
        try {
            const { id } = req.params;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid user ID is required'
                });
            }

            const user = await User.findById(parseInt(id));
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                data: {
                    user: user.toJSON()
                }
            });

        } catch (error) {
            logger.error('Get user by ID error:', error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve user'
            });
        }
    }

    async createUser(req, res) {
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

            const validRoles = ['admin', 'staff', 'viewer'];
            if (role && !validRoles.includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: `Role must be one of: ${validRoles.join(', ')}`
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

            logger.info(`User created: ${email} (${role || 'viewer'}) by ${req.user.email}`);

            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: {
                    user: createdUser.toJSON()
                }
            });

        } catch (error) {
            logger.error('Create user error:', error.message);
            
            if (error.message.includes('Validation failed')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Failed to create user'
            });
        }
    }

    async updateUser(req, res) {
        try {
            const { id } = req.params;
            const { email, role, first_name, last_name, is_active } = req.body;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid user ID is required'
                });
            }

            const user = await User.findById(parseInt(id));
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const isOwnProfile = req.user.id === user.id;
            const isAdmin = req.user.role === 'admin';

            if (!isOwnProfile && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions'
                });
            }

            if (first_name !== undefined) user.first_name = first_name;
            if (last_name !== undefined) user.last_name = last_name;

            if (isAdmin) {
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

                if (role !== undefined) {
                    const validRoles = ['admin', 'staff', 'viewer'];
                    if (!validRoles.includes(role)) {
                        return res.status(400).json({
                            success: false,
                            message: `Role must be one of: ${validRoles.join(', ')}`
                        });
                    }
                    user.role = role;
                }

                if (is_active !== undefined) {
                    user.is_active = Boolean(is_active);
                }
            }

            await user.save();
            const updatedUser = await User.findById(user.id);

            logger.info(`User updated: ${user.email} by ${req.user.email}`);

            res.json({
                success: true,
                message: 'User updated successfully',
                data: {
                    user: updatedUser.toJSON()
                }
            });

        } catch (error) {
            logger.error('Update user error:', error.message);
            
            if (error.message.includes('Validation failed')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Failed to update user'
            });
        }
    }

    async deleteUser(req, res) {
        try {
            const { id } = req.params;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid user ID is required'
                });
            }

            const user = await User.findById(parseInt(id));
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            if (req.user.id === user.id) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete your own account'
                });
            }

            const deleted = await User.delete(user.id);
            if (!deleted) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to delete user'
                });
            }

            await jwtService.revokeAllUserTokens(user.id);

            logger.info(`User deleted: ${user.email} by ${req.user.email}`);

            res.json({
                success: true,
                message: 'User deleted successfully'
            });

        } catch (error) {
            logger.error('Delete user error:', error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to delete user'
            });
        }
    }

    async resetUserPassword(req, res) {
        try {
            const { id } = req.params;
            const { newPassword } = req.body;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid user ID is required'
                });
            }

            if (!newPassword || newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'New password must be at least 6 characters long'
                });
            }

            const user = await User.findById(parseInt(id));
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            user.password = newPassword;
            await user.save();

            await jwtService.revokeAllUserTokens(user.id);

            logger.info(`Password reset for user: ${user.email} by ${req.user.email}`);

            res.json({
                success: true,
                message: 'Password reset successfully'
            });

        } catch (error) {
            logger.error('Reset password error:', error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to reset password'
            });
        }
    }

    async getUserStats(req, res) {
        try {
            const totalUsers = await User.count();
            const adminUsers = await User.count({ role: 'admin' });
            const staffUsers = await User.count({ role: 'staff' });
            const viewerUsers = await User.count({ role: 'viewer' });
            const activeUsers = await User.count({ isActive: true });
            const inactiveUsers = await User.count({ isActive: false });

            res.json({
                success: true,
                data: {
                    total: totalUsers,
                    byRole: {
                        admin: adminUsers,
                        staff: staffUsers,
                        viewer: viewerUsers
                    },
                    byStatus: {
                        active: activeUsers,
                        inactive: inactiveUsers
                    }
                }
            });

        } catch (error) {
            logger.error('Get user stats error:', error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to get user statistics'
            });
        }
    }
}

module.exports = new UserController();


