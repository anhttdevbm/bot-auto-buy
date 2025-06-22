const { program } = require('commander');
const logger = require('./config/logger');
const BaseBot = require('./services/baseBot');
const AuthService = require('./services/rakuten/authService');
const ProductService = require('./services/rakuten/productService');
const CheckoutService = require('./services/rakuten/checkoutService');

class RakutenBot extends BaseBot {
    constructor(config) {
        super(config);
    }

    async initialize() {
        await super.initialize();
        
        // Initialize Rakuten-specific services
        this.authService = new AuthService(this.page);
        this.productService = new ProductService(this.page);
        this.checkoutService = new CheckoutService(this.page);
    }

    async monitorProducts(account, productUrls) {
        // Split URLs by comma and trim whitespace
        const urls = productUrls.split(',').map(url => url.trim());
        
        for (const url of urls) {
            const productInfo = await this.productService.checkProduct(url);
            if (productInfo && productInfo.isAvailable) {
                logger.info(`Product is available: ${productInfo.name}`);
                const addedToCart = await this.checkoutService.addToCart();
                if (addedToCart) {
                    await this.checkoutService.checkout(account.Card, account.Address, account.Password, account.YYYYMMDD);
                    this.excelManager.logOrder(productInfo);
                }
            } else {
                logger.info(`Product not available or check failed for URL: ${url}`);
            }
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
        console.log('Usage: node rakutenBot.js --excel <path>');
        process.exit(1);
    }

    const bot = new RakutenBot({ excel: options.excel });
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