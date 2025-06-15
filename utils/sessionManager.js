const fs = require('fs');
const CryptoJS = require('crypto-js');
const logger = require('../config/logger');

class SessionManager {
    constructor() {
        this.sessionFile = 'data/session.json';
        this.ensureDirectoryExists();
    }

    ensureDirectoryExists() {
        const dir = 'data';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
    }

    saveSession(session) {
        try {
            const encrypted = CryptoJS.AES.encrypt(
                JSON.stringify(session),
                process.env.SESSION_KEY || 'default-key'
            ).toString();
            fs.writeFileSync(this.sessionFile, encrypted);
            logger.info('Session saved successfully');
        } catch (error) {
            logger.error('Failed to save session:', error);
        }
    }

    loadSession() {
        try {
            if (!fs.existsSync(this.sessionFile)) {
                return null;
            }
            const encrypted = fs.readFileSync(this.sessionFile, 'utf8');
            const decrypted = CryptoJS.AES.decrypt(
                encrypted,
                process.env.SESSION_KEY || 'default-key'
            ).toString(CryptoJS.enc.Utf8);
            return JSON.parse(decrypted);
        } catch (error) {
            logger.error('Failed to load session:', error);
            return null;
        }
    }
}

module.exports = SessionManager; 