import { jsonResponse } from './base.js';

export class UserDB {
    constructor(state) {
        this.sql = state.storage.sql;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                first_name TEXT,
                last_name TEXT,
                username TEXT,
                first_seen TEXT NOT NULL,
                last_seen TEXT NOT NULL
            );
        `);
        this.initialized = true;
    }

    async fetch(request) {
        const { pathname, searchParams } = new URL(request.url);
        const method = request.method;
        await this.init();

        if (pathname === '/upsert' && method === 'POST') return this.upsertUser(request);
        if (pathname === '/get' && method === 'GET') return this.getUser(searchParams);
        if (pathname === '/all' && method === 'GET') return this.getAllUsers();

        return new Response('Not found', { status: 404 });
    }

    async upsertUser(request) {
        const { userId, firstName, lastName, username } = await request.json();
        const now = new Date().toISOString();

        this.sql.exec(
            `INSERT INTO users (user_id, first_name, last_name, username, first_seen, last_seen)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET
                first_name = excluded.first_name,
                last_name = excluded.last_name,
                username = excluded.username,
                last_seen = excluded.last_seen`,
            userId, firstName || '', lastName || '', username || '', now, now
        );
        return jsonResponse({ success: true });
    }

    getUser(params) {
        const userId = params.get('user_id');
        const row = this.sql.exec(`SELECT * FROM users WHERE user_id = ?`, userId).toArray()[0];
        if (!row) return jsonResponse({ user: null });
        return jsonResponse({
            user: {
                userId: row.user_id,
                firstName: row.first_name,
                lastName: row.last_name,
                username: row.username,
                firstSeen: row.first_seen,
                lastSeen: row.last_seen
            }
        });
    }

    getAllUsers() {
        const users = this.sql.exec(`SELECT * FROM users ORDER BY last_seen DESC`).toArray().map(row => ({
            userId: row.user_id,
            firstName: row.first_name,
            lastName: row.last_name,
            username: row.username,
            firstSeen: row.first_seen,
            lastSeen: row.last_seen
        }));
        return jsonResponse({ count: users.length, users });
    }
}
