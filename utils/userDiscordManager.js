const logger = require('../config/logger');

require('dotenv').config();

class UserDiscordManager {
    constructor() {
        this.userMappings = new Map();
        this.loadMappings();
    }

    loadMappings() {
        try {
            this.userMappings.clear();
            
            this.loadFromEnvironment();
            
            if (this.userMappings.size === 0) {
                logger.info('No user Discord mappings found in environment variables');
            } else {
                logger.info(`Loaded ${this.userMappings.size} user Discord mappings from environment variables`);
            }
        } catch (error) {
            logger.error('Failed to load user Discord mappings:', error);
            this.userMappings.clear();
        }
    }

    loadFromEnvironment() {
        const mappingPrefix = 'USER_DISCORD_MAPPING_';
        let envCount = 0;
        
        Object.keys(process.env).forEach(key => {
            if (key.startsWith(mappingPrefix)) {
                const rawEmail = key.substring(mappingPrefix.length);
                const email = this.normalizeEmailFromEnvVar(rawEmail);
                const webhookUrl = process.env[key];
                
                if (email && webhookUrl && webhookUrl.trim() !== '') {
                    this.userMappings.set(email.toLowerCase(), {
                        webhookUrl: webhookUrl.trim(),
                        userName: email,
                        enabled: true
                    });
                    envCount++;
                }
            }
        });
    }

    normalizeEmailFromEnvVar(rawEmail) {
        try {
            let email = rawEmail.toLowerCase();
            
            if (!email.includes('@')) {
                const domainMatch = email.match(/(.+)_([a-z0-9]+)_([a-z]{2,4})$/);
                if (domainMatch) {
                    const [, usernamePart, domain, extension] = domainMatch;
                    const username = usernamePart.replace(/_/g, '.');
                    email = `${username}@${domain}.${extension}`;
                } else {
                    const parts = email.split('_');
                    if (parts.length >= 2) {
                        const username = parts.slice(0, -1).join('.');
                        const domain = parts[parts.length - 1];
                        email = `${username}@${domain}.com`;
                    }
                }
            }
            
            return email;
        } catch (error) {
            logger.warn(`Failed to normalize email from env var: ${rawEmail}`);
            return rawEmail.toLowerCase();
        }
    }

    getUserWebhookUrl(userEmail) {
        return this.userMappings.get(userEmail.toLowerCase())?.webhookUrl;
    }

    getUserName(email) {
        return email;
    }

    hasUserWebhook(email) {
        return !!this.getUserWebhookUrl(email);
    }
}

module.exports = UserDiscordManager;
