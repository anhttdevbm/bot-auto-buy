const XLSX = require('xlsx');
const logger = require('../config/logger');
const fs = require('fs');
const path = require('path');

class ExcelManager {
    constructor(filePath) {
        this.filePath = filePath;
        this.logPath = path.join('data', 'order_log.xlsx');
        this.ensureDirectoriesExist();
    }

    ensureDirectoriesExist() {
        const dir = path.dirname(this.logPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    readConfig() {
        try {
            const workbook = XLSX.readFile(this.filePath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            return XLSX.utils.sheet_to_json(sheet);
        } catch (error) {
            logger.error('Failed to read config:', error);
            throw error;
        }
    }

    logOrder(productInfo) {
        try {
            let workbook;
            let sheet;

            // Check if log file exists
            if (fs.existsSync(this.logPath)) {
                workbook = XLSX.readFile(this.logPath);
                sheet = workbook.Sheets['Orders'];
            } else {
                // Create new workbook with headers
                workbook = XLSX.utils.book_new();
                sheet = XLSX.utils.aoa_to_sheet([
                    ['Timestamp', 'Product', 'Price', 'Status']
                ]);
                XLSX.utils.book_append_sheet(workbook, sheet, 'Orders');
            }

            // Add new row
            const newRow = [
                new Date().toISOString(),
                productInfo.name,
                productInfo.price,
                'Purchased'
            ];
            XLSX.utils.sheet_add_aoa(sheet, [newRow], { origin: -1 });

            // Write to file
            XLSX.writeFile(workbook, this.logPath);
            logger.info('Order logged successfully');
        } catch (error) {
            logger.error('Failed to log order:', error);
            throw error;
        }
    }
}

module.exports = ExcelManager; 