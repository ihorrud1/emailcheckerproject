const express = require('express');
const Imap = require('imap');
const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Serve HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Custom API call endpoint
app.post('/api/custom-api-call', async (req, res) => {
    const { email, action, accountData, timestamp } = req.body;
    
    try {
        // Call your custom API
        const apiResult = await callYourAPI('/custom/endpoint', {
            email,
            action,
            data: accountData,
            timestamp,
            source: 'email_client'
        });
        
        // Log the API call
        await logActivity('custom_api_call', email, { 
            action, 
            success: apiResult.success,
            timestamp 
        });
        
        res.json({
            success: apiResult.success,
            data: apiResult.data,
            error: apiResult.error,
            apiCalled: true
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            apiCalled: false
        });
    }
});

// Test IMAP/SMTP connection
app.post('/api/test-connection', async (req, res) => {
    const { email, password, imapHost, imapPort, smtpHost, smtpPort } = req.body;
    
    let imapResult = false;
    let smtpResult = false;
    let errors = [];
    
    // Test IMAP connection
    try {
        await testImapConnection({ email, password, imapHost, imapPort });
        imapResult = true;
    } catch (error) {
        errors.push(`IMAP: ${error.message}`);
    }
    
    // Test SMTP connection
    try {
        await testSmtpConnection({ email, password, smtpHost, smtpPort });
        smtpResult = true;
    } catch (error) {
        errors.push(`SMTP: ${error.message}`);
    }
    
    res.json({
        success: imapResult && smtpResult,
        imap: imapResult,
        smtp: smtpResult,
        error: errors.length > 0 ? errors.join(', ') : null
    });
});

// Fetch emails via IMAP
app.post('/api/fetch-emails', async (req, res) => {
    const { email, password, imapHost, imapPort, folder = 'INBOX', count = 10 } = req.body;
    
    try {
        const emails = await fetchEmails({
            email,
            password,
            imapHost,
            imapPort,
            folder,
            count
        });
        
        res.json({
            success: true,
            emails: emails,
            count: emails.length
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Send email via SMTP
app.post('/api/send-email', async (req, res) => {
    const { email, password, smtpHost, smtpPort, to, subject, text } = req.body;
    
    try {
        await sendEmail({
            from: email,
            password,
            smtpHost,
            smtpPort,
            to,
            subject,
            text
        });
        
        res.json({
            success: true,
            message: 'Email sent successfully'
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Mark emails as read
app.post('/api/mark-read', async (req, res) => {
    const { email, password, imapHost, imapPort, messageIds } = req.body;
    
    try {
        await markAsRead({
            email,
            password,
            imapHost,
            imapPort,
            messageIds
        });
        
        res.json({
            success: true,
            message: 'Messages marked as read'
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Get folder list
app.post('/api/get-folders', async (req, res) => {
    const { email, password, imapHost, imapPort } = req.body;
    
    try {
        const folders = await getFolders({
            email,
            password,
            imapHost,
            imapPort
        });
        
        res.json({
            success: true,
            folders: folders
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// IMAP Helper Functions
function testImapConnection({ email, password, imapHost, imapPort }) {
    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user: email,
            password: password,
            host: imapHost,
            port: imapPort,
            tls: true,
            tlsOptions: {
                rejectUnauthorized: false
            },
            connTimeout: 10000,
            authTimeout: 10000
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
        const transporter = nodemailer.createTransporter({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
                user: email,
                pass: password
            },
            tls: {
                rejectUnauthorized: false
            }
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
            tlsOptions: {
                rejectUnauthorized: false
            }
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
                    bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
                    struct: true
                });
                
                fetch.on('message', (msg, seqno) => {
                    const email = { seqno };
                    
                    msg.on('body', (stream, info) => {
                        let buffer = '';
                        stream.on('data', (chunk) => {
                            buffer += chunk.toString('utf8');
                        });
                        stream.once('end', () => {
                            const header = Imap.parseHeader(buffer);
                            email.from = header.from ? header.from[0] : 'Неизвестно';
                            email.to = header.to ? header.to[0] : email;
                            email.subject = header.subject ? header.subject[0] : 'Без темы';
                            email.date = header.date ? new Date(header.date[0]).toLocaleString('ru-RU') : 'Неизвестно';
                            email.protocol = 'IMAP';
                        });
                    });
                    
                    msg.once('attributes', (attrs) => {
                        email.unread = !attrs.flags.includes('\\Seen');
                        email.uid = attrs.uid;
                        email.flags = attrs.flags;
                    });
                    
                    msg.once('end', () => {
                        emails.push(email);
                    });
                });
                
                fetch.once('error', (err) => {
                    reject(err);
                });
                
                fetch.once('end', () => {
                    imap.end();
                    // Сортируем по дате (новые первыми)
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
        const transporter = nodemailer.createTransporter({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
                user: from,
                pass: password
            },
            tls: {
                rejectUnauthorized: false
            }
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
            tlsOptions: {
                rejectUnauthorized: false
            }
        });
        
        imap.once('ready', () => {
            imap.openBox('INBOX', false, (err, box) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Mark messages as read
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
            tlsOptions: {
                rejectUnauthorized: false
            }
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

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╭─────────────────────────────────────────╮
│           📧 Email Client Server        │
│                                         │
│  Server running on: http://localhost:${PORT}  │
│                                         │
│  Features:                              │
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
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Server shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nServer shutting down gracefully...');
    process.exit(0);
});