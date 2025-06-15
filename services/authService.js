const logger = require('../config/logger');

class AuthService {
    constructor(page) {
        this.page = page;
    }

    async login(email, password) {
        try {
            logger.info('Logging in with email:', email);
            
            // First try to access the main site
            await this.page.goto('https://www.yodobashi.com/', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            
            logger.info('Main site loaded, now trying login page...');
            await this.page.waitForTimeout(2000);
            
            // Then navigate to login page
            await this.page.goto('https://order.yodobashi.com/yc/login/index.html?returnUrl=https%3A%2F%2Fwww.yodobashi.com%2F', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            await this.page.waitForTimeout(2000);
            
            logger.info('Login page loaded, checking for elements...');
            
            // Wait for login form to be visible
            await this.page.waitForSelector('#memberId');
            logger.info('Login form found');
            
            // Check for CAPTCHA
            const captchaElement = await this.page.$('#captcha');
            if (captchaElement) {
                logger.info('CAPTCHA found, solving...');
                const captchaSolution = await this.solveCaptcha();
                await this.page.fill('#captcha', captchaSolution);
            }

            await this.page.fill('#memberId', email);
            await this.page.waitForTimeout(1000);
            await this.page.fill('#password', password);
            
            logger.info('Filled login form, clicking submit...');
            await this.page.click('a[id="js_i_login0"]');
            
            try {
                await this.page.waitForNavigation({
                    waitUntil: 'domcontentloaded',
                    timeout: 3000
                });
                logger.info('Navigation completed');
            } catch (error) {
                logger.info('Navigation timeout, but continuing...');
            }
            
            const isLoggedIn = await this.checkLoginStatus();
            if (isLoggedIn) {
                logger.info('Login successful');
                return true;
            } else {
                logger.error('Login failed - still on login page');
                return false;
            }
        } catch (error) {
            logger.error('Login error:', error);
            return false;
        }
    }

    async checkLoginStatus() {
        return await this.page.evaluate(() => {
            return !document.querySelector('#memberId') &&
                   !document.querySelector('#password');
        });
    }

    async solveCaptcha() {
        try {
            const captchaImage = await this.page.$eval('#captcha', img => img.src);
            const result = await this.solver.recaptcha(
                '6LfD6PoUAAAAAJfdqx4eGkz9VhYVhH9K8owLtq3A',
                'https://order.yodobashi.com/yc/login/index.html'
            );
            return result.data;
        } catch (error) {
            logger.error('CAPTCHA solving failed:', error);
            throw error;
        }
    }
}

module.exports = AuthService; 