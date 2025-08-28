const database = require('../database/database');
const bcrypt = require('bcrypt');
const validator = require('validator');
const logger = require('../config/logger');

class User {
    constructor(data = {}) {
        this.id = data.id;
        this.email = data.email;
        this.password = data.password;
        this.role = data.role || 'viewer';
        this.first_name = data.first_name;
        this.last_name = data.last_name;
        this.is_active = data.is_active !== undefined ? data.is_active : true;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.last_login = data.last_login;
    }

    validate() {
        const errors = [];

        if (!this.email || !validator.isEmail(this.email)) {
            errors.push('Valid email is required');
        }

        if (!this.password || this.password.length < 6) {
            errors.push('Password must be at least 6 characters long');
        }

        if (!['admin', 'staff', 'viewer'].includes(this.role)) {
            errors.push('Role must be admin, staff, or viewer');
        }

        if (this.first_name && this.first_name.length > 50) {
            errors.push('First name must not exceed 50 characters');
        }

        if (this.last_name && this.last_name.length > 50) {
            errors.push('Last name must not exceed 50 characters');
        }

        return errors;
    }

    async hashPassword() {
        if (this.password) {
            this.password = await bcrypt.hash(this.password, 12);
        }
    }

    async comparePassword(candidatePassword) {
        return await bcrypt.compare(candidatePassword, this.password);
    }

    async save() {
        const errors = this.validate();
        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }

        const db = database.getDb();

        if (this.id) {
            return new Promise((resolve, reject) => {
                const sql = `
                    UPDATE users 
                    SET email = ?, role = ?, first_name = ?, last_name = ?, 
                        is_active = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `;
                
                db.run(sql, [
                    this.email,
                    this.role,
                    this.first_name,
                    this.last_name,
                    this.is_active,
                    this.id
                ], function(err) {
                    if (err) {
                        logger.error('Error updating user:', err.message);
                        reject(err);
                    } else {
                        resolve(this.changes > 0);
                    }
                });
            });
        } else {
            await this.hashPassword();
            
            return new Promise((resolve, reject) => {
                const sql = `
                    INSERT INTO users (email, password, role, first_name, last_name, is_active)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                
                db.run(sql, [
                    this.email,
                    this.password,
                    this.role,
                    this.first_name,
                    this.last_name,
                    this.is_active
                ], function(err) {
                    if (err) {
                        logger.error('Error creating user:', err.message);
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                });
            });
        }
    }

    static async findById(id) {
        const db = database.getDb();
        
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM users WHERE id = ? AND is_active = 1';
            
            db.get(sql, [id], (err, row) => {
                if (err) {
                    logger.error('Error finding user by ID:', err.message);
                    reject(err);
                } else {
                    resolve(row ? new User(row) : null);
                }
            });
        });
    }

    static async findByEmail(email) {
        const db = database.getDb();
        
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM users WHERE email = ? AND is_active = 1';
            
            db.get(sql, [email], (err, row) => {
                if (err) {
                    logger.error('Error finding user by email:', err.message);
                    reject(err);
                } else {
                    resolve(row ? new User(row) : null);
                }
            });
        });
    }

    static async findAll(options = {}) {
        const db = database.getDb();
        const { role, isActive = true, limit = 100, offset = 0 } = options;
        
        let sql = 'SELECT * FROM users WHERE 1=1';
        const params = [];
        
        if (role) {
            sql += ' AND role = ?';
            params.push(role);
        }
        
        if (isActive !== null) {
            sql += ' AND is_active = ?';
            params.push(isActive ? 1 : 0);
        }
        
        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    logger.error('Error finding users:', err.message);
                    reject(err);
                } else {
                    resolve(rows.map(row => new User(row)));
                }
            });
        });
    }

    static async count(options = {}) {
        const db = database.getDb();
        const { role, isActive = true } = options;
        
        let sql = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
        const params = [];
        
        if (role) {
            sql += ' AND role = ?';
            params.push(role);
        }
        
        if (isActive !== null) {
            sql += ' AND is_active = ?';
            params.push(isActive ? 1 : 0);
        }
        
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) {
                    logger.error('Error counting users:', err.message);
                    reject(err);
                } else {
                    resolve(row.count);
                }
            });
        });
    }

    static async delete(id) {
        const db = database.getDb();
        
        return new Promise((resolve, reject) => {
            const sql = 'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
            
            db.run(sql, [id], function(err) {
                if (err) {
                    logger.error('Error deleting user:', err.message);
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    static async updateLastLogin(id) {
        const db = database.getDb();
        
        return new Promise((resolve, reject) => {
            const sql = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?';
            
            db.run(sql, [id], function(err) {
                if (err) {
                    logger.error('Error updating last login:', err.message);
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    toJSON() {
        const { password, ...userWithoutPassword } = this;
        return userWithoutPassword;
    }

    hasPermission(resource, action) {
        return new Promise((resolve, reject) => {
            const db = database.getDb();
            const sql = 'SELECT 1 FROM permissions WHERE role = ? AND resource = ? AND action = ?';
            
            db.get(sql, [this.role, resource, action], (err, row) => {
                if (err) {
                    logger.error('Error checking permission:', err.message);
                    reject(err);
                } else {
                    resolve(!!row);
                }
            });
        });
    }
}

module.exports = User;


