import { jsonResponse, MAX_EMAILS } from './base.js';

export class InboxDB {
    constructor(state) {
        this.sql = state.storage.sql;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS emails (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                received_at TEXT NOT NULL,
                email_to TEXT NOT NULL,
                email_from TEXT,
                subject TEXT,
                text TEXT,
                html TEXT,
                date TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_received_at ON emails(received_at DESC);
            CREATE INDEX IF NOT EXISTS idx_email_to ON emails(email_to);
        `);
        this.initialized = true;
    }

    async fetch(request) {
        const { pathname, searchParams } = new URL(request.url);
        const method = request.method;
        await this.init();

        if (pathname === '/inbox') {
            if (method === 'POST') return this.addEmail(request);
            if (method === 'GET') return this.getEmails(searchParams);
            if (method === 'DELETE') return this.deleteEmails(searchParams);
        }

        if (pathname === '/inbox/by-recipients' && method === 'POST') {
            return this.getEmailsByRecipients(request);
        }

        if (pathname === '/email' && method === 'DELETE') {
            return this.deleteEmailById(searchParams);
        }

        return new Response('Not found', { status: 404 });
    }

    async addEmail(request) {
        const data = await request.json();
        const receivedAt = new Date().toISOString();

        const result = this.sql.exec(
            `INSERT INTO emails (received_at, email_to, email_from, subject, text, html, date)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            receivedAt,
            data.to || '',
            JSON.stringify(data.from || {}),
            data.subject || '',
            data.text || '',
            data.html || '',
            data.date || receivedAt
        );

        const { count } = this.sql.exec(`SELECT COUNT(*) as count FROM emails`).one();
        if (count > MAX_EMAILS) {
            this.sql.exec(
                `DELETE FROM emails WHERE id IN (
                    SELECT id FROM emails ORDER BY received_at ASC LIMIT ?
                )`, count - MAX_EMAILS
            );
        }

        return jsonResponse({ success: true, id: result.lastRowId });
    }

    getEmails(params) {
        const limit = parseInt(params.get('limit') || '10');
        const offset = parseInt(params.get('offset') || '0');
        const emailTo = params.get('email_to');

        const query = emailTo
            ? `SELECT * FROM emails WHERE email_to = ? ORDER BY received_at DESC LIMIT ? OFFSET ?`
            : `SELECT * FROM emails ORDER BY received_at DESC LIMIT ? OFFSET ?`;

        const args = emailTo ? [emailTo, limit, offset] : [limit, offset];
        const emails = this.sql.exec(query, ...args).toArray().map(row => ({
            id: row.id,
            receivedAt: row.received_at,
            to: row.email_to,
            from: JSON.parse(row.email_from || '{}'),
            subject: row.subject,
            text: row.text,
            html: row.html,
            date: row.date
        }));

        // Get total count for pagination
        const totalQuery = emailTo
            ? `SELECT COUNT(*) as total FROM emails WHERE email_to = ?`
            : `SELECT COUNT(*) as total FROM emails`;
        const totalArgs = emailTo ? [emailTo] : [];
        const { total } = this.sql.exec(totalQuery, ...totalArgs).one();

        return jsonResponse({ count: emails.length, total, emails });
    }

    deleteEmails(params) {
        const emailTo = params.get('email_to');
        this.sql.exec(
            emailTo ? `DELETE FROM emails WHERE email_to = ?` : `DELETE FROM emails`,
            ...(emailTo ? [emailTo] : [])
        );
        return jsonResponse({ success: true });
    }

    deleteEmailById(params) {
        const id = params.get('id');
        if (!id) return jsonResponse({ error: 'Email ID required' }, 400);
        this.sql.exec(`DELETE FROM emails WHERE id = ?`, parseInt(id));
        return jsonResponse({ success: true });
    }

    async getEmailsByRecipients(request) {
        const { emailAddresses, limit, offset } = await request.json();

        if (!emailAddresses || emailAddresses.length === 0) {
            return jsonResponse({ count: 0, total: 0, emails: [] });
        }

        const finalLimit = parseInt(limit || '100');
        const finalOffset = parseInt(offset || '0');

        // Create placeholders for SQL IN clause
        const placeholders = emailAddresses.map(() => '?').join(',');

        // Query emails matching any of the recipient addresses
        const query = `SELECT * FROM emails 
                       WHERE email_to IN (${placeholders}) 
                       ORDER BY received_at DESC 
                       LIMIT ? OFFSET ?`;

        const emails = this.sql.exec(query, ...emailAddresses, finalLimit, finalOffset)
            .toArray()
            .map(row => ({
                id: row.id,
                receivedAt: row.received_at,
                to: row.email_to,
                from: JSON.parse(row.email_from || '{}'),
                subject: row.subject,
                text: row.text,
                html: row.html,
                date: row.date
            }));

        // Get total count for pagination
        const countQuery = `SELECT COUNT(*) as total FROM emails WHERE email_to IN (${placeholders})`;
        const { total } = this.sql.exec(countQuery, ...emailAddresses).one();

        return jsonResponse({ count: emails.length, total, emails });
    }
}
