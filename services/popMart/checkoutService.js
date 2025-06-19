const logger = require('../../config/logger');

class CheckoutService {
    constructor(page) {
        this.page = page;
    }

    async addToCart() {
        try {
            const btnAddToCart = await this.page.waitForSelector('text="ADD TO CART"', { timeout: 3000 });
            if (!btnAddToCart) {
                throw new Error('Add to cart button not found');
            } else {
                btnAddToCart.click(); // Click the button with a timeout
            }
            logger.info('Product added to cart');
            return true;
        } catch (error) {
            logger.error('Add to cart failed:', error);
            return false;
        }
    }

    async checkout(paymentInfo, address) {
        try {
            await this.page.waitForTimeout(1000); // Wait for page to load
            // Navigate to cart page
            await this.page.goto('https://www.popmart.com/jp/largeShoppingCart', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            // Wait for and click "Proceed to Purchase" button
            const checkOutBtn = await this.page.waitForSelector('text="CHECK OUT"', { timeout: 5000 });
            if (!checkOutBtn) {
                throw new Error('Checkout button not found');
            } else {
                await checkOutBtn.click(); // Click the button with a timeout
            }

            await this.page.waitForTimeout(7000); // Wait for page to load
            // Wait for and click "Login" button if not logged in
            const cancelPayBtn = await this.page.waitForSelector('text="CANCEL PAYMENT"', { timeout: 5000 });
            if (cancelPayBtn) {
                await cancelPayBtn.click(); // Click the button with a timeout
                logger.info('Cancelled payment, returning to cart');
                return false; // Exit checkout if cancelled
            }
            // Wait for and click "Next" button
            const payBtn = await this.page.waitForSelector('text="PROCEED TO PAY"', { timeout: 15000 });
            if (!payBtn) {
                throw new Error('Proceed to Pay button not found');
            } else {
                await payBtn.click({ timeout: 30000 }); // Click the button with a timeout
            }
            try {
                await this.page.waitForNavigation({
                    waitUntil: 'domcontentloaded',
                    timeout: 20000
                });
            } catch (error) {
                await payBtn.click({ timeout: 30000 });
                logger.warn('Navigation timeout, but continuing...');
            }

            // Wait for and click "Confirm Order" button
            // const confirmBtn = await this.page.waitForSelector('text="CONFIRM AND PAY"', { timeout: 30000 });
            // if (!confirmBtn) {
            //     throw new Error('Confirm and Pay button not found');
            // } else {
            //     // Click the button with a timeout
            //     await confirmBtn.click({ timeout: 30000});
            // }

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