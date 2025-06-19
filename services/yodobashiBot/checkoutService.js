const logger = require('../../config/logger');

class CheckoutService {
    constructor(page) {
        this.page = page;
    }

    async addToCart() {
        try {
            await this.page.click('#js_m_submitRelated');
            logger.info('Product added to cart');
            return true;
        } catch (error) {
            logger.error('Add to cart failed:', error);
            return false;
        }
    }

    async checkout(paymentInfo, address) {
        try {
            // Wait for and click "Proceed to Purchase" button
            await this.page.waitForSelector('text="購入手続きに進む"', { timeout: 30000 });
            await this.page.click('text="購入手続きに進む"');

            // Wait for and click "Next" button
            await this.page.waitForSelector('text="次へ進む"', { timeout: 30000 });
            await this.page.click('text="次へ進む"');

            // Wait for and click "Confirm Order" button
            await this.page.waitForSelector('text="注文を確定する"', { timeout: 30000 });
            await this.page.click('text="注文を確定する"');

            // TODO: Implement payment and address filling if needed
            // await this.fillPaymentInfo(paymentInfo);
            // await this.fillShippingAddress(address);

            logger.info('Checkout completed');
            return true;
        } catch (error) {
            logger.error('Checkout failed:', error);
            return false;
        }
    }

    async fillPaymentInfo(paymentInfo) {
        try {
            await this.page.fill('#cardNumber', paymentInfo.cardNumber);
            await this.page.fill('#cardExpiry', paymentInfo.expiry);
            await this.page.fill('#cardCvv', paymentInfo.cvv);
            logger.info('Payment info filled');
        } catch (error) {
            logger.error('Failed to fill payment info:', error);
            throw error;
        }
    }

    async fillShippingAddress(address) {
        try {
            await this.page.fill('#address', address);
            logger.info('Shipping address filled');
        } catch (error) {
            logger.error('Failed to fill shipping address:', error);
            throw error;
        }
    }
}

module.exports = CheckoutService; 