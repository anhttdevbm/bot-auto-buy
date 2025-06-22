const logger = require('../../config/logger');

class ProductService {
    constructor(page) {
        this.page = page;
    }

    async getProductInfo() {
        try {
            // Common selectors for Rakuten product pages
            const selectors = {
                name: [
                    '.normal_reserve_item_name',
                ],
                price: [
                    '.value--1oSD_',
                ],
                brand: [
                    '.brand',
                    '.item-brand',
                    '.product-brand',
                    '.brand-name',
                    '[data-testid="brand"]'
                ],
                availability: [
                    '.stock',
                    '.availability',
                    '.in-stock',
                    '.out-of-stock',
                    '[data-testid="availability"]'
                ]
            };

            const productInfo = {};

            // Get product name
            for (const selector of selectors.name) {
                try {
                    const element = await this.page.waitForSelector(selector, { timeout: 2000 });
                    if (element) {
                        productInfo.name = await element.textContent();
                        productInfo.name = productInfo.name.trim();
                        logger.info(`Found product name with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            // Get product price
            for (const selector of selectors.price) {
                try {
                    const element = await this.page.waitForSelector(selector, { timeout: 2000 });
                    if (element) {
                        productInfo.price = await element.textContent();
                        productInfo.price = productInfo.price.trim();
                        logger.info(`Found product price with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            // Get product brand
            // for (const selector of selectors.brand) {
            //     try {
            //         const element = await this.page.waitForSelector(selector, { timeout: 2000 });
            //         if (element) {
            //             productInfo.brand = await element.textContent();
            //             productInfo.brand = productInfo.brand.trim();
            //             logger.info(`Found product brand with selector: ${selector}`);
            //             break;
            //         }
            //     } catch (e) {
            //         continue;
            //     }
            // }

            // Check availability
            // for (const selector of selectors.availability) {
            //     try {
            //         const element = await this.page.waitForSelector(selector, { timeout: 2000 });
            //         if (element) {
            //             productInfo.availability = await element.textContent();
            //             productInfo.availability = productInfo.availability.trim();
            //             logger.info(`Found availability with selector: ${selector}`);
            //             break;
            //         }
            //     } catch (e) {
            //         continue;
            //     }
            // }

            // If no availability found, try to check for add to cart button
            if (!productInfo.availability) {
                const addToCartSelectors = [
                    'text="かごに追加"',
                    'text="購入手続きへ"',
                    // 'text="購入する"',
                    // 'text="Buy Now"',
                    // '.add-to-cart',
                    // '#add-to-cart',
                    // '[data-testid="add-to-cart"]'
                ];

                for (const selector of addToCartSelectors) {
                    try {
                        const element = await this.page.waitForSelector(selector, { timeout: 2000 });
                        if (element) {
                            productInfo.availability = 'In Stock';
                            logger.info(`Found add to cart button with selector: ${selector}`);
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }

            if (!productInfo.name || !productInfo.price) {
                throw new Error('Missing required product information (name or price)');
            }

            return productInfo;
        } catch (error) {
            logger.error('Failed to get product info:', error);
            return null;
        }
    }

    async checkProduct(url) {
        try {
            logger.info(`Checking product at URL: ${url}`);
            await this.page.waitForTimeout(1000);

            await this.page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            await this.page.waitForTimeout(1000);

            const productInfo = await this.getProductInfo();
            if (!productInfo) {
                throw new Error('Failed to get product info from page');
            }

            // Check if product is available for purchase
            const isAvailable = this.isProductAvailable(productInfo);
            productInfo.isAvailable = isAvailable;

            logger.info('Product info:', productInfo);
            return productInfo;
        } catch (error) {
            logger.error('Product check failed:', error);
            return null;
        }
    }

    isProductAvailable(productInfo) {
        if (!productInfo.availability) {
            return true; // Assume available if no availability info found
        }

        const availabilityText = productInfo.availability.toLowerCase();
        const outOfStockKeywords = [
            'out of stock',
            'sold out',
            '在庫切れ',
            '売り切れ',
            '品切れ',
            '完売',
            '予約受付終了',
            '受付終了'
        ];

        return !outOfStockKeywords.some(keyword => availabilityText.includes(keyword));
    }

    async waitForProductAvailability(url, maxAttempts = 10, interval = 5000) {
        logger.info(`Waiting for product availability at: ${url}`);
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            logger.info(`Attempt ${attempt}/${maxAttempts}`);
            
            const productInfo = await this.checkProduct(url);
            if (productInfo && productInfo.isAvailable) {
                logger.info('Product is now available!');
                return productInfo;
            }
            
            if (attempt < maxAttempts) {
                logger.info(`Product not available, waiting ${interval/1000} seconds before next attempt...`);
                await this.page.waitForTimeout(interval);
            }
        }
        
        logger.warn('Product did not become available within the specified time');
        return null;
    }
}

module.exports = ProductService; 