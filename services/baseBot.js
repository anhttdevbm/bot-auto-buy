const { chromium } = require('playwright');
const { program } = require('commander');
const logger = require('../config/logger');
const SessionManager = require('../utils/sessionManager');
const ExcelManager = require('../utils/excelManager');
const ProxyManager = require('../config/proxyManager');
const DiscordNotifier = require('../utils/discordNotifier');
require('dotenv').config();

class BaseBot {
    constructor(config) {
        this.config = config;
        this.sessionManager = new SessionManager();
        this.excelManager = new ExcelManager(config.excel);
        this.discordNotifier = new DiscordNotifier(process.env.DISCORD_WEBHOOK_URL);
    }

    async initialize() {
        const proxyManager = new ProxyManager();
        const proxyServer = proxyManager.getRandomProxy();

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
            ],
            // proxy: proxyServer ? { server: proxyServer } : undefined
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
            forcedColors: 'none',
            proxy: proxyServer || undefined
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

        // for (const url of urls) {
        //     const page = await this.context.newPage();
        //     const productInfo = await this.productService.checkProduct(url, page);
        //     if (productInfo) {
        //         await this.checkoutService.addToCart(page);
        //         await this.checkoutService.checkout(account.Card, account.Address, page);
        //         this.excelManager.logOrder(productInfo);
        //     }
        // }
        
        const concurrency = 4;
        let index = 0;

        const runOrder = async () => {
            while (index < urls.length) {
                const currentIndex = index++;
                const url = urls[currentIndex];
                const page = await this.context.newPage();
                try {
                    const productInfo = await this.productService.checkProduct(url, page);
                    if (productInfo) {
                        await this.checkoutService.addToCart(page);
                        const status = 'Purchased';
                        this.excelManager.logOrder(productInfo, status);

                        // Send Discord notification if purchase was successful
                        if (
                          status.toLowerCase().includes('purchased')
                        ) {
                          try {
                            const notificationResults = await this.discordNotifier.sendOrderNotificationToAll(
                              productInfo,
                              account.Email,
                              status
                            );
                          } catch (discordError) {
                            logger.warn(
                              'Discord notification failed, but order logging continued:',
                              discordError
                            );
                          }
                        }
                    }
                } finally {
                    await page.close();
                }
            }
        };

        await Promise.all(Array(concurrency).fill(0).map(() => runOrder()));

        await this.checkoutService.checkout(account.Card, account.Address, this.page);
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