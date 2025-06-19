const cheerio = require('cheerio');
const logger = require('../../config/logger');

class ProductService {
    constructor(page) {
        this.page = page;
    }

    async getProductInfo() {
        try {
            const productInfo = {
                name: await this.page.textContent('.index_title___0OsZ'),
                brand: await this.page.textContent('.index_shorDesc__HTMgu'),
                price: await this.page.textContent('.index_price__cAj0h'),
            }
            if (!productInfo.name || !productInfo.price) {
                throw new Error('Missing required product information');
            }
            return productInfo;
        } catch (error) {
            logger.error('Failed to get product info:', error);
            return null;
        }
    }

    async checkProduct(url) {
        try {
            await this.page.waitForTimeout(1000);

            await this.page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            const productInfo = await this.getProductInfo();
            if (!productInfo) {
                throw new Error('Failed to get product info from API');
            }

            logger.info('Product info:', productInfo);
            return productInfo;
        } catch (error) {
            logger.error('Product check failed:', error);
            return null;
        }
    }
}

module.exports = ProductService; 