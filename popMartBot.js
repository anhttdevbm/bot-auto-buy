const { program } = require('commander');
const logger = require('./config/logger');
const BaseBot = require('./services/baseBot');
const AuthService = require('./services/popMart/authService');
const ProductService = require('./services/popMart/productService');
const CheckoutService = require('./services/popMart/checkoutService');
const { chromium } = require('playwright');

class PopMartBot extends BaseBot {
    constructor(config) {
        super(config);
    }

    async initialize() {
        // await super.initialize();
        const browser = await chromium.connectOverCDP('http://localhost:9222');
        this.context = browser.contexts()[0] || await browser.newContext();
        this.page = await this.context.newPage();
        
        // Initialize Yodobashi-specific services
        this.authService = new AuthService(this.page);
        this.productService = new ProductService(this.page);
        this.checkoutService = new CheckoutService(this.page);
    }

    async monitorProducts(account, productUrls) {
        // Split URLs by comma and trim whitespace
        const urls = productUrls.split(',').map(url => url.trim());
        
        for (const url of urls) {
            const productInfo = await this.productService.checkProduct(url);
            if (productInfo) {
                await this.checkoutService.addToCart();
                // this.excelManager.logOrder(productInfo);
            }
        }
        await this.checkoutService.checkout(account.Card, account.Address);
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

    const bot = new PopMartBot({ excel: options.excel });
    // const session = bot.sessionManager.loadSession();
    // if (session) {
    //     await bot.context.addCookies(session.cookies);
    //     return;
    // }

    try {
        await bot.run();
    } catch (error) {
        logger.error('Bot execution failed:', error);
        process.exit(1);
    }
}

main(); 