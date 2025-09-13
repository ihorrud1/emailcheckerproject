const express = require('express');
const { body, validationResult } = require('express-validator');
const path = require('path');
const logger = require('./logger');
const { getProviderSettings } = require('./emailProviders');
const { testImapConnection, testSmtpConnection, fetchEmails, sendEmail, markAsRead, getFolders } = require('./emailUtils');
const { callCustomApi, logActivity } = require('./apiClient');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/custom-api-call', [
    body('email').isEmail().withMessage('Некорректный email'),
    body('action').notEmpty().withMessage('Отсутствует действие'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn(`Ошибка валидации при вызове API: ${JSON.stringify(errors.array())}`);
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, action, accountData } = req.body;
    logger.info(`Пользователь ${email} вызывает API с действием: ${action}`);

    try {
        const apiResult = await callCustomApi({ email, action, data: accountData });
        await logActivity('custom_api_call', { email, action, success: true });
        res.json({ success: true, data: apiResult, message: 'Вызов API успешно обработан' });
    } catch (error) {
        logger.error(`Ошибка при вызове внешнего API для ${email}: ${error.message}`);
        await logActivity('custom_api_call', { email, action, success: false, error: error.message });
        res.status(500).json({ success: false, error: 'Ошибка при вызове внешнего API.' });
    }
});

app.post('/api/test-connection', [
    body('email').isEmail().withMessage('Некорректиный email'),
    body('password').notEmpty().withMessage('Пароль не может быть пустым'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn(`Ошибка валидации при тестировании подключения: ${JSON.stringify(errors.array())}`);
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password, imapHost, imapPort, smtpHost, smtpPort } = req.body;
    let errs = [];

    const providerSettings = getProviderSettings(email);
    const finalImapHost = providerSettings ? providerSettings.imap.host : imapHost;
    const finalImapPort = providerSettings ? providerSettings.imap.port : imapPort;
    const finalSmtpHost = providerSettings ? providerSettings.smtp.host : smtpHost;
    const finalSmtpPort = providerSettings ? providerSettings.smtp.port : smtpPort;

    if (!finalImapHost || !finalSmtpHost) {
        logger.error(`Не удалось определить настройки для ${email}.`);
        return res.json({ success: false, error: 'Не удалось определить настройки сервера. Пожалуйста, укажите хост и порт вручную.' });
    }

    let imapResult = false;
    let smtpResult = false;

    try {
        await testImapConnection({ email, password, imapHost: finalImapHost, imapPort: finalImapPort });
        imapResult = true;
    } catch (error) {
        errs.push(`IMAP: ${error.message}`);
        logger.error(`Ошибка IMAP для ${email}: ${error.message}`);
    }

    try {
        await testSmtpConnection({ email, password, smtpHost: finalSmtpHost, smtpPort: finalSmtpPort });
        smtpResult = true;
    } catch (error) {
        errs.push(`SMTP: ${error.message}`);
        logger.error(`Ошибка SMTP для ${email}: ${error.message}`);
    }

    if (imapResult && smtpResult) {
        logger.info(`Подключение для ${email} успешно протестировано.`);
        await logActivity('connection_test_success', { email, imap: true, smtp: true });
    } else {
        await logActivity('connection_test_failed', { email, imap: imapResult, smtp: smtpResult, errors: errs.join(', ') });
    }

    res.json({
        success: imapResult && smtpResult,
        imap: imapResult,
        smtp: smtpResult,
        error: errs.length > 0 ? errs.join(', ') : null
    });
});

app.post('/api/fetch-emails', [
    body('email').isEmail().withMessage('Некорректный email'),
    body('password').notEmpty().withMessage('Пароль не может быть пустым'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn(`Ошибка валидации при получении писем: ${JSON.stringify(errors.array())}`);
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password, imapHost, imapPort, folder = 'INBOX', count = 10 } = req.body;
    logger.info(`Пользователь ${email} пытается получить письма из папки "${folder}".`);
    
    const providerSettings = getProviderSettings(email);
    const finalImapHost = providerSettings ? providerSettings.imap.host : imapHost;
    const finalImapPort = providerSettings ? providerSettings.imap.port : imapPort;

    if (!finalImapHost) {
        logger.error(`Не удалось определить настройки IMAP для ${email}.`);
        return res.json({ success: false, error: 'Не удалось определить настройки IMAP сервера.' });
    }

    try {
        const emails = await fetchEmails({ email, password, imapHost: finalImapHost, imapPort: finalImapPort, folder, count });
        logger.info(`Получено ${emails.length} писем для ${email}.`);
        await logActivity('emails_fetched', { email, folder, count: emails.length });
        res.json({ success: true, emails: emails, count: emails.length });
    } catch (error) {
        logger.error(`Ошибка при получении писем для ${email}: ${error.message}`);
        await logActivity('emails_fetch_failed', { email, folder, error: error.message });
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/send-email', [
    body('email').isEmail().withMessage('Некорректный email отправителя'),
    body('password').notEmpty().withMessage('Пароль не может быть пустым'),
    body('to').isEmail().withMessage('Некорректный email получателя'),
    body('subject').notEmpty().withMessage('Тема не может быть пустой'),
    body('text').notEmpty().withMessage('Тело письма не может быть пустым'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn(`Ошибка валидации при отправке письма: ${JSON.stringify(errors.array())}`);
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password, smtpHost, smtpPort, to, subject, text } = req.body;
    logger.info(`Пользователь ${email} пытается отправить письмо на ${to} с темой "${subject}".`);

    const providerSettings = getProviderSettings(email);
    const finalSmtpHost = providerSettings ? providerSettings.smtp.host : smtpHost;
    const finalSmtpPort = providerSettings ? providerSettings.smtp.port : smtpPort;

    if (!finalSmtpHost) {
        logger.error(`Не удалось определить настройки SMTP для ${email}.`);
        return res.json({ success: false, error: 'Не удалось определить настройки SMTP сервера.' });
    }

    try {
        await sendEmail({ from: email, password, smtpHost: finalSmtpHost, smtpPort: finalSmtpPort, to, subject, text });
        logger.info(`Письмо от ${email} на ${to} успешно отправлено.`);
        await logActivity('email_sent_success', { email, to, subject });
        res.json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        logger.error(`Ошибка при отправке письма от ${email}: ${error.message}`);
        await logActivity('email_sent_failed', { email, to, subject, error: error.message });
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/mark-read', [
    body('email').isEmail().withMessage('Некорректный email'),
    body('password').notEmpty().withMessage('Пароль не может быть пустым'),
    body('messageIds').isArray().withMessage('messageIds должен быть массивом'),
    body('messageIds.*').isInt().withMessage('messageIds должны быть числами'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn(`Ошибка валидации при пометке писем как прочитанных: ${JSON.stringify(errors.array())}`);
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password, imapHost, imapPort, messageIds } = req.body;
    logger.info(`Пользователь ${email} помечает ${messageIds.length} писем как прочитанные.`);

    const providerSettings = getProviderSettings(email);
    const finalImapHost = providerSettings ? providerSettings.imap.host : imapHost;
    const finalImapPort = providerSettings ? providerSettings.imap.port : imapPort;

    if (!finalImapHost) {
        logger.error(`Не удалось определить настройки IMAP для ${email}.`);
        return res.json({ success: false, error: 'Не удалось определить настройки IMAP сервера.' });
    }

    try {
        await markAsRead({ email, password, imapHost: finalImapHost, imapPort: finalImapPort, messageIds });
        logger.info(`Письма для ${email} успешно помечены как прочитанные.`);
        await logActivity('emails_marked_read', { email, count: messageIds.length });
        res.json({ success: true, message: 'Messages marked as read' });
    } catch (error) {
        logger.error(`Ошибка при пометке писем как прочитанных для ${email}: ${error.message}`);
        await logActivity('emails_mark_read_failed', { email, count: messageIds.length, error: error.message });
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/get-folders', [
    body('email').isEmail().withMessage('Некорректный email'),
    body('password').notEmpty().withMessage('Пароль не может быть пустым'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn(`Ошибка валидации при получении списка папок: ${JSON.stringify(errors.array())}`);
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password, imapHost, imapPort } = req.body;
    logger.info(`Пользователь ${email} запрашивает список папок.`);
    
    const providerSettings = getProviderSettings(email);
    const finalImapHost = providerSettings ? providerSettings.imap.host : imapHost;
    const finalImapPort = providerSettings ? providerSettings.imap.port : imapPort;

    if (!finalImapHost) {
        logger.error(`Не удалось определить настройки IMAP для ${email}.`);
        return res.json({ success: false, error: 'Не удалось определить настройки IMAP сервера.' });
    }

    try {
        const folders = await getFolders({ email, password, imapHost: finalImapHost, imapPort: finalImapPort });
        logger.info(`Получено ${folders.length} папок для ${email}.`);
        await logActivity('folders_fetched', { email, count: folders.length });
        res.json({ success: true, folders: folders });
    } catch (error) {
        logger.error(`Ошибка при получении папок для ${email}: ${error.message}`);
        await logActivity('folders_fetch_failed', { email, error: error.message });
        res.json({ success: false, error: error.message });
    }
});

app.use((err, req, res, next) => {
    logger.error(`Необработанная ошибка сервера: ${err.stack}`);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`
╭─────────────────────────────────────────╮
│         📧 Email Client Server         │
│                                         │
│  Server running on: http://localhost:${PORT}  │
│                                         │
│  Features:                             │
│  ✓ IMAP email fetching                  │
│  ✓ SMTP email sending                   │
│  ✓ Multiple account management          │
│  ✓ Connection testing                   │
│                                         │
│  Supported providers:                   │
│  • Gmail                                │
│  • Outlook/Hotmail                      │
│  • Yandex                               │
│  • Yahoo                                │
│  • Custom IMAP/SMTP servers             │
╰─────────────────────────────────────────╯
    `);
    logger.info(`Сервер запущен на порту ${PORT}.`);
});

process.on('SIGTERM', () => {
    logger.info('Сервер завершает работу...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('Сервер завершает работу...');
    process.exit(0);
});