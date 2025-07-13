const logger = require('../../config/logger');
const { createCanvas, loadImage } = require('canvas');

class BicCameraAuthService {
    constructor(page) {
        this.page = page;
        // this.setupBrowserContext();
    }

    async setupBrowserContext() {
        try {
            // Thêm header giả lập trình duyệt thật
            await this.page.setExtraHTTPHeaders({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0',
                'http2': 'false'
            });

            // Thêm các tham số để giả lập trình duyệt thật
            await this.page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['ja-JP', 'ja', 'en-US', 'en'] });
            });

            logger.info('Browser context setup completed');
        } catch (error) {
            logger.error('Failed to setup browser context:', error);
        }
    }

    async login(email, password) {
        try {
            logger.info('Logging in to BicCamera...', email);

            // First try to access the main site
            // await this.page.goto('https://www.biccamera.com/bc/main/', {
            //     waitUntil: 'domcontentloaded',
            //     timeout: 30000
            // });
            // await this.page.context().clearCookies();
            // await this.page.evaluate(() => {
            //     localStorage.clear();
            //     sessionStorage.clear();
            // });

            // // logger.info('Main site loaded, now trying login page...');
            // await this.page.waitForTimeout(2000);
            
            // Navigate to login page
            await this.page.goto('https://www.biccamera.com/bc/member/CSfLogin.jsp', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            await this.page.waitForTimeout(2000);

            logger.info('Login page loaded, checking for elements...');

            // Fill login form
            await this.page.fill('input[type="text"]:nth-of-type(1)', email);
            await this.page.waitForTimeout(1000);
            await this.page.waitForSelector('text="次回からメールアドレスの入力を省略する"', { timeout: 30000 });
            await this.page.click('text="次回からメールアドレスの入力を省略する"');
            await this.page.fill('input[type="password"]:nth-of-type(1)', password);
            await this.page.waitForTimeout(1000);
            
            // Submit form
            await this.page.click('#TMP-BTN-1');

            // Check for CAPTCHA
            // const captchaElement = await this.page.$('#login_imagecheck');
            // if (captchaElement) {
            //     logger.info('CAPTCHA found, solving...');
            //     const captchaSolution = await this.solveCaptcha();
            //     await this.page.fill('#login_imagecheck', captchaSolution);
            // }

            // await this.page.click('#TMP-BTN-1');
            // Lấy phần tử <img>
            // Lấy src của ảnh
            const imageIds = [
                'login_img_btn00',
                'login_img_btn01',
                'login_img_btn02',
                'login_img_btn03',
                'login_img_btn04'
            ];

            // Wait for navigation
            try {
                await this.page.waitForNavigation({
                    waitUntil: 'domcontentloaded',
                    timeout: 5000
                });
            } catch (error) {
                logger.warn('Navigation timeout, but continuing...');
            }
            
            // Check if CAPTCHA images exist before processing
            try {
                await this.page.waitForSelector('#login_img_btn00', { timeout: 5000 });
                logger.info('CAPTCHA images found, processing...');
                
                for (const id of imageIds) {
                    const imgElement = await this.page.$(`#${id}`);
                    if (!imgElement) {
                        logger.warn(`Image element with id ${id} not found`);
                        continue;
                    }
                
                    const imgSrc = await this.page.$eval(`#${id}`, img => img.src);
                
                    const color = await this.page.evaluate(async (src) => {
                        return new Promise((resolve, reject) => {
                            const img = new Image();
                            img.crossOrigin = 'Anonymous';
                            img.onload = function() {
                                const canvas = document.createElement('canvas');
                                canvas.width = img.width;
                                canvas.height = img.height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0);
                                const x = Math.floor(img.width / 2);
                                const y = Math.floor(img.height / 2);
                                const data = ctx.getImageData(x, y, 1, 1).data;
                                resolve({ r: data[0], g: data[1], b: data[2], a: data[3] });
                            };
                            img.onerror = reject;
                            img.src = src;
                        });
                    }, imgSrc);
                
                    console.log('Màu pixel trung tâm:', color);
                    await this.page.waitForTimeout(500);
                    if (color.r != 150) {
                        await this.page.click(`#${id}`);
                        // If clicking causes navigation, break out of the loop
                        // break;
                    }
                }
                await this.page.click('#TMP-BTN-1');
            } catch (error) {
                logger.info('No CAPTCHA images found, continuing with login...');
            }
            
            // Wait for navigation
            try {
                await this.page.waitForNavigation({
                    waitUntil: 'domcontentloaded',
                    timeout: 120000
                });
            } catch (error) {
                logger.warn('Navigation timeout, but continuing...');
            }

            // Check if login was successful
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

    checkLoginStatus() {
        return this.page.evaluate(() => {
            return !document.querySelector('#TMP-BTN-1');
        });
    }

    async solveCaptcha() {
        try {
            const captchaImage = await this.page.$eval('#login_imagecheck', img => img.src);
            const result = await this.solver.recaptcha(
                '6LfD6PoUAAAAAJfdqx4eGkz9VhYVhH9K8owLtq3A',
                'https://www.biccamera.com/bc/member/CSfLogin.jsp'
            );
            return result.data;
        } catch (error) {
            logger.error('CAPTCHA solving failed:', error);
            throw error;
        }
    }
}

module.exports = BicCameraAuthService; 