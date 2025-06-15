const XLSX = require('xlsx');

// Sample configuration data
const configData = [
    {
        Email: 'your.email@example.com',
        Password: 'your_password',
        Card: JSON.stringify({
            cardNumber: '4111111111111111',
            expiry: '12/25',
            cvv: '123'
        }),
        Address: JSON.stringify({
            name: 'John Doe',
            postalCode: '100-0001',
            prefecture: '東京都',
            city: '千代田区',
            street: '丸の内1-1-1',
            phone: '03-1234-5678'
        }),
        URL: 'https://www.yodobashi.com/product/123456789/',
        Monitor_Interval: 60
    }
];

// Create workbook and worksheet
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(configData);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'Config');

// Write to file
XLSX.writeFile(workbook, 'config.xlsx');

console.log('config.xlsx has been created successfully!'); 