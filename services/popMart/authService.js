const logger = require('../../config/logger');

class AuthService {
    constructor(page) {
        this.page = page;
    }

    async login(email, password) {
        try {
            logger.info('Logging in with email:', email);
            
            // First try to access the main site
            await this.page.goto('https://www.popmart.com/jp', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            // clickButtonFunc(this.page, "Japan");
            const btnClick = await this.page.waitForSelector(`text="Japan"`, { timeout: 10000 });
            if (btnClick) {
                await btnClick.click();
            }
            
            logger.info('Main site loaded, now trying login page...');
            await this.page.waitForTimeout(1000);
            
            // Then navigate to login page
            await this.page.goto('https://www.popmart.com/jp/user/login', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            await this.page.waitForTimeout(1000);
            await this.page.click('text="ACCEPT"');
            
            logger.info('Login page loaded, checking for elements...');
            
            // Wait for login form to be visible
            await this.page.waitForSelector(`text="SIGN IN OR REGISTER"`);
            logger.info('Login form found');

            await this.page.fill('#email', email);
            const btnContinue = await this.page.waitForSelector(`text="CONTINUE"`);
            if (btnContinue) {
                await btnContinue.click();
            }
            await this.page.waitForTimeout(1000);
            await this.page.fill('#password', password);
            
            logger.info('Filled login form, clicking submit...');
            const inputPass = await this.page.waitForSelector('input[id="password"]');
            await inputPass.press('Enter');
            // const btnSignIn = await this.page.waitForSelector(`text="SIGN IN"`);
            // if (btnSignIn) {
            //     await btnSignIn.click();
            // }
            
            try {
                await this.page.waitForNavigation({
                    waitUntil: 'domcontentloaded',
                    timeout: 3000
                });
                logger.info('Navigation completed');
            } catch (error) {
                logger.info('Navigation timeout, but continuing...');
            }

            logger.info('Login successful');
            return true;
            
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
            return !document.querySelector('#email') &&
                   !document.querySelector('#password');
        });
    }
}

module.exports = AuthService; 