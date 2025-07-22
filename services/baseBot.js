const { chromium } = require('playwright');
const { program } = require('commander');
const logger = require('../config/logger');
const SessionManager = require('../utils/sessionManager');
const ExcelManager = require('../utils/excelManager');
require('dotenv').config();

class BaseBot {
    constructor(config) {
        this.config = config;
        this.sessionManager = new SessionManager();
        this.excelManager = new ExcelManager(config.excel);
    }

    async initialize() {
        this.browser = await chromium.launch({
            headless: true,
            channel: 'chrome',
            args: [
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-site-isolation-trials',
                '--disable-setuid-sandbox',
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-site-isolation-trials',
            ]
        });
        
        this.context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'ja-JP',
            timezoneId: 'Asia/Tokyo',
            geolocation: { longitude: 139.7670, latitude: 35.6814 },
            permissions: ['geolocation'],
            ignoreHTTPSErrors: true,
            bypassCSP: true,
            hasTouch: true,
            isMobile: false,
            deviceScaleFactor: 1,
            colorScheme: 'light',
            reducedMotion: 'no-preference',
            forcedColors: 'none'
        });

        this.page = await this.context.newPage();
        await this.setupPage();
    }

    async setupPage() {
        await this.page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false
            });
            window.navigator.chrome = {
                runtime: {},
            };
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        });

        this.context.setDefaultTimeout(60000);
        
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'ja-JP,ja;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        });
    }

    async monitorProducts(account, productUrls) {
        // Split URLs by comma and trim whitespace
        const urls = productUrls.split(',').map(url => url.trim());
        
        for (const url of urls) {
            const productInfo = await this.productService.checkProduct(url);
            if (productInfo) {
                await this.checkoutService.addToCart();
                await this.checkoutService.checkout(account.Card, account.Address);
                this.excelManager.logOrder(productInfo);
            }
        }
    }

    async close() {
        await this.browser.close();
    }

    async run() {
        try {            
            // Get all accounts from Excel
            const accounts = this.excelManager.readConfig();
            
            // Process each account
            for (const account of accounts) {
                try {
                    await this.initialize();
                    logger.info(`Processing account: ${account.Email}`);
                    
                    // Login with current account
                    const loginSuccess = await this.authService.login(account.Email, account.Password);
                    if (!loginSuccess) {
                        logger.error(`Failed to login with account: ${account.Email}`);
                        continue; // Skip to next account if login fails
                    }

                    // Process products for this account
                    await this.monitorProducts(account, account.URL);
                    
                    // Logout before switching to next account
                    // await this.authService.logout();

                    // await this.close();
                    process.exit(0);
                    
                } catch (error) {
                    logger.error(`Error processing account ${account.Email}:`, error);
                    continue; // Continue with next account even if current one fails
                }
            }
        } catch (error) {
            logger.error('Bot execution failed:', error);
            throw error;
        } finally {
            await this.close();
        }
    }
}

module.exports = BaseBot; 