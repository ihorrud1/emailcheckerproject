// https-examples.js - Примеры HTTPS запросов к вашему API

const https = require('https');
const axios = require('axios');
const config = require('./config');

// Создание HTTPS агента с настройками безопасности
const httpsAgent = new https.Agent({
    rejectUnauthorized: config.HTTPS.rejectUnauthorized,
    keepAlive: config.HTTPS.keepAlive,
    maxSockets: config.HTTPS.maxSockets,
    timeout: config.HTTPS.timeout,
    secureProtocol: config.HTTPS.secureProtocol,
    ciphers: config.HTTPS.ciphers
});

// Axios instance с настройками для вашего API
const apiClient = axios.create({
    baseURL: config.API.baseURL,
    timeout: config.API.timeout,
    httpsAgent: httpsAgent,
    headers: {
        ...config.API.defaultHeaders,
        'Authorization': `Bearer ${config.API.apiKey}`
    }
});

// Функция для выполнения HTTPS запросов к вашему API
async function makeSecureAPICall(endpoint, data = {}, method = 'POST', customHeaders = {}) {
    try {
        console.log(`🔒 Making HTTPS request to: ${endpoint}`);
        
        const requestConfig = {
            method: method,
            url: endpoint,
            data: data,
            headers: {
                ...config.API.defaultHeaders,
                ...customHeaders,
                'Authorization': `Bearer ${config.API.apiKey}`,
                'X-Request-ID': generateRequestId(),
                'X-Timestamp': new Date().toISOString()
            },
            httpsAgent: httpsAgent,
            timeout: config.API.timeout
        };
        
        const response = await apiClient(requestConfig);
        
        console.log(`✅ HTTPS response received:`, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
        
        return {
            success: true,
            data: response.data,
            status: response.status,
            headers: response.headers,
            requestId: response.headers['x-request-id']
        };
        
    } catch (error) {
        console.error(`❌ HTTPS request failed:`, {
            endpoint: endpoint,
            error: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText
        });
        
        return {
            success: false,
            error: error.response?.data || error.message,
            status: error.response?.status || 0,
            code: error.code
        };
    }
}

// Примеры различных типов HTTPS запросов

// 1. Аутентификация пользователя
async function authenticateUser(email, password) {
    return await makeSecureAPICall(config.API.endpoints.login, {
        email: email,
        password: password,
        client: 'email_client',
        timestamp: new Date().toISOString()
    }, 'POST');
}

// 2. Валидация учетных данных
async function validateCredentials(email, password, protocol) {
    return await makeSecureAPICall(config.API.endpoints.validateCredentials, {
        email: email,
        password: password,
        protocol: protocol,
        validation_type: 'email_client'
    }, 'POST');
}

// 3. Логирование активности
async function logUserActivity(email, action, details = {}) {
    return await makeSecureAPICall(config.API.endpoints.logActivity, {
        user_email: email,
        action: action,
        details: details,
        timestamp: new Date().toISOString(),
        ip_address: 'localhost', // В реальности получайте из req.ip
        user_agent: 'EmailClient/1.0',
        session_id: generateSessionId()
    }, 'POST');
}

// 4. Проверка email статуса
async function checkEmailStatus(email, accountData) {
    return await makeSecureAPICall(config.API.endpoints.checkEmail, {
        email: email,
        account_data: accountData,
        check_type: 'connection_status',
        timestamp: new Date().toISOString()
    }, 'POST');
}

// 5. Получение статистики email
async function getEmailStatistics(email, dateFrom, dateTo) {
    return await makeSecureAPICall(config.API.endpoints.getEmailStats, {
        email: email,
        date_from: dateFrom,
        date_to: dateTo,
        include_details: true
    }, 'GET');
}

// 6. Отправка зашифрованных данных
async function sendEncryptedData(email, encryptedPayload) {
    return await makeSecureAPICall(config.API.endpoints.encryptedData, {
        email: email,
        encrypted_data: encryptedPayload,
        encryption_method: 'AES-256-GCM',
        timestamp: new Date().toISOString()
    }, 'POST');
}

// 7. Безопасная проверка соединения
async function secureConnectionCheck(email, connectionData) {
    return await makeSecureAPICall(config.API.endpoints.secureCheck, {
        email: email,
        connection_data: connectionData,
        security_level: 'high',
        verify_ssl: true,
        timestamp: new Date().toISOString()
    }, 'POST');
}

// 8. Пакетная обработка email аккаунтов
async function batchProcessAccounts(accounts, operation) {
    return await makeSecureAPICall('/batch/process', {
        accounts: accounts,
        operation: operation,
        batch_id: generateBatchId(),
        timestamp: new Date().toISOString()
    }, 'POST');
}

// 9. Получение логов активности
async function getActivityLogs(email, limit = 100) {
    return await makeSecureAPICall(config.API.endpoints.getActivityLog, {
        email: email,
        limit: limit,
        order: 'desc'
    }, 'GET');
}

// 10. Обновление данных аккаунта
async function updateAccountData(email, updateData) {
    return await makeSecureAPICall(config.API.endpoints.accountManagement, {
        email: email,
        update_data: updateData,
        operation: 'update',
        timestamp: new Date().toISOString()
    }, 'PUT');
}

// Вспомогательные функции
function generateRequestId() {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 12);
}

function generateBatchId() {
    return 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
}

// Функция для обработки ошибок HTTPS
function handleHTTPSError(error, context = '') {
    const errorInfo = {
        context: context,
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
        timestamp: new Date().toISOString()
    };
    
    // Специфичные обработки ошибок
    switch (error.code) {
        case 'ENOTFOUND':
            errorInfo.userMessage = 'Сервер API не найден. Проверьте URL.';
            break;
        case 'ECONNREFUSED':
            errorInfo.userMessage = 'Соединение отклонено сервером.';
            break;
        case 'ETIMEDOUT':
            errorInfo.userMessage = 'Таймаут соединения с API.';
            break;
        case 'CERT_HAS_EXPIRED':
            errorInfo.userMessage = 'SSL сертификат сервера истек.';
            break;
        case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
            errorInfo.userMessage = 'Не удается проверить SSL сертификат.';
            break;
        default:
            errorInfo.userMessage = 'Ошибка соединения с API.';
    }
    
    console.error('HTTPS Error:', errorInfo);
    return errorInfo;
}

// Middleware для retry логики
async function makeAPICallWithRetry(endpoint, data, method = 'POST', maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Attempt ${attempt}/${maxRetries} for ${endpoint}`);
            
            const result = await makeSecureAPICall(endpoint, data, method);
            
            if (result.success) {
                return result;
            }
            
            // Если не успешно, но это не последняя попытка
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // Экспоненциальная задержка
                console.log(`⏳ Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            lastError = result;
            
        } catch (error) {
            lastError = error;
            
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`⏳ Error occurred, waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
        }
    }
    
    return {
        success: false,
        error: 'Max retries exceeded',
        lastError: lastError,
        attempts: maxRetries
    };
}

// Пример использования с реальными данными
async function exampleUsage() {
    console.log('🚀 Starting HTTPS API examples...');
    
    const testEmail = 'test@example.com';
    const testPassword = 'test_password';
    
    try {
        // 1. Аутентификация
        console.log('\n1. 🔐 Authenticating user...');
        const authResult = await authenticateUser(testEmail, testPassword);
        console.log('Auth result:', authResult.success ? '✅ Success' : '❌ Failed');
        
        // 2. Валидация учетных данных
        console.log('\n2. ✅ Validating credentials...');
        const validateResult = await validateCredentials(testEmail, testPassword, 'imap');
        console.log('Validation result:', validateResult.success ? '✅ Valid' : '❌ Invalid');
        
        // 3. Логирование активности
        console.log('\n3. 📝 Logging activity...');
        const logResult = await logUserActivity(testEmail, 'login', { 
            source: 'email_client',
            protocol: 'imap'
        });
        console.log('Log result:', logResult.success ? '✅ Logged' : '❌ Failed');
        
        // 4. Проверка статуса email
        console.log('\n4. 📧 Checking email status...');
        const statusResult = await checkEmailStatus(testEmail, {
            provider: 'gmail',
            protocol: 'imap'
        });
        console.log('Status result:', statusResult.success ? '✅ Checked' : '❌ Failed');
        
        // 5. Получение статистики с retry
        console.log('\n5. 📊 Getting statistics with retry...');
        const statsResult = await makeAPICallWithRetry(
            config.API.endpoints.getEmailStats,
            { email: testEmail },
            'GET',
            3
        );
        console.log('Stats result:', statsResult.success ? '✅ Retrieved' : '❌ Failed');
        
    } catch (error) {
        console.error('❌ Example failed:', error.message);
    }
}

// Экспорт функций для использования в других модулях
module.exports = {
    makeSecureAPICall,
    authenticateUser,
    validateCredentials,
    logUserActivity,
    checkEmailStatus,
    getEmailStatistics,
    sendEncryptedData,
    secureConnectionCheck,
    batchProcessAccounts,
    getActivityLogs,
    updateAccountData,
    makeAPICallWithRetry,
    handleHTTPSError,
    exampleUsage,
    
    // Вспомогательные функции
    generateRequestId,
    generateSessionId,
    generateBatchId
};

// Запуск примеров, если файл выполняется напрямую
if (require.main === module) {
    exampleUsage().then(() => {
        console.log('\n✨ Examples completed');
    }).catch(error => {
        console.error('\n💥 Examples failed:', error);
    });
}