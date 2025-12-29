import { jsonResponse } from './base.js';

export class RegistrationDB {
    constructor(state) {
        this.sql = state.storage.sql;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS registration (
                email TEXT PRIMARY KEY,
                owner TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_owner ON registration(owner);
        `);
        this.initialized = true;
    }

    async fetch(request) {
        const { pathname, searchParams } = new URL(request.url);
        const method = request.method;
        await this.init();

        if (pathname === '/register' && method === 'POST') {
            return this.register(request);
        }
        if (pathname === '/owner' && method === 'GET') {
            return this.getOwner(searchParams);
        }
        if (pathname === '/emails-by-owner' && method === 'GET') {
            return this.getEmailsByOwner(searchParams);
        }
        if (pathname === '/unregister' && method === 'DELETE') {
            return this.unregister(searchParams);
        }

        return new Response('Not found', { status: 404 });
    }

    async register(request) {
        const { email, owner } = await request.json();
        try {
            this.sql.exec(
                `INSERT INTO registration (email, owner, created_at) VALUES (?, ?, ?)`,
                email, owner, new Date().toISOString()
            );
            return jsonResponse({ success: true });
        } catch {
            return jsonResponse({ success: false, error: 'Email already registered' }, 409);
        }
    }

    getOwner(params) {
        const rows = this.sql.exec(
            `SELECT owner FROM registration WHERE email = ?`,
            params.get('email')
        ).toArray();
        return jsonResponse({ owner: rows[0]?.owner || null });
    }

    getEmailsByOwner(params) {
        const emails = this.sql.exec(
            `SELECT email FROM registration WHERE owner = ? ORDER BY created_at DESC`,
            params.get('owner')
        ).toArray().map(row => row.email);
        return jsonResponse({ emails });
    }

    unregister(params) {
        this.sql.exec(`DELETE FROM registration WHERE email = ?`, params.get('email'));
        return jsonResponse({ success: true });
    }
}
