const logger = require('../../config/logger');

class BicCameraCheckoutService {
    constructor(page) {
        this.page = page;
    }

    async addToCart() {
        try {
            logger.info('Attempting to add product to cart');
            
            // Wait for and click "Proceed to Purchase" button
            this.clickButtonAddToCart();
       
            try {
                await this.page.waitForNavigation({
                    waitUntil: 'domcontentloaded',
                    timeout: 4000
                });
            } catch (error) {
                logger.warn('Navigation timeout, but continuing...');
                this.clickButtonAddToCart();
            }
            
            logger.info('Product added to cart successfully');
            return true;
        } catch (error) {
            logger.error('Failed to add product to cart:', error);
            return false;
        }
    }

    async clickButtonAddToCart() {
        try {
            const button = await this.page.waitForSelector('text="カートに入れる"', { timeout: 30000 });
            if (!button) {
                logger.error('Add to cart button not found');
                return false;
            }
            await button.click();
        } catch (error) {
            throw error;
        }
    }

    async checkout(paymentInfo, address) {
        try {
            logger.info('Starting checkout process');

            await this.page.waitForSelector('text="カートに進む"', { timeout: 30000 });
            await this.page.click('text="カートに進む"');

            await this.page.waitForSelector('text="注文画面に進む"', { timeout: 30000 });
            await this.page.click('text="注文画面に進む"');


            logger.info('Checkout completed');
        } catch (error) {
            logger.error('Checkout failed:', error);
            return false;
        }
    }

    async fillPaymentInfo(paymentInfo) {
        try {
            logger.info('Filling payment information');

            // Fill card number
            await this.page.fill('#card-number', paymentInfo.cardNumber);
            
            // Fill expiry date
            await this.page.fill('#expiry-date', paymentInfo.expiryDate);
            
            // Fill CVV
            await this.page.fill('#cvv', paymentInfo.cvv);

            logger.info('Payment information filled successfully');
        } catch (error) {
            logger.error('Failed to fill payment information:', error);
            throw error;
        }
    }

    async fillShippingAddress(address) {
        try {
            logger.info('Filling shipping address');

            // Fill address fields
            await this.page.fill('#postal-code', address.postalCode);
            await this.page.fill('#prefecture', address.prefecture);
            await this.page.fill('#city', address.city);
            await this.page.fill('#street', address.street);
            await this.page.fill('#building', address.building);
            await this.page.fill('#phone', address.phone);

            logger.info('Shipping address filled successfully');
        } catch (error) {
            logger.error('Failed to fill shipping address:', error);
            throw error;
        }
    }
}

module.exports = BicCameraCheckoutService; 