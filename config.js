// config.js

module.exports = {
    API: {
        baseURL: process.env.API_BASE_URL || 'https://your-api-domain.com/api',
        apiKey: process.env.API_KEY || 'your-api-key-here',
        timeout: 10000,
        endpoints: {
            login: '/auth/login',
            validateCredentials: '/auth/validate',
            refreshToken: '/auth/refresh',
            checkEmail: '/email/check',
            logEmailActivity: '/email/log',
            getEmailStats: '/email/stats',
            logActivity: '/log/activity',
            getActivityLog: '/log/get',
            customEndpoint: '/custom/endpoint',
            accountManagement: '/account/manage',
            secureCheck: '/secure/check',
            encryptedData: '/secure/encrypt'
        },
        defaultHeaders: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'EmailClient/1.0',
            'X-Client-Version': '1.0.0'
        }
    },
    HTTPS: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
        timeout: 10000,
        keepAlive: true,
        maxSockets: 50,
        secureProtocol: 'TLSv1_2_method',
        ciphers: [
            'ECDHE-RSA-AES128-GCM-SHA256',
            'ECDHE-RSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES128-SHA256',
            'ECDHE-RSA-AES256-SHA384'
        ].join(':')
    },
    EMAIL: {
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
        pop3: {
            connectionTimeout: 10000,
            socketTimeout: 0,
            enabletls: true,
            debug: process.env.NODE_ENV !== 'production'
        },
        smtp: {
            connectionTimeout: 10000,
            socketTimeout: 0,
            greetingTimeout: 5000,
            pool: true,
            maxConnections: 5,
            maxMessages: 100
        }
    },
    LOGGING: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        logToAPI: true,
        logToConsole: true,
        logToFile: true,
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
    PROVIDERS: {
        gmail: {
            name: 'Gmail',
            imap: { host: 'imap.gmail.com', port: 993, secure: true },
            pop3: { host: 'pop.gmail.com', port: 995, secure: true },
            smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
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
            smtp: { host: 'smtp.yandex.ru', port: 465, secure: true },
            requiresAppPassword: true,
            authURL: 'https://passport.yandex.ru/profile/app-passwords'
        },
        mailru: {
            name: 'Mail.ru',
            imap: { host: 'imap.mail.ru', port: 993, secure: true },
            pop3: { host: 'pop.mail.ru', port: 995, secure: true },
            smtp: { host: 'smtp.mail.ru', port: 465, secure: true },
            requiresAppPassword: true,
            authURL: 'https://account.mail.ru/user/2-step-auth/passwords/'
        },
        gmx: {
            name: 'GMX',
            imap: { host: 'imap.gmx.com', port: 993, secure: true },
            pop3: { host: 'pop.gmx.com', port: 995, secure: true },
            smtp: { host: 'mail.gmx.com', port: 465, secure: true },
            requiresAppPassword: false,
            authURL: ''
        },
        zoho: {
            name: 'Zoho',
            imap: { host: 'imap.zoho.com', port: 993, secure: true },
            pop3: { host: 'pop.zoho.com', port: 995, secure: true },
            smtp: { host: 'smtp.zoho.com', port: 465, secure: true },
            requiresAppPassword: true,
            authURL: 'https://accounts.zoho.com/apppasswords'
        },
        yahoo: {
            name: 'Yahoo',
            imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
            pop3: { host: 'pop.mail.yahoo.com', port: 995, secure: true },
            smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
            requiresAppPassword: true,
            authURL: 'https://login.yahoo.com/account/security/app-passwords'
        },
        custom: {
            name: 'Custom Server',
            requiresAppPassword: false
        }
    },
    SECURITY: {
        maxConnectionAttempts: 3,
        retryDelay: 2000,
        maxAccountsPerClient: 50,
        encryptPasswords: process.env.NODE_ENV === 'production',
        encryptionKey: process.env.ENCRYPTION_KEY || 'default-key-change-in-production'
    },
    RATE_LIMIT: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 100,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
    }
};
