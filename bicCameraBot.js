const { program } = require('commander');
const { chromium } = require('playwright');
const logger = require('./config/logger');
const BicCameraAuthService = require('./services/bicCamera/bicCameraAuthService');
const BicCameraProductService = require('./services/bicCamera/bicCameraProductService');
const BicCameraCheckoutService = require('./services/bicCamera/bicCameraCheckoutService');
const SessionManager = require('./utils/sessionManager');
const ExcelManager = require('./utils/excelManager');
const ProxyManager = require('./config/proxyManager');

class BicCameraBot {
    constructor(config) {
        this.config = config;
        this.sessionManager = new SessionManager();
        this.excelManager = new ExcelManager(config.excel);
        this.context = null;
    }

    async initialize() {
        try {
            const browser = await chromium.connectOverCDP('http://localhost:9222');

            const proxyManager = new ProxyManager();
            const proxyServer = proxyManager.getRandomProxy();
            
            this.context = 
                // browser.contexts()[0] || 
                await browser.newContext({
                    proxy: proxyServer || undefined
                });
            
            this.page = await this.context.newPage();
            // await this.page.goto('http://httpbin.org/ip', { waitUntil: 'domcontentloaded' });

            this.authService = new BicCameraAuthService(this.page);
            this.productService = new BicCameraProductService(this.page);
            this.checkoutService = new BicCameraCheckoutService(this.page);
        } catch (error) {
            logger.error('Failed to initialize browser:', error);
            throw error;
        }
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
            'Accept-Encoding': 'gzip, deflate',
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
        try {
            if (this.context) {
                await this.context.close();
                this.context = null;
            }
        } catch (error) {
            logger.error('Error closing browser:', error);
        }
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
                    
                    await this.close();
                    
                } catch (error) {
                    logger.error(`Error processing account ${account.Email}:`, error);
                    await this.close(); // Make sure to close browser on error
                    continue; // Continue with next account even if current one fails
                }
            }
        } catch (error) {
            logger.error('Bot execution failed:', error);
            await this.close(); // Make sure to close browser on error
            throw error;
        }
    }
}

// CLI setup
program
    .version('1.0.0')
    .option('-e, --excel <path>', 'Path to Excel configuration file')
    .parse(process.argv);

const options = program.opts();

// Main execution
async function main() {
    if (!options.excel) {
        logger.error('Error: Excel file path is required');
        console.log('Usage: node bicCameraBot.js --excel <path>');
        process.exit(1);
    }

    const bot = new BicCameraBot({ excel: options.excel });
    try {
        await bot.run();
    } catch (error) {
        logger.error('Bot execution failed:', error);
        process.exit(1);
    }
}

main(); 