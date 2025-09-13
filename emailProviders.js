// emailProviders.js
const config = require('./config');

const providers = config.PROVIDERS;

function getProviderSettings(email) {
    const domain = email.split('@')[1].toLowerCase();

    // Поиск провайдера по домену в списке известных
    const providerKey = Object.keys(providers).find(key => {
        const provider = providers[key];
        // Проверяем, содержит ли хост IMAP или POP3 домен в имени
        return (provider.imap && provider.imap.host.includes(domain)) ||
               (provider.pop3 && provider.pop3.host.includes(domain));
    });

    if (providerKey) {
        return providers[providerKey];
    }

    // Если провайдер не найден, возвращаем null
    return null;
}

module.exports = {
    getProviderSettings
};