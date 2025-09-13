// emailProviders.js
const config = require('./config');

const providers = config.PROVIDERS;

function getProviderSettings(email) {
    const domain = email.split('@')[1].toLowerCase();
    const providerKey = Object.keys(providers).find(key => {
        const provider = providers[key];
        return provider.imap && provider.imap.host.includes(domain);
    });

    if (providerKey) {
        return providers[providerKey];
    }

    return null;
}

module.exports = {
    getProviderSettings
};