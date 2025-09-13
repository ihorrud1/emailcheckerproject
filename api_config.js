// config.js - Конфигурация для вашего API
module.exports = {
    // Настройки вашего API
    API: {
        baseURL: process.env.API_BASE_URL || 'https://your-api-domain.com/api',
        apiKey: process.env.API_KEY || 'your-api-key-here',
        timeout: 10000,
        retries: 3,
        
        endpoints: {
            // Аутентификация
            login: '/auth/login',
            validateCredentials: '/auth/validate',
            refreshToken: '/auth/refresh',
            
            // Email операции
            checkEmail: '/email/check',
            logEmailActivity: '/email/log',
            getEmailStats: '/email/stats',
            
            // Логирование
            logActivity: '/log/activity',
            getActivityLog: '/log/get',
            
            // Пользовательские endpoints
            customEndpoint: '/custom/endpoint',
            accountManagement: '/account/manage',
            
            // HTTPS запросы
            secureCheck: '/secure/check',
            encryptedData: '/secure/encrypt'
        },
        
        // Headers по умолчанию
        defaultHeaders: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'EmailClient/1.0',
            'X-Client-Version': '1.0.0'
        }
    },
    
    // HTTPS настройки
    HTTPS: {
        rejectUnauthorized: process.env.NODE_ENV === 'production', // false для разработки
        timeout: 10000,
        keepAlive: true,
        maxSockets: 50,
        
        // SSL/TLS настройки
        secureProtocol: 'TLSv1_2_method',
        ciphers: [
            'ECDHE-RSA-AES128-GCM-SHA256',
            'ECDHE-RSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES128-SHA256',
            'ECDHE-RSA-AES256-SHA384'
        ].join(':')
    },
    
    // Настройки email протоколов
    EMAIL: {
        // IMAP настройки
        imap: {
            connectionTimeout: 10000,
            authTimeout: 5000,
            socketTimeout: 0,
            keepalive: {
                interval: 10000,
                idleInterval: 300000,
                forceNoop: false
            }
        },
        
        // POP3 настройки
        pop3: {
            connectionTimeout: 10000,
            socketTimeout: 0,
            enabletls: true,
            debug: process.env.NODE_ENV !== 'production'
        },
        
        // SMTP настройки
        smtp: {
            connectionTimeout: 10000,
            socketTimeout: 0,
            greetingTimeout: 5000,
            pool: true,
            maxConnections: 5,
            maxMessages: 100
        }
    },
    
    // Логирование
    LOGGING: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        logToAPI: true,
        logToConsole: true,
        logToFile: false,
        
        // Какие события логировать в ваше API
        logEvents: [
            'connection_test',
            'connection_result',
            'emails_fetched',
            'email_sent',
            'api_call',
            'error',
            'login_attempt',
            'logout'
        ]
    },
    
    // Провайдеры email
    PROVIDERS: {
        gmail: {
            name: 'Gmail',
            imap: { host: 'imap.gmail.com', port: 993, secure: true },
            pop3: { host: 'pop.gmail.com', port: 995, secure: true },
            smtp: { host: 'smtp.gmail.com', port: 587, secure: false },
            requiresAppPassword: true,
            authURL: 'https://myaccount.google.com/apppasswords'
        },
        outlook: {
            name: 'Outlook/Hotmail',
            imap: { host: 'outlook.office365.com', port: 993, secure: true },
            pop3: { host: 'outlook.office365.com', port: 995, secure: true },
            smtp: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
            requiresAppPassword: true,
            authURL: 'https://account.microsoft.com/security/app-passwords'
        },
        yandex: {
            name: 'Yandex',
            imap: { host: 'imap.yandex.ru', port: 993, secure: true },
            pop3: { host: 'pop.yandex.ru', port: 995, secure: true },
            smtp: { host: 'smtp.yandex.ru', port: 587, secure: false },
            requiresAppPassword: true,
            authURL: 'https://passport.yandex.ru/profile/app-passwords'
        },
        yahoo: {
            name: 'Yahoo',
            imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
            pop3: { host: 'pop.mail.yahoo.com', port: 995, secure: true },
            smtp: { host: 'smtp.mail.yahoo.com', port: 587, secure: false },
            requiresAppPassword: true,
            authURL: 'https://login.yahoo.com/account/security/app-passwords'
        },
        custom: {
            name: 'Custom Server',
            requiresAppPassword: false
        }
    },
    
    // Безопасность
    SECURITY: {
        // Максимальное количество попыток подключения
        maxConnectionAttempts: 3,
        
        // Таймаут между попытками (мс)
        retryDelay: 2000,
        
        // Максимальное количество аккаунтов на клиента
        maxAccountsPerClient: 50,
        
        // Шифрование паролей (в production используйте настоящее шифрование)
        encryptPasswords: process.env.NODE_ENV === 'production',
        encryptionKey: process.env.ENCRYPTION_KEY || 'default-key-change-in-production'
    },
    
    // Rate limiting для API
    RATE_LIMIT: {
        windowMs: 15 * 60 * 1000, // 15 минут
        maxRequests: 100, // максимум запросов за окно
        skipSuccessfulRequests: false,
        skipFailedRequests: false
    }
};