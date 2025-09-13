// apiClient.js
const axios = require('axios');
const config = require('./config');

const API = axios.create({
    baseURL: config.API.baseURL,
    timeout: config.API.timeout,
    headers: {
        ...config.API.defaultHeaders,
        'X-API-Key': config.API.apiKey
    }
});

async function logActivity(action, data) {
    if (!config.LOGGING.logToAPI) {
        return;
    }

    if (!config.LOGGING.logEvents.includes(action)) {
        return;
    }

    try {
        const payload = {
            action,
            data: {
                ...data,
                timestamp: new Date().toISOString()
            }
        };
        await API.post(config.API.endpoints.logActivity, payload);
    } catch (error) {
        console.error('Ошибка при отправке лога в API:', error.message);
    }
}

async function callCustomApi(payload) {
    try {
        const response = await API.post(config.API.endpoints.customEndpoint, payload);
        return response.data;
    } catch (error) {
        console.error('Ошибка при вызове пользовательского API:', error.message);
        throw new Error('Ошибка при вызове внешнего API.');
    }
}

module.exports = {
    logActivity,
    callCustomApi
};