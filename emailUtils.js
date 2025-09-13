const Imap = require('imap');
const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const POP3 = require('poplib');
const logger = require('./logger');
const config = require('./config');

// Убедитесь, что у вас установлен poplib: npm install poplib

/**
 * Тестирует IMAP-соединение.
 */
function testImapConnection({ email, password, imapHost, imapPort }) {
    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user: email,
            password: password,
            host: imapHost,
            port: imapPort,
            tls: true,
            tlsOptions: { rejectUnauthorized: config.HTTPS ? config.HTTPS.rejectUnauthorized : false },
            connTimeout: config.EMAIL.imap.connectionTimeout,
            authTimeout: config.EMAIL.imap.authTimeout
        });
        
        imap.once('ready', () => {
            imap.end();
            resolve(true);
        });
        
        imap.once('error', (err) => {
            reject(err);
        });
        
        imap.connect();
    });
}

/**
 * Тестирует SMTP-соединение.
 */
function testSmtpConnection({ email, password, smtpHost, smtpPort }) {
    return new Promise((resolve, reject) => {
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
                user: email,
                pass: password
            },
            tls: { rejectUnauthorized: config.HTTPS ? config.HTTPS.rejectUnauthorized : false }
        });
        
        transporter.verify((error, success) => {
            if (error) {
                reject(error);
            } else {
                resolve(success);
            }
        });
    });
}

/**
 * Тестирует POP3-соединение.
 */
function testPop3Connection({ email, password, pop3Host, pop3Port }) {
    return new Promise((resolve, reject) => {
        const client = new POP3(pop3Host, pop3Port, { tls: true, strictSSL: false });
        
        client.on('error', (err) => {
            client.quit();
            reject(new Error(`POP3 connection error: ${err.message}`));
        });

        client.on('connect', () => {
            client.login(email, password, (err) => {
                if (err) {
                    client.quit();
                    reject(new Error(`POP3 login failed: ${err.message}`));
                } else {
                    client.quit();
                    resolve(true);
                }
            });
        });

        client.connect();
    });
}

/**
 * Получает письма через IMAP.
 */
function fetchImapEmails({ email, password, imapHost, imapPort, folder, count }) {
    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user: email,
            password: password,
            host: imapHost,
            port: imapPort,
            tls: true,
            tlsOptions: { rejectUnauthorized: config.HTTPS ? config.HTTPS.rejectUnauthorized : false }
        });
        
        const emails = [];
        
        imap.once('ready', () => {
            imap.openBox(folder, true, (err, box) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (box.messages.total === 0) {
                    resolve([]);
                    imap.end();
                    return;
                }
                
                const fetchCount = Math.min(count, box.messages.total);
                const start = Math.max(1, box.messages.total - fetchCount + 1);
                const end = box.messages.total;
                
                const fetch = imap.seq.fetch(`${start}:${end}`, {
                    bodies: '',
                    struct: true
                });
                
                fetch.on('message', (msg) => {
                    const emailData = {};
                    
                    msg.on('body', (stream) => {
                        simpleParser(stream, (err, parsed) => {
                            if (err) {
                                logger.error(`Ошибка разбора письма: ${err.message}`);
                                return;
                            }
                            emailData.from = parsed.from ? parsed.from.text : 'Неизвестно';
                            emailData.to = parsed.to ? parsed.to.text : 'Неизвестно';
                            emailData.subject = parsed.subject || 'Без темы';
                            emailData.date = parsed.date ? new Date(parsed.date).toLocaleString('ru-RU') : 'Неизвестно';
                            emailData.body = parsed.html || parsed.text;
                        });
                    });
                    
                    msg.once('attributes', (attrs) => {
                        emailData.unread = !attrs.flags.includes('\\Seen');
                        emailData.uid = attrs.uid;
                        emails.push(emailData);
                    });
                });
                
                fetch.once('error', (err) => {
                    reject(err);
                });
                
                fetch.once('end', () => {
                    imap.end();
                    emails.sort((a, b) => new Date(b.date) - new Date(a.date));
                    resolve(emails);
                });
            });
        });
        
        imap.once('error', (err) => {
            reject(err);
        });
        
        imap.connect();
    });
}

/**
 * Получает письма через POP3.
 */
function fetchPop3Emails({ email, password, pop3Host, pop3Port, count }) {
    return new Promise((resolve, reject) => {
        const client = new POP3(pop3Host, pop3Port, { tls: true, strictSSL: false });
        const emails = [];
        
        client.on('error', (err) => {
            client.quit();
            reject(new Error(`POP3 connection error: ${err.message}`));
        });

        client.on('connect', () => {
            client.login(email, password, (err) => {
                if (err) {
                    client.quit();
                    reject(new Error(`POP3 login failed: ${err.message}`));
                } else {
                    client.stat((err, msgCount) => {
                        if (err) {
                            client.quit();
                            return reject(new Error(`POP3 stat failed: ${err.message}`));
                        }
                        
                        const fetchCount = Math.min(msgCount, count);
                        if (fetchCount === 0) {
                            client.quit();
                            return resolve([]);
                        }

                        let fetched = 0;
                        for (let i = 1; i <= fetchCount; i++) {
                            client.retr(i, (err, data) => {
                                if (err) {
                                    logger.error(`Ошибка POP3 RETR: ${err.message}`);
                                    fetched++;
                                } else {
                                    simpleParser(data, (err, parsed) => {
                                        if (err) {
                                            logger.error(`Ошибка разбора письма: ${err.message}`);
                                            return;
                                        }
                                        emails.push({
                                            id: i,
                                            from: parsed.from ? parsed.from.text : 'Неизвестно',
                                            subject: parsed.subject || 'Без темы',
                                            date: parsed.date ? new Date(parsed.date).toLocaleString('ru-RU') : 'Неизвестно',
                                            body: parsed.html || parsed.text,
                                        });
                                        fetched++;
                                        if (fetched === fetchCount) {
                                            client.quit();
                                            resolve(emails);
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        });
        
        client.connect();
    });
}

/**
 * Отправляет письмо через SMTP.
 */
function sendEmail({ from, password, smtpHost, smtpPort, to, subject, text }) {
    return new Promise((resolve, reject) => {
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
                user: from,
                pass: password
            },
            tls: { rejectUnauthorized: config.HTTPS ? config.HTTPS.rejectUnauthorized : false }
        });
        
        const mailOptions = {
            from: from,
            to: to,
            subject: subject,
            text: text,
            html: text.replace(/\n/g, '<br>')
        };
        
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                reject(error);
            } else {
                resolve(info);
            }
        });
    });
}

/**
 * Помечает письма как прочитанные (только для IMAP).
 */
function markAsRead({ email, password, imapHost, imapPort, messageIds }) {
    // В POP3 нет концепции "прочитано", так как письма обычно удаляются с сервера после загрузки.
    // Поэтому эта функция работает только для IMAP.
    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user: email,
            password: password,
            host: imapHost,
            port: imapPort,
            tls: true,
            tlsOptions: { rejectUnauthorized: config.HTTPS ? config.HTTPS.rejectUnauthorized : false }
        });
        
        imap.once('ready', () => {
            imap.openBox('INBOX', false, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Используем uid, а не seqno, для более надежной работы
                imap.addFlags(messageIds, '\\Seen', (err) => {
                    imap.end();
                    if (err) {
                        reject(err);
                    } else {
                        resolve(true);
                    }
                });
            });
        });
        
        imap.once('error', (err) => {
            reject(err);
        });
        
        imap.connect();
    });
}

/**
 * Получает список папок (только для IMAP).
 */
function getFolders({ email, password, imapHost, imapPort }) {
    // POP3 не поддерживает папки.
    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user: email,
            password: password,
            host: imapHost,
            port: imapPort,
            tls: true,
            tlsOptions: { rejectUnauthorized: config.HTTPS ? config.HTTPS.rejectUnauthorized : false }
        });
        
        imap.once('ready', () => {
            imap.getBoxes((err, boxes) => {
                imap.end();
                if (err) {
                    reject(err);
                } else {
                    const folderList = extractFolderNames(boxes);
                    resolve(folderList);
                }
            });
        });
        
        imap.once('error', (err) => {
            reject(err);
        });
        
        imap.connect();
    });
}

function extractFolderNames(boxes, prefix = '') {
    const folders = [];
    for (const name in boxes) {
        const fullName = prefix + name;
        folders.push({
            name: fullName,
            delimiter: boxes[name].delimiter,
            children: boxes[name].children
        });
        
        if (boxes[name].children) {
            folders.push(...extractFolderNames(boxes[name].children, fullName + boxes[name].delimiter));
        }
    }
    return folders;
}

// Экспортируем все функции, которые будут использоваться в
module.exports = {
    testImapConnection,
    testSmtpConnection,
    testPop3Connection,
    fetchImapEmails,
    fetchPop3Emails,
    sendEmail,
    markAsRead,
    getFolders
};
