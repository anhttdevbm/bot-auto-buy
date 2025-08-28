const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'data', 'app.db');
        this.ensureDirectoryExists();
        this.db = null;
        this.init();
    }

    ensureDirectoryExists() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    init() {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                logger.error('Error opening database:', err.message);
                throw err;
            }
            logger.info('Connected to SQLite database');
            this.createTables();
        });
    }

    createTables() {
        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'viewer' CHECK(role IN ('admin', 'staff', 'viewer')),
                first_name TEXT,
                last_name TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )
        `;

        const createBotAccountsTable = `
            CREATE TABLE IF NOT EXISTS bot_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                platform TEXT NOT NULL CHECK(platform IN ('yodobashi', 'biccamera', 'popmart', 'rakuten')),
                email TEXT NOT NULL,
                password TEXT NOT NULL,
                card_info TEXT,
                address_info TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `;

        const createOrdersTable = `
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_account_id INTEGER,
                platform TEXT NOT NULL,
                product_name TEXT,
                product_url TEXT,
                price TEXT,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'success', 'failed', 'cancelled')),
                error_message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY (bot_account_id) REFERENCES bot_accounts (id) ON DELETE CASCADE
            )
        `;

        const createSessionsTable = `
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                token_jti TEXT UNIQUE NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `;

        const createPermissionsTable = `
            CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                resource TEXT NOT NULL,
                action TEXT NOT NULL,
                UNIQUE(role, resource, action)
            )
        `;

        const tables = [
            createUsersTable,
            createBotAccountsTable,
            createOrdersTable,
            createSessionsTable,
            createPermissionsTable
        ];

        tables.forEach((sql, index) => {
            this.db.run(sql, (err) => {
                if (err) {
                    logger.error(`Error creating table ${index + 1}:`, err.message);
                } else {
                    logger.info(`Table ${index + 1} created successfully`);
                }
            });
        });

        this.insertDefaultPermissions();
        this.createDefaultAdmin();
    }

    insertDefaultPermissions() {
        const permissions = [
            ['admin', 'users', 'create'],
            ['admin', 'users', 'read'],
            ['admin', 'users', 'update'],
            ['admin', 'users', 'delete'],
            ['admin', 'bot_accounts', 'create'],
            ['admin', 'bot_accounts', 'read'],
            ['admin', 'bot_accounts', 'update'],
            ['admin', 'bot_accounts', 'delete'],
            ['admin', 'orders', 'read'],
            ['admin', 'orders', 'update'],
            ['admin', 'orders', 'delete'],
            ['admin', 'dashboard', 'access'],
            ['admin', 'bots', 'run'],
            ['admin', 'bots', 'stop'],
            
            ['staff', 'bot_accounts', 'create'],
            ['staff', 'bot_accounts', 'read'],
            ['staff', 'bot_accounts', 'update'],
            ['staff', 'orders', 'read'],
            ['staff', 'orders', 'update'],
            ['staff', 'dashboard', 'access'],
            ['staff', 'bots', 'run'],
            
            ['viewer', 'orders', 'read'],
            ['viewer', 'dashboard', 'access']
        ];

        const insertPermission = `INSERT OR IGNORE INTO permissions (role, resource, action) VALUES (?, ?, ?)`;
        
        permissions.forEach(([role, resource, action]) => {
            this.db.run(insertPermission, [role, resource, action], (err) => {
                if (err) {
                    logger.error('Error inserting permission:', err.message);
                }
            });
        });
    }

    async createDefaultAdmin() {
        const bcrypt = require('bcrypt');
        
        const checkAdmin = `SELECT id FROM users WHERE role = 'admin' LIMIT 1`;
        
        this.db.get(checkAdmin, async (err, row) => {
            if (err) {
                logger.error('Error checking for admin:', err.message);
                return;
            }
            
            if (!row) {
                try {
                    const hashedPassword = await bcrypt.hash('admin123', 12);
                    const insertAdmin = `
                        INSERT INTO users (email, password, role, first_name, last_name) 
                        VALUES (?, ?, ?, ?, ?)
                    `;
                    
                    this.db.run(insertAdmin, [
                        'admin@autobuybot.com',
                        hashedPassword,
                        'admin',
                        'System',
                        'Administrator'
                    ], (err) => {
                        if (err) {
                            logger.error('Error creating default admin:', err.message);
                        } else {
                            logger.info('Default admin created: admin@autobuybot.com / admin123');
                        }
                    });
                } catch (error) {
                    logger.error('Error hashing admin password:', error);
                }
            }
        });
    }

    getDb() {
        return this.db;
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    logger.error('Error closing database:', err.message);
                } else {
                    logger.info('Database connection closed');
                }
            });
        }
    }
}

module.exports = new Database();


