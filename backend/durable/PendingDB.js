import { jsonResponse } from './base.js';

export class PendingDB {
    constructor(state) {
        this.sql = state.storage.sql;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS pending_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                email TEXT NOT NULL,
                status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
                created_at TEXT NOT NULL,
                resolved_at TEXT,
                resolved_by TEXT,
                UNIQUE(user_id, email, status)
            );
            CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_requests(status);
        `);
        this.initialized = true;
    }

    async fetch(request) {
        const { pathname, searchParams } = new URL(request.url);
        const method = request.method;
        await this.init();

        if (pathname === '/create' && method === 'POST') return this.create(request);
        if (pathname === '/resolve' && method === 'POST') return this.resolve(request);
        if (pathname === '/pending' && method === 'GET') return this.getPending();
        if (pathname === '/all' && method === 'GET') return this.getAll();

        return new Response('Not found', { status: 404 });
    }

    async create(request) {
        const { userId, email } = await request.json();
        const now = new Date().toISOString();

        try {
            const result = this.sql.exec(
                `INSERT INTO pending_requests (user_id, email, created_at) VALUES (?, ?, ?)`,
                userId, email, now
            );
            return jsonResponse({ success: true, id: result.lastRowId });
        } catch {
            // Already exists
            return jsonResponse({ success: false, error: 'Request already pending' }, 409);
        }
    }

    async resolve(request) {
        const { id, status, resolvedBy } = await request.json();
        const now = new Date().toISOString();

        this.sql.exec(
            `UPDATE pending_requests SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?`,
            status, now, resolvedBy, id
        );

        const row = this.sql.exec(`SELECT * FROM pending_requests WHERE id = ?`, id).toArray()[0];
        return jsonResponse({
            success: true,
            request: row ? {
                id: row.id,
                userId: row.user_id,
                email: row.email,
                status: row.status
            } : null
        });
    }

    getPending() {
        const requests = this.sql.exec(
            `SELECT * FROM pending_requests WHERE status = 'PENDING' ORDER BY created_at ASC`
        ).toArray().map(r => ({
            id: r.id,
            userId: r.user_id,
            email: r.email,
            createdAt: r.created_at
        }));
        return jsonResponse({ count: requests.length, requests });
    }

    getAll() {
        const requests = this.sql.exec(
            `SELECT * FROM pending_requests ORDER BY created_at DESC`
        ).toArray().map(r => ({
            id: r.id,
            userId: r.user_id,
            email: r.email,
            status: r.status,
            createdAt: r.created_at,
            resolvedAt: r.resolved_at,
            resolvedBy: r.resolved_by
        }));
        return jsonResponse({ count: requests.length, requests });
    }
}
