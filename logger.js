const winston = require('winston');
const path = require('path');
const config = require('./config');

const { combine, timestamp, printf, colorize, align } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase().padEnd(7)}] ${message} ${stack ? '\n' + stack : ''}`;
});

const transports = [];

if (config.LOGGING.logToConsole) {
    transports.push(
        new winston.transports.Console({
            format: combine(
                colorize({ all: true }),
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                align(),
                logFormat
            ),
        })
    );
}

if (config.LOGGING.logToFile) {
    transports.push(
        new winston.transports.File({
            filename: path.join(__dirname, 'logs', 'server.log'),
            level: 'info',
            format: combine(
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                logFormat
            ),
        })
    );
}

const logger = winston.createLogger({
    level: config.LOGGING.level,
    transports: transports,
    exceptionHandlers: transports,
    rejectionHandlers: transports,
    exitOnError: false,
});

module.exports = logger;