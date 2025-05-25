const winston = require('winston');
const moment = require('moment');
const fs = require('fs-extra');

class Logger {
    constructor() {
        this.setupLogger();
    }

    setupLogger() {
        // Pastikan direktori logs ada
        fs.ensureDirSync('./logs');

        const logFormat = winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.printf(({ timestamp, level, message, stack }) => {
                const time = moment(timestamp).format('YYYY-MM-DD HH:mm:ss');
                return `[${time}] ${level.toUpperCase()}: ${stack || message}`;
            })
        );

        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: logFormat,
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        logFormat
                    )
                })
            ]
        });

        // Tambah file logging jika diaktifkan
        if (process.env.LOG_TO_FILE === 'true') {
            this.logger.add(new winston.transports.File({
                filename: `./logs/pharos-bot-${moment().format('YYYY-MM-DD')}.log`,
                maxsize: 5242880, // 5MB
                maxFiles: 7
            }));
        }
    }

    info(message, account = null) {
        const logMessage = account ? `[${account}] ${message}` : message;
        this.logger.info(logMessage);
    }

    error(message, account = null, error = null) {
        const logMessage = account ? `[${account}] ${message}` : message;
        if (error) {
            this.logger.error(logMessage, error);
        } else {
            this.logger.error(logMessage);
        }
    }

    warn(message, account = null) {
        const logMessage = account ? `[${account}] ${message}` : message;
        this.logger.warn(logMessage);
    }

    success(message, account = null) {
        const logMessage = account ? `[${account}] ✅ ${message}` : `✅ ${message}`;
        this.logger.info(logMessage);
    }
}

module.exports = new Logger();
