// emailProviders.js — Автоматическое определение провайдера по email

const config = require('./config');

function getDomain(email) {
    return (email || '').toLowerCase().split('@')[1] || '';
}

function getProviderSettings(email) {
    const domain = getDomain(email);
    // Поддержка alias- и поддоменов, например, yandex.ua, mail.ua, gmx.net и др.
    if (domain.endsWith('gmail.com')) return config.PROVIDERS.gmail;
    if (domain.endsWith('yandex.ru') || domain.endsWith('yandex.com') || domain.endsWith('yandex.ua')) return config.PROVIDERS.yandex;
    if (domain.endsWith('mail.ru') || domain.endsWith('inbox.ru') || domain.endsWith('bk.ru') || domain.endsWith('list.ru')) return config.PROVIDERS.mailru;
    if (domain.endsWith('gmx.com') || domain.endsWith('gmx.net')) return config.PROVIDERS.gmx;
    if (domain.endsWith('zoho.com') || domain.endsWith('zoho.eu')) return config.PROVIDERS.zoho;
    if (domain.endsWith('yahoo.com') || domain.endsWith('yahoo.co.uk')) return config.PROVIDERS.yahoo;
    if (
        domain.endsWith('outlook.com') ||
        domain.endsWith('hotmail.com') ||
        domain.endsWith('live.com') ||
        domain.endsWith('office365.com')
    ) return config.PROVIDERS.outlook;
    // по умолчанию — кастомный сервер
    return config.PROVIDERS.custom;
}

module.exports = { getProviderSettings };
