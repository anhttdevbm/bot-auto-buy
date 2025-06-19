const logger = require('../../config/logger');
const cheerio = require('cheerio');

class BicCameraProductService {
    constructor(page) {
        this.page = page;
    }

    async getProductInfo(sku) {
        try {
            logger.info('Fetching product info for SKU:', sku);
            
            // Construct API URL
            const apiUrl = `https://www.biccamera.com/bc/item/${sku}/`;
            
            // Navigate to product page
            await this.page.goto(apiUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            return true;
            // Get page content
            const content = await this.page.content();
            const $ = cheerio.load(content);

            // Extract product information
            const productInfo = {
                name: $('#PROD-CURRENT-NAME').text().trim(),
                // brand: $('.bcs_price').text().trim(),
                price: $('strong[itemprop="price"]').text().trim(),
                // stockStatus: $('.stock-status').text().trim(),
                // rating: this.parseRating($('.rating').attr('class')),
                // reviewCount: this.parseReviewCount($('.review-count').text()),
                // sku,
                // url: apiUrl
            };

            // Validate required fields
            if (!productInfo.name || !productInfo.price) {
                throw new Error('Missing required product information');
            }

            // logger.info('Product info retrieved:', productInfo);
            return productInfo;
        } catch (error) {
            logger.error('Failed to get product info:', error);
            return null;
        }
    }

    parseRating(ratingClass) {
        if (!ratingClass) return null;
        const match = ratingClass.match(/rating-(\d+)/);
        return match ? parseFloat(match[1]) / 10 : null;
    }

    parseReviewCount(countText) {
        if (!countText) return null;
        return parseInt(countText.replace(/[()]/g, ''));
    }

    async checkProduct(url) {
        try {
            // Extract SKU from URL
            const sku = url.split('/').pop().replace('/', '');
            logger.info('Checking product with SKU:', sku);

            // Get product info
            const productInfo = await this.getProductInfo(sku);
            if (!productInfo) {
                throw new Error('Failed to get product info');
            }

            // logger.info('Product check completed:', productInfo);
            return productInfo;
        } catch (error) {
            logger.error('Product check failed:', error);
            return null;
        }
    }
}

module.exports = BicCameraProductService; 