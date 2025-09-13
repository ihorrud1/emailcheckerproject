const Imap = require('imap');
const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const logger = require('./logger');
const config = require('./config');

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

function fetchEmails({ email, password, imapHost, imapPort, folder, count }) {
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
                
                fetch.on('message', (msg, seqno) => {
                    let emailData = { seqno, from: 'Неизвестно', to: 'Неизвестно', subject: 'Без темы', date: 'Неизвестно' };
                    let bodyStream = null;
                    
                    msg.on('body', (stream) => {
                        bodyStream = stream;
                    });
                    
                    msg.once('attributes', (attrs) => {
                        emailData.unread = !attrs.flags.includes('\\Seen');
                        emailData.uid = attrs.uid;
                        emailData.flags = attrs.flags;
                    });
                    
                    msg.once('end', () => {
                        if (bodyStream) {
                            simpleParser(bodyStream, (err, parsed) => {
                                if (err) {
                                    logger.error(`Ошибка разбора письма: ${err.message}`);
                                    return;
                                }
                                emailData.from = parsed.from ? parsed.from.text : emailData.from;
                                emailData.to = parsed.to ? parsed.to.text : emailData.to;
                                emailData.subject = parsed.subject || emailData.subject;
                                emailData.date = parsed.date ? new Date(parsed.date).toLocaleString('ru-RU') : emailData.date;
                                emailData.body = parsed.html || parsed.text;
                                emailData.attachments = parsed.attachments;
                                emails.push(emailData);
                            });
                        } else {
                            emails.push(emailData);
                        }
                    });
                });
                
                fetch.once('error', (err) => {
                    reject(err);
                });
                
                fetch.once('end', () => {
                    imap.end();
                    emails.sort((a, b) => b.seqno - a.seqno);
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

function markAsRead({ email, password, imapHost, imapPort, messageIds }) {
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
            imap.openBox('INBOX', false, (err, box) => {
                if (err) {
                    reject(err);
                    return;
                }
                
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

function getFolders({ email, password, imapHost, imapPort }) {
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

module.exports = {
    testImapConnection,
    testSmtpConnection,
    fetchEmails,
    sendEmail,
    markAsRead,
    getFolders,
    extractFolderNames
};