# Yodobashi Auto Buy Bot

Bot tự động mua hàng trên Yodobashi.com

## Cài đặt nhanh

1. Tải và cài đặt Node.js từ [nodejs.org](https://nodejs.org/), 
   - Tải bản LTS (Long Term Support) 
   - phiên bản ổn định
   - Hiện tại là Node.js 20.x LTS

2. Tải project về máy và giải nén

3. Double-click vào file `start-bot.bat`
   - Bot sẽ tự động cài đặt các thư viện cần thiết
   - Tạo các thư mục cần thiết
   - Chạy bot

## Cấu hình

1. Tạo file `config.xlsx` với các cột:
   - Email: Email đăng nhập Yodobashi
   - Password: Mật khẩu đăng nhập
   - Card: Thông tin thẻ thanh toán
   - Address: Địa chỉ giao hàng
   - URL: Link sản phẩm cần mua

## Lưu ý quan trọng

1. Đảm bảo:
   - Đã cài đặt Node.js
   - Có tài khoản Yodobashi
   - Kết nối mạng ổn định

2. Kiểm tra:
   - File config.xlsx đúng định dạng
   - Thông tin đăng nhập chính xác

3. Nếu gặp lỗi:
   - Kiểm tra logs trong thư mục logs/
   - Kiểm tra file data/order_log.xlsx

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
node bot.js --excel config.xlsx
```

4. Cấu trúc project:
```
yodobashi-bot/
├── config/
│   └── logger.js          # Cấu hình logging
├── services/
│   ├── authService.js     # Xử lý đăng nhập
│   ├── productService.js  # Xử lý thông tin sản phẩm
│   └── checkoutService.js # Xử lý thanh toán
├── utils/
│   ├── sessionManager.js  # Quản lý session
│   └── excelManager.js    # Xử lý file Excel
├── .env                   # Cấu hình môi trường
├── package.json          # Dependencies
├── bot.js               # File chính
└── config.xlsx          # Cấu hình bot
```

5. Debug:
   - Logs được lưu trong thư mục `logs/`
   - Sử dụng `logger.debug()` để debug
   - Kiểm tra file `data/order_log.xlsx` để xem lịch sử đơn hàng

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

## Hỗ trợ

Nếu cần hỗ trợ thêm, vui lòng:
1. Kiểm tra logs trong thư mục logs/
2. Kiểm tra file order_log.xlsx
3. Chụp ảnh màn hình lỗi
4. Liên hệ hỗ trợ với thông tin chi tiết 