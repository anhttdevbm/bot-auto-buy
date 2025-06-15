const { chromium } = require('playwright');
const { program } = require('commander');
const logger = require('./config/logger');
const SessionManager = require('./utils/sessionManager');
const ExcelManager = require('./utils/excelManager');
const AuthService = require('./services/authService');
const ProductService = require('./services/productService');
const CheckoutService = require('./services/checkoutService');
require('dotenv').config();

class YodobashiBot {
    constructor(config) {
        this.config = config;
        this.sessionManager = new SessionManager();
        this.excelManager = new ExcelManager(config.excel);
    }

    async initialize() {
        this.browser = await chromium.launch({
            headless: false,
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
                '--disable-site-isolation-trials'
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
        
        // Initialize services
        this.authService = new AuthService(this.page);
        this.productService = new ProductService(this.page);
        this.checkoutService = new CheckoutService(this.page);
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

    async monitorProducts() {
        const products = this.excelManager.readConfig();

        for (const product of products) {
            const productInfo = await this.productService.checkProduct(product.URL);
            if (productInfo) {
                await this.checkoutService.addToCart();
                await this.checkoutService.checkout(product.Card, product.Address);
                this.excelManager.logOrder(productInfo);
            }
        }
    }

    async close() {
        await this.browser.close();
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
        console.log('Usage: node bot.js --excel <path>');
        process.exit(1);
    }

    const bot = new YodobashiBot({ excel: options.excel });
    await bot.initialize();
    
    const session = bot.sessionManager.loadSession();
    // if (session) {
    //     await bot.context.addCookies(session.cookies);
    // } else {
        const config = bot.excelManager.readConfig()[0];
        const loginSuccess = await bot.authService.login(config.Email, config.Password);
        if (!loginSuccess) {
            logger.error('Failed to login');
            process.exit(1);
        }
    // }
    
    await bot.monitorProducts();
}

main().catch(error => {
    logger.error('Bot execution failed:', error);
    process.exit(1);
}); 