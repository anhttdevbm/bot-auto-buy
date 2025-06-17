const logger = require('../config/logger');

class BicCameraCheckoutService {
    constructor(page) {
        this.page = page;
    }

    async addToCart() {
        try {
            logger.info('Attempting to add product to cart');
            
            // Click add to cart button
            await this.page.click('.add-to-cart-button');
            
            // Wait for cart confirmation
            await this.page.waitForSelector('.cart-confirmation', { timeout: 5000 });
            
            logger.info('Product added to cart successfully');
            return true;
        } catch (error) {
            logger.error('Failed to add product to cart:', error);
            return false;
        }
    }

    async checkout(paymentInfo, address) {
        try {
            logger.info('Starting checkout process');

            // Click proceed to checkout
            await this.page.click('.checkout-button');
            await this.page.waitForNavigation({ waitUntil: 'networkidle' });

            // Fill shipping address
            await this.fillShippingAddress(address);

            // Fill payment information
            await this.fillPaymentInfo(paymentInfo);

            // Confirm order
            await this.page.click('.confirm-order-button');
            await this.page.waitForNavigation({ waitUntil: 'networkidle' });

            // Check for order confirmation
            const isConfirmed = await this.page.evaluate(() => {
                return document.querySelector('.order-confirmation') !== null;
            });

            if (isConfirmed) {
                logger.info('Order placed successfully');
                return true;
            } else {
                throw new Error('Order confirmation not found');
            }
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