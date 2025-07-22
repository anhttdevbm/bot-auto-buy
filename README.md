# Auto Buy Bot

Bot tự động mua hàng trên Yodobashi.com, BicCamera.com, PopMart.com và Rakuten.co.jp

## Cài đặt nhanh

1. Tải và cài đặt Node.js từ [nodejs.org](https://nodejs.org/), 
   - Tải bản LTS (Long Term Support) 
   - phiên bản ổn định
   - Hiện tại là Node.js 20.x LTS

2. Tải project về máy và giải nén

3. Double-click vào file `start-yodobashi.bat` (yodobashi), `start-biccamera.bat` (BicCamera.com), `start-popMart.bat` (popmart.com), `start-rakuten.bat` (rakuten.co.jp)
   - Bot sẽ tự động cài đặt các thư viện cần thiết
   - Tạo các thư mục cần thiết
   - Chạy bot

## Cấu hình

1. Tạo file Excel tương ứng với từng website:
   - `yodobashi.xlsx` cho Yodobashi
   - `biccamera.xlsx` cho BicCamera
   - `popMart.xlsx` cho PopMart
   - `rakuten.xlsx` cho Rakuten

2. Mỗi file Excel cần có các cột:
   - Email: Email đăng nhập
   - Password: Mật khẩu đăng nhập
   - Card: Thông tin thẻ thanh toán
   - Address: Địa chỉ giao hàng
   - URL: Link sản phẩm cần mua

3. Chọn bot muốn chạy:
   - Yodobashi: `node yodobashiBot.js --excel yodobashi.xlsx`
   - BicCamera: `node bicCameraBot.js --excel biccamera.xlsx`
   - PopMart: `node popMartBot.js --excel popMart.xlsx`
   - Rakuten: `node rakutenBot.js --excel rakuten.xlsx`

## Lưu ý quan trọng

1. Đảm bảo:
   - Đã cài đặt Node.js
   - Có tài khoản trên website tương ứng
   - Kết nối mạng ổn định

2. Kiểm tra:
   - File config.xlsx đúng định dạng
   - Thông tin đăng nhập chính xác

3. Nếu gặp lỗi:
   - Kiểm tra logs trong thư mục logs/
   - Kiểm tra file data/order_log.xlsx
   - Kiểm tra file error.log

## Hướng dẫn cho Developer

1. Cài đặt dependencies:
```bash
npm install
```

2. Cài đặt Playwright browsers:
```bash
npx playwright install chromium
```

3. Chạy trong chế độ development:
```bash
# Cho Yodobashi
node yodobashiBot.js --excel yodobashi.xlsx

# Cho BicCamera
node bicCameraBot.js --excel biccamera.xlsx

# Cho PopMart
node popMartBot.js --excel popMart.xlsx

# Cho Rakuten
node rakutenBot.js --excel rakuten.xlsx
```

4. Cấu trúc project:
```
auto-buy-bot/
├── config/
│   └── logger.js          # Cấu hình logging
├── services/
│   ├── baseBot.js         # Base bot class
│   ├── yodobashiBot/      # Services cho Yodobashi
│   ├── bicCamera/         # Services cho BicCamera
│   ├── popMart/           # Services cho PopMart
│   └── rakuten/           # Services cho Rakuten
├── utils/
│   ├── sessionManager.js  # Quản lý session
│   └── excelManager.js    # Xử lý file Excel
├── .env                   # Cấu hình môi trường
├── package.json          # Dependencies
├── yodobashiBot.js       # Bot Yodobashi
├── bicCameraBot.js       # Bot BicCamera
├── popMartBot.js         # Bot PopMart
├── rakutenBot.js         # Bot Rakuten
├── yodobashi.xlsx        # Cấu hình Yodobashi
├── biccamera.xlsx        # Cấu hình BicCamera
├── popMart.xlsx          # Cấu hình PopMart
└── rakuten.xlsx          # Cấu hình Rakuten
```

5. Debug:
   - Logs được lưu trong thư mục `logs/`
   - Sử dụng `logger.debug()` để debug
   - Kiểm tra file `data/order_log.xlsx` để xem lịch sử đơn hàng
   - Kiểm tra file `error.log` để xem lỗi chi tiết

6. Phát triển:
   - Thêm tính năng mới trong thư mục `services/`
   - Cập nhật cấu hình trong `config/`
   - Thêm utility functions trong `utils/`

## Tính năng

- Tự động đăng nhập và lưu session
- Giám sát và mua sản phẩm tự động
- Xử lý nhiều sản phẩm cùng lúc
- Ghi log chi tiết vào Excel
- Mã hóa dữ liệu nhạy cảm
- Xử lý lỗi thông minh
- Hỗ trợ nhiều website (Yodobashi, BicCamera, PopMart, Rakuten)

## Xử lý lỗi

Bot tự động xử lý các trường hợp:
- Lỗi mạng
- Session hết hạn
- CAPTCHA
- Thông tin thanh toán không hợp lệ
- Sản phẩm hết hàng

## Log và báo cáo

Bot ghi log vào:
- Console (màn hình)
- File Excel (data/order_log.xlsx)
- File log chi tiết (logs/)
- File error.log (lỗi chi tiết)

## Khắc phục sự cố

1. Nếu gặp lỗi CAPTCHA:
   - Kiểm tra API key 2Captcha
   - Đảm bảo kết nối mạng ổn định

2. Nếu session hết hạn:
   - Bot sẽ tự động đăng nhập lại
   - Kiểm tra thông tin đăng nhập trong config.xlsx

3. Nếu mua hàng thất bại:
   - Kiểm tra thông tin thẻ
   - Kiểm tra tình trạng sản phẩm
   - Kiểm tra địa chỉ giao hàng

4. Nếu bot không chạy:
   - Kiểm tra Node.js đã cài đặt chưa
   - Kiểm tra các dependencies đã cài đặt đầy đủ chưa
   - Kiểm tra file config.xlsx có đúng định dạng không
   - Kiểm tra file error.log để xem lỗi chi tiết

## Hỗ trợ

Nếu cần hỗ trợ thêm, vui lòng:
1. Kiểm tra logs trong thư mục logs/
2. Kiểm tra file order_log.xlsx
3. Kiểm tra file error.log
4. Chụp ảnh màn hình lỗi
5. Liên hệ hỗ trợ với thông tin chi tiết 

## Run the Dashboard (Python GUI)

1. Make sure you have Python 3.x installed (if not using the .exe version).
2. Install required libraries:
   ```bash
   pip install pandas openpyxl
   ```
3. Run the dashboard:
   ```bash
   python dashboard.py
   ```
   (Or double-click `dashboard.exe` if you have the packaged version) 