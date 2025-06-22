const logger = require('../../config/logger');

class AuthService {
    constructor(page) {
        this.page = page;
    }

    async login(email, password) {
        try {
            logger.info('Logging in to Rakuten with email:', email);
            // Navigate to Rakuten main page
            await this.page.goto('https://www.rakuten.co.jp/', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            // Navigate to Rakuten main page
            await this.page.goto('https://login.account.rakuten.com/sso/authorize?client_id=rakuten_ichiba_top_web&service_id=s245&response_type=code&scope=openid&redirect_uri=https%3A%2F%2Fwww.rakuten.co.jp%2F#/sign_in', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            logger.info('Rakuten main page loaded, looking for login button...');
            await this.page.waitForTimeout(2000);
            await this.page.fill('#user_id', email);
            const btnContinue = await this.page.waitForSelector(`text="次へ"`, { timeout: 2000 });
            if (btnContinue) {
                await btnContinue.click();
            }
            await this.page.waitForTimeout(1000);
            await this.page.fill('#password_current', password);
            await this.page.press('#password_current', 'Enter');
            logger.info('Login form submitted, waiting for navigation...');
                
            try {
                await this.page.waitForNavigation({
                    waitUntil: 'domcontentloaded',
                    timeout: 10000
                });
                logger.info('Navigation completed after login');
            } catch (error) {
                logger.info('Navigation timeout, but continuing...');
            }

            await this.page.waitForTimeout(1000);

            // Check if login was successful
            const isLoggedIn = await this.checkLoginStatus();
            if (isLoggedIn) {
                logger.info('Login successful');
                return true;
            } else {
                logger.error('Login failed - still on login page or login unsuccessful');
                return false;
            }
        } catch (error) {
            logger.error('Login error:', error);
            return false;
        }
    }

    async checkLoginStatus() {
        try {
            // Check if we're still on login page or if login was successful
            const currentUrl = this.page.url();
            
            // If we're still on login page, login failed
            if (currentUrl.includes('#/sign_in')) {
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Error checking login status:', error);
            return false;
        }
    }

    async logout() {
        try {
            logger.info('Logging out from Rakuten...');
            
            const logoutSelectors = [
                'text="ログアウト"',
                'text="LOGOUT"',
                'text="Sign Out"',
                'a[href*="logout"]',
                '.logout',
                '#logout'
            ];

            for (const selector of logoutSelectors) {
                try {
                    const logoutButton = await this.page.waitForSelector(selector, { timeout: 2000 });
                    if (logoutButton) {
                        await logoutButton.click();
                        await this.page.waitForTimeout(2000);
                        logger.info('Logout successful');
                        return true;
                    }
                } catch (e) {
                    continue;
                }
            }

            logger.warn('Logout button not found');
            return false;
        } catch (error) {
            logger.error('Logout error:', error);
            return false;
        }
    }
}

module.exports = AuthService; 