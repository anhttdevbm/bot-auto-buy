const { program } = require('commander');
const logger = require('./config/logger');
const BaseBot = require('./services/baseBot');
const BicCameraAuthService = require('./services/bicCameraAuthService');
const BicCameraProductService = require('./services/bicCameraProductService');
const BicCameraCheckoutService = require('./services/bicCameraCheckoutService');

class BicCameraBot extends BaseBot {
    constructor(config) {
        super(config);
    }

    async initialize() {
        await super.initialize();
        
        // Initialize BicCamera-specific services
        this.authService = new BicCameraAuthService(this.page);
        this.productService = new BicCameraProductService(this.page);
        this.checkoutService = new BicCameraCheckoutService(this.page);
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