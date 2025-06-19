const cheerio = require('cheerio');
const logger = require('../../config/logger');

class ProductService {
    constructor(page) {
        this.page = page;
    }

    async getProductInfo(sku) {
        try {
            logger.info('Fetching product info for SKU:', sku);
            
            const apiUrl = `https://www.yodobashi.com/ws/api/ec/lego/product?sku=${sku}`;
            const response = await this.page.evaluate(async (url) => {
                const res = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                return await res.json();
            }, apiUrl);

            if (!response.products) {
                throw new Error('No product data in response');
            }

            return this.parseProductInfo(response.products, sku);
        } catch (error) {
            logger.error('Failed to get product info:', error);
            return null;
        }
    }

    parseProductInfo(htmlString, sku) {
        const $ = cheerio.load(htmlString);
        
        // Helper functions
        const getText = (selector) => $(selector).first().text().trim();
        const getAttr = (selector, attr) => $(selector).first().attr(attr);

        const productInfo = {
            name: getText('.pName p:last-child') || 
                  getText('.specifiedProductName strong') || 
                  getText('.fs14 strong'),

            brand: getText('.pName p:first-child') || 
                   getText('.maker a') || 
                   getText('.pSubInfo .mr10 a'),

            price: getText('.productPrice').replace('￥', '').trim(),

            stockStatus: getText('.stockInfo .green') || 
                        getText('.green'),

            rating: this.parseRating(getAttr('.iconStarM, .iconStarS', 'class')),

            reviewCount: this.parseReviewCount(
                getText('.reviewCount') || getText('.fs11.alignM a')
            ),

            deliveryInfo: getText('.deliveryInfo'),
            points: getText('.orange'),
            sku,
            url: `https://www.yodobashi.com/product/${sku}/`
        };

        this.validateProductInfo(productInfo);
        return productInfo;
    }

    parseRating(ratingClass) {
        if (!ratingClass) return null;
        const match = ratingClass.match(/rate(\d+)_(\d+)/);
        return match ? parseFloat(`${match[1]}.${match[2]}`) : null;
    }

    parseReviewCount(countText) {
        return countText ? parseInt(countText.replace(/[()]/g, '')) : null;
    }

    validateProductInfo(productInfo) {
        if (!productInfo.name || !productInfo.price) {
            throw new Error('Missing required product information');
        }
    }

    async checkProduct(url) {
        try {
            const sku = url.split('/').pop().replace('/', '');
            logger.info('Checking product with SKU:', sku);

            const productInfo = await this.getProductInfo(sku);
            if (!productInfo) {
                throw new Error('Failed to get product info from API');
            }

            await this.page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            logger.info('Product info:', productInfo);
            return productInfo;
        } catch (error) {
            logger.error('Product check failed:', error);
            return null;
        }
    }
}

module.exports = ProductService; 