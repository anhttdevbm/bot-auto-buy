const express = require('express');
const { authenticate, authorize, staffOrAdmin } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');
const { spawn } = require('child_process');
const path = require('path');

const router = express.Router();

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
});

router.use(authenticate);
router.use(generalLimiter);

const BOT_CONFIG = {
    'yodobashi': {
        script: 'yodobashiBot.js',
        excel: 'yodobashi.xlsx',
        name: 'Yodobashi Bot'
    },
    'biccamera': {
        script: 'bicCameraBot.js', 
        excel: 'biccamera.xlsx',
        name: 'BicCamera Bot'
    },
    'popmart': {
        script: 'popMartBot.js',
        excel: 'popMart.xlsx', 
        name: 'PopMart Bot'
    },
    'rakuten': {
        script: 'rakutenBot.js',
        excel: 'rakuten.xlsx',
        name: 'Rakuten Bot'
    }
};

let runningBots = {};

router.get('/status', staffOrAdmin, (req, res) => {
    try {
        const status = {};
        
        Object.keys(BOT_CONFIG).forEach(botType => {
            const process = runningBots[botType];
            status[botType] = {
                name: BOT_CONFIG[botType].name,
                running: !!process && !process.killed,
                pid: process ? process.pid : null,
                startTime: process ? process.startTime : null
            };
        });

        res.json({
            success: true,
            data: { status }
        });

    } catch (error) {
        logger.error('Get bot status error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to get bot status'
        });
    }
});

router.post('/:botType/start', authorize('bots', 'run'), (req, res) => {
    try {
        const { botType } = req.params;
        
        if (!BOT_CONFIG[botType]) {
            return res.status(400).json({
                success: false,
                message: 'Invalid bot type'
            });
        }

        if (runningBots[botType] && !runningBots[botType].killed) {
            return res.status(400).json({
                success: false,
                message: `${BOT_CONFIG[botType].name} is already running`
            });
        }

        const config = BOT_CONFIG[botType];
        const scriptPath = path.join(process.cwd(), config.script);
        const excelPath = path.join(process.cwd(), config.excel);

        const botProcess = spawn('node', [scriptPath, '--excel', excelPath], {
            detached: false,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        botProcess.startTime = new Date().toISOString();
        runningBots[botType] = botProcess;

        botProcess.on('exit', (code, signal) => {
            logger.info(`${config.name} exited with code ${code}, signal ${signal}`);
            delete runningBots[botType];
        });

        botProcess.on('error', (error) => {
            logger.error(`${config.name} error:`, error.message);
            delete runningBots[botType];
        });

        botProcess.stdout.on('data', (data) => {
            logger.info(`${config.name} stdout: ${data}`);
        });

        botProcess.stderr.on('data', (data) => {
            logger.error(`${config.name} stderr: ${data}`);
        });

        logger.info(`${config.name} started by ${req.user.email} (PID: ${botProcess.pid})`);

        res.json({
            success: true,
            message: `${config.name} started successfully`,
            data: {
                pid: botProcess.pid,
                startTime: botProcess.startTime
            }
        });

    } catch (error) {
        logger.error('Start bot error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to start bot'
        });
    }
});

router.post('/:botType/stop', authorize('bots', 'stop'), (req, res) => {
    try {
        const { botType } = req.params;
        
        if (!BOT_CONFIG[botType]) {
            return res.status(400).json({
                success: false,
                message: 'Invalid bot type'
            });
        }

        const botProcess = runningBots[botType];
        
        if (!botProcess || botProcess.killed) {
            return res.status(400).json({
                success: false,
                message: `${BOT_CONFIG[botType].name} is not running`
            });
        }

        botProcess.kill('SIGTERM');
        
        setTimeout(() => {
            if (!botProcess.killed) {
                botProcess.kill('SIGKILL');
            }
        }, 10000);

        delete runningBots[botType];

        logger.info(`${BOT_CONFIG[botType].name} stopped by ${req.user.email}`);

        res.json({
            success: true,
            message: `${BOT_CONFIG[botType].name} stopped successfully`
        });

    } catch (error) {
        logger.error('Stop bot error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to stop bot'
        });
    }
});

router.get('/:botType/logs', staffOrAdmin, (req, res) => {
    try {
        const { botType } = req.params;
        const { lines = 100 } = req.query;
        
        if (!BOT_CONFIG[botType]) {
            return res.status(400).json({
                success: false,
                message: 'Invalid bot type'
            });
        }

        const fs = require('fs');
        const logPath = path.join(process.cwd(), 'logs', 'combined.log');
        
        if (!fs.existsSync(logPath)) {
            return res.json({
                success: true,
                data: { logs: [] }
            });
        }

        const logContent = fs.readFileSync(logPath, 'utf8');
        const logLines = logContent.split('\n')
            .filter(line => line.includes(BOT_CONFIG[botType].name))
            .slice(-parseInt(lines))
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return { message: line, timestamp: new Date().toISOString() };
                }
            });

        res.json({
            success: true,
            data: { logs: logLines }
        });

    } catch (error) {
        logger.error('Get bot logs error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to get bot logs'
        });
    }
});

router.post('/stop-all', authorize('bots', 'stop'), (req, res) => {
    try {
        const stoppedBots = [];
        
        Object.keys(runningBots).forEach(botType => {
            const botProcess = runningBots[botType];
            if (botProcess && !botProcess.killed) {
                botProcess.kill('SIGTERM');
                stoppedBots.push(BOT_CONFIG[botType].name);
                
                setTimeout(() => {
                    if (!botProcess.killed) {
                        botProcess.kill('SIGKILL');
                    }
                }, 10000);
            }
        });

        runningBots = {};

        logger.info(`All bots stopped by ${req.user.email}`);

        res.json({
            success: true,
            message: 'All bots stopped successfully',
            data: { stoppedBots }
        });

    } catch (error) {
        logger.error('Stop all bots error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to stop all bots'
        });
    }
});

module.exports = router;




