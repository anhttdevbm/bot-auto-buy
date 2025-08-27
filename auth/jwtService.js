const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../config/logger');
const database = require('../database/database');

class JWTService {
    constructor() {
        this.secretKey = process.env.JWT_SECRET || 'auto-buy-bot-secret-key-2024';
        this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
        this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
    }

    generateTokens(user) {
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role,
            jti: crypto.randomUUID()
        };

        const accessToken = jwt.sign(payload, this.secretKey, {
            expiresIn: this.accessTokenExpiry,
            issuer: 'auto-buy-bot',
            audience: 'auto-buy-bot-users'
        });

        const refreshPayload = {
            id: user.id,
            type: 'refresh',
            jti: crypto.randomUUID()
        };

        const refreshToken = jwt.sign(refreshPayload, this.secretKey, {
            expiresIn: this.refreshTokenExpiry,
            issuer: 'auto-buy-bot',
            audience: 'auto-buy-bot-users'
        });

        this.storeRefreshToken(user.id, refreshPayload.jti, this.refreshTokenExpiry);

        return {
            accessToken,
            refreshToken,
            expiresIn: this.parseExpiry(this.accessTokenExpiry)
        };
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, this.secretKey, {
                issuer: 'auto-buy-bot',
                audience: 'auto-buy-bot-users'
            });
        } catch (error) {
            logger.error('Token verification failed:', error.message);
            throw new Error('Invalid or expired token');
        }
    }

    decodeToken(token) {
        try {
            return jwt.decode(token);
        } catch (error) {
            logger.error('Token decode failed:', error.message);
            return null;
        }
    }

    async refreshTokens(refreshToken) {
        try {
            const decoded = this.verifyToken(refreshToken);
            
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid refresh token');
            }

            const isValidRefreshToken = await this.isValidRefreshToken(decoded.jti);
            if (!isValidRefreshToken) {
                throw new Error('Refresh token not found or expired');
            }

            const User = require('../models/User');
            const user = await User.findById(decoded.id);
            
            if (!user) {
                throw new Error('User not found');
            }

            await this.revokeRefreshToken(decoded.jti);

            return this.generateTokens(user);

        } catch (error) {
            logger.error('Token refresh failed:', error.message);
            throw error;
        }
    }

    async revokeToken(token) {
        try {
            const decoded = this.decodeToken(token);
            if (!decoded || !decoded.jti) {
                return false;
            }

            const db = database.getDb();
            
            return new Promise((resolve, reject) => {
                const sql = 'DELETE FROM sessions WHERE token_jti = ?';
                
                db.run(sql, [decoded.jti], function(err) {
                    if (err) {
                        logger.error('Error revoking token:', err.message);
                        reject(err);
                    } else {
                        resolve(this.changes > 0);
                    }
                });
            });

        } catch (error) {
            logger.error('Token revocation failed:', error.message);
            return false;
        }
    }

    async revokeAllUserTokens(userId) {
        const db = database.getDb();
        
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM sessions WHERE user_id = ?';
            
            db.run(sql, [userId], function(err) {
                if (err) {
                    logger.error('Error revoking all user tokens:', err.message);
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async isTokenRevoked(jti, tokenType = 'access') {
        if (tokenType === 'access') {
            return false;
        }
        
        const db = database.getDb();
        
        return new Promise((resolve, reject) => {
            const sql = 'SELECT 1 FROM sessions WHERE token_jti = ? AND expires_at > CURRENT_TIMESTAMP';
            
            db.get(sql, [jti], (err, row) => {
                if (err) {
                    logger.error('Error checking token revocation:', err.message);
                    reject(err);
                } else {
                    resolve(!row);
                }
            });
        });
    }

    async storeRefreshToken(userId, jti, expiry) {
        const db = database.getDb();
        const expiresAt = new Date(Date.now() + this.parseExpiry(expiry) * 1000);
        
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO sessions (user_id, token_jti, expires_at)
                VALUES (?, ?, ?)
            `;
            
            db.run(sql, [userId, jti, expiresAt.toISOString()], function(err) {
                if (err) {
                    logger.error('Error storing refresh token:', err.message);
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async isValidRefreshToken(jti) {
        const db = database.getDb();
        
        return new Promise((resolve, reject) => {
            const sql = 'SELECT 1 FROM sessions WHERE token_jti = ? AND expires_at > CURRENT_TIMESTAMP';
            
            db.get(sql, [jti], (err, row) => {
                if (err) {
                    logger.error('Error validating refresh token:', err.message);
                    reject(err);
                } else {
                    resolve(!!row);
                }
            });
        });
    }

    async revokeRefreshToken(jti) {
        const db = database.getDb();
        
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM sessions WHERE token_jti = ?';
            
            db.run(sql, [jti], function(err) {
                if (err) {
                    logger.error('Error revoking refresh token:', err.message);
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    parseExpiry(expiry) {
        const units = {
            's': 1,
            'm': 60,
            'h': 3600,
            'd': 86400
        };

        const match = expiry.match(/^(\d+)([smhd])$/);
        if (!match) {
            return 900;
        }

        const [, number, unit] = match;
        return parseInt(number) * units[unit];
    }

    async cleanupExpiredTokens() {
        const db = database.getDb();
        
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP';
            
            db.run(sql, [], function(err) {
                if (err) {
                    logger.error('Error cleaning up expired tokens:', err.message);
                    reject(err);
                } else {
                    logger.info(`Cleaned up ${this.changes} expired tokens`);
                    resolve(this.changes);
                }
            });
        });
    }
}

module.exports = new JWTService();


