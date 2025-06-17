const { program } = require('commander');
const logger = require('./config/logger');
const BaseBot = require('./services/baseBot');
const AuthService = require('./services/authService');
const ProductService = require('./services/productService');
const CheckoutService = require('./services/checkoutService');

class YodobashiBot extends BaseBot {
    constructor(config) {
        super(config);
    }

    async initialize() {
        await super.initialize();
        
        // Initialize Yodobashi-specific services
        this.authService = new AuthService(this.page);
        this.productService = new ProductService(this.page);
        this.checkoutService = new CheckoutService(this.page);
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