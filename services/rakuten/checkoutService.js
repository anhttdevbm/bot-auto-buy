const { Logger } = require('winston');
const logger = require('../../config/logger');

class CheckoutService {
    constructor(page) {
        this.page = page;
    }

    async addToCart() {
        try {
            logger.info('Attempting to add product to cart...');
            
            // Common selectors for add to cart buttons on Rakuten
            const addToCartSelectors = [
                // 'text="かごに追加"',
                'text="購入手続きへ"',
                // 'text="Add to Cart"',
                // 'text="Buy Now"',
                // 'text="買い物かごに入れる"',
                // 'text="ショッピングカートに追加"',
                // '.add-to-cart',
                // '#add-to-cart',
                // '[data-testid="add-to-cart"]',
                // 'button[onclick*="cart"]',
                // 'input[value*="カート"]',
                // 'input[value*="cart"]'
            ];

            let addToCartButton = null;
            for (const selector of addToCartSelectors) {
                try {
                    const elements = await this.page.$$(selector, { timeout: 3000 });
                    if (elements.length >= 2) {
                        addToCartButton = elements[1];
                        logger.info(`Found 2nd add to cart button with selector: ${selector}`);
                        break;
                    } else if (elements.length === 1) {
                        addToCartButton = elements[0];
                        logger.info(`Found 1st add to cart button with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!addToCartButton) {
                throw new Error('Add to cart button not found');
            }

            await addToCartButton.click();
            logger.info('Add to cart button clicked');
            
            // Wait for potential confirmation or cart update
            await this.page.waitForTimeout(1000);
            
            // Check if there's a quantity selector and set it to 1 if needed
            // await this.setQuantity(1);
            
            logger.info('Product added to cart successfully');
            return true;
        } catch (error) {
            logger.error('Add to cart failed:', error);
            return false;
        }
    }

    async setQuantity(quantity) {
        try {
            const quantitySelectors = [
                'select[name="quantity"]',
                'input[name="quantity"]',
                '#quantity',
                '.quantity-selector',
                '[data-testid="quantity"]'
            ];

            for (const selector of quantitySelectors) {
                try {
                    const quantityElement = await this.page.waitForSelector(selector, { timeout: 2000 });
                    if (quantityElement) {
                        const tagName = await quantityElement.evaluate(el => el.tagName.toLowerCase());
                        
                        if (tagName === 'select') {
                            await quantityElement.selectOption(quantity.toString());
                        } else if (tagName === 'input') {
                            await quantityElement.fill(quantity.toString());
                        }
                        
                        logger.info(`Quantity set to ${quantity}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
        } catch (error) {
            logger.warn('Could not set quantity:', error);
        }
    }

    async checkout(paymentInfo, address, password, yyyyMMdd = '19980205') {
        try {
            logger.info('Starting checkout process...');
            await this.page.waitForTimeout(1000);
            
            // Navigate to cart page
            // await this.page.goto('https://www.rakuten.co.jp/cart/', {
            //     waitUntil: 'domcontentloaded',
            //     timeout: 60000
            // });
            
            // await this.page.waitForTimeout(3000);
            
            // Look for checkout/proceed to purchase button
            const checkoutSelectors = [
                // 'text="レジに進む"',
                // 'text="Checkout"',
                // 'text="購入手続きへ"',
                // 'text="Proceed to Checkout"',
                // 'text="注文手続きへ"',
                // 'text="Order"',
                // '.checkout-btn',
                // '#checkout-btn',
                // '[data-testid="checkout"]',
                // 'button[onclick*="checkout"]',
                'input[value*="ご購入手続き"]',
                // 'input[value*="checkout"]'
            ];

            let checkoutButton = null;
            for (const selector of checkoutSelectors) {
                try {
                    checkoutButton = await this.page.waitForSelector(selector, { timeout: 5000 });
                    if (checkoutButton) {
                        logger.info(`Found checkout button with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!checkoutButton) {
                throw new Error('Checkout button not found');
            }

            await checkoutButton.click();
            logger.info('Checkout button clicked');
            
            await this.page.waitForTimeout(1000);

            // Handle potential login requirement
            await this.handleLoginIfRequired(password, yyyyMMdd);

            // Fill shipping address if needed
            // await this.fillShippingAddress(address);

            // Fill payment information if needed
            // await this.fillPaymentInfo(paymentInfo);

            // Look for final order confirmation button
            const confirmSelectors = [
                // 'text="注文を確定する"',
                // 'text="Confirm Order"',
                // 'text="注文確定"',
                // 'text="Place Order"',
                // 'text="購入を確定"',
                // '.confirm-order',
                'input[value*="注文を確定する"]',
                // '[data-testid="confirm-order"]'
            ];

            let confirmButton = null;
            for (const selector of confirmSelectors) {
                try {
                    confirmButton = await this.page.waitForSelector(selector, { timeout: 10000 });
                    if (confirmButton) {
                        logger.info(`Found confirm order button with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (confirmButton) {
                await confirmButton.click();
                logger.info('Order confirmed');
                
                // try {
                //     await this.page.waitForNavigation({
                //         waitUntil: 'domcontentloaded',
                //         timeout: 15000
                //     });
                //     logger.info('Navigation completed after order confirmation');
                // } catch (error) {
                //     logger.warn('Navigation timeout after order confirmation, but continuing...');
                // }
            } else {
                logger.warn('Confirm order button not found, but checkout process may have completed');
            }

            logger.info('Checkout completed successfully');
            return true;
        } catch (error) {
            logger.error('Checkout failed:', error);
            return false;
        }
    }

    async handleLoginIfRequired(password, yyyyMMdd = '19980205') {
        try {
            await this.page.waitForTimeout(1000);
            try {
                await this.page.fill('input[class="password"]', password, { timeout: 3000 });
                await this.page.waitForTimeout(1000);
                await this.page.click('#login_submit', { timeout: 5000 });

                await this.page.waitForTimeout(1000);
                await this.page.fill('input[id="loginInner_p"]', password, { timeout: 5000 });
                await this.page.fill('#loginInner_birthday', yyyyMMdd + '', { timeout: 5000 });
                await this.page.press('#loginInner_birthday', 'Enter', { timeout: 5000 });
            } catch (error) {
                logger.info('Continue...');
            }

            await this.page.waitForTimeout(1000);
            await this.page.click('#submit-button');

            return true;
        } catch (error) {
            logger.error('Error handling login requirement:', error);
            return false;
        }
    }

    async fillShippingAddress(address) {
        try {
            logger.info('Filling shipping address...');
            
            // Common address field selectors
            const addressFields = {
                name: ['input[name="name"]', '#name', 'input[placeholder*="名前"]'],
                postalCode: ['input[name="postal"]', '#postal', 'input[placeholder*="郵便番号"]'],
                prefecture: ['select[name="prefecture"]', '#prefecture'],
                city: ['input[name="city"]', '#city', 'input[placeholder*="市区町村"]'],
                address: ['input[name="address"]', '#address', 'input[placeholder*="住所"]'],
                phone: ['input[name="phone"]', '#phone', 'input[placeholder*="電話"]']
            };

            for (const [field, selectors] of Object.entries(addressFields)) {
                if (address[field]) {
                    for (const selector of selectors) {
                        try {
                            const element = await this.page.waitForSelector(selector, { timeout: 2000 });
                            if (element) {
                                const tagName = await element.evaluate(el => el.tagName.toLowerCase());
                                
                                if (tagName === 'select') {
                                    await element.selectOption(address[field]);
                                } else {
                                    await element.fill(address[field]);
                                }
                                
                                logger.info(`Filled ${field} field`);
                                break;
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                }
            }
            
            logger.info('Shipping address filled');
        } catch (error) {
            logger.error('Failed to fill shipping address:', error);
        }
    }

    async fillPaymentInfo(paymentInfo) {
        try {
            logger.info('Filling payment information...');
            
            // Common payment field selectors
            const paymentFields = {
                cardNumber: ['input[name="card_number"]', '#card_number', 'input[placeholder*="カード番号"]'],
                expiryMonth: ['select[name="expiry_month"]', '#expiry_month'],
                expiryYear: ['select[name="expiry_year"]', '#expiry_year'],
                cvv: ['input[name="cvv"]', '#cvv', 'input[placeholder*="セキュリティコード"]']
            };

            for (const [field, selectors] of Object.entries(paymentFields)) {
                if (paymentInfo[field]) {
                    for (const selector of selectors) {
                        try {
                            const element = await this.page.waitForSelector(selector, { timeout: 2000 });
                            if (element) {
                                const tagName = await element.evaluate(el => el.tagName.toLowerCase());
                                
                                if (tagName === 'select') {
                                    await element.selectOption(paymentInfo[field]);
                                } else {
                                    await element.fill(paymentInfo[field]);
                                }
                                
                                logger.info(`Filled ${field} field`);
                                break;
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                }
            }
            
            logger.info('Payment information filled');
        } catch (error) {
            logger.error('Failed to fill payment information:', error);
        }
    }
}

module.exports = CheckoutService; 