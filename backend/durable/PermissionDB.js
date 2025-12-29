import { jsonResponse } from './base.js';

export class PermissionDB {
    constructor(state) {
        this.sql = state.storage.sql;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                permission_type TEXT NOT NULL CHECK(permission_type IN ('DOMAIN', 'EMAIL')),
                target TEXT,
                granted_by TEXT NOT NULL,
                granted_at TEXT NOT NULL,
                UNIQUE(user_id, permission_type, target)
            );
            CREATE INDEX IF NOT EXISTS idx_perm_user ON permissions(user_id);
        `);
        this.initialized = true;
    }

    async fetch(request) {
        const { pathname, searchParams } = new URL(request.url);
        const method = request.method;
        await this.init();

        if (pathname === '/grant' && method === 'POST') return this.grant(request);
        if (pathname === '/revoke' && method === 'DELETE') return this.revoke(searchParams);
        if (pathname === '/check' && method === 'GET') return this.check(searchParams);
        if (pathname === '/user' && method === 'GET') return this.getUserPerms(searchParams);
        if (pathname === '/all' && method === 'GET') return this.getAll();

        return new Response('Not found', { status: 404 });
    }

    async grant(request) {
        const { userId, type, target, grantedBy } = await request.json();
        const now = new Date().toISOString();

        try {
            this.sql.exec(
                `INSERT INTO permissions (user_id, permission_type, target, granted_by, granted_at)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(user_id, permission_type, target) DO UPDATE SET
                    granted_by = excluded.granted_by, granted_at = excluded.granted_at`,
                userId, type, target || null, grantedBy, now
            );
            return jsonResponse({ success: true });
        } catch (e) {
            return jsonResponse({ success: false, error: e.message }, 500);
        }
    }

    revoke(params) {
        const userId = params.get('user_id');
        const type = params.get('type');
        const target = params.get('target') || null;

        this.sql.exec(
            `DELETE FROM permissions WHERE user_id = ? AND permission_type = ? AND (target = ? OR (target IS NULL AND ? IS NULL))`,
            userId, type, target, target
        );
        return jsonResponse({ success: true });
    }

    check(params) {
        const userId = params.get('user_id');
        const email = params.get('email'); // email prefix, e.g., "abc" for abc@domain.com

        // Check DOMAIN permission first
        const hasDomain = this.sql.exec(
            `SELECT 1 FROM permissions WHERE user_id = ? AND permission_type = 'DOMAIN'`, userId
        ).toArray().length > 0;

        if (hasDomain) return jsonResponse({ hasAccess: true, type: 'DOMAIN' });

        // Check EMAIL permission
        if (email) {
            const hasEmail = this.sql.exec(
                `SELECT 1 FROM permissions WHERE user_id = ? AND permission_type = 'EMAIL' AND target = ?`,
                userId, email
            ).toArray().length > 0;

            if (hasEmail) return jsonResponse({ hasAccess: true, type: 'EMAIL', target: email });
        }

        return jsonResponse({ hasAccess: false });
    }

    getUserPerms(params) {
        const userId = params.get('user_id');
        const perms = this.sql.exec(
            `SELECT permission_type, target, granted_by, granted_at FROM permissions WHERE user_id = ?`, userId
        ).toArray().map(r => ({
            type: r.permission_type,
            target: r.target,
            grantedBy: r.granted_by,
            grantedAt: r.granted_at
        }));
        return jsonResponse({ userId, permissions: perms });
    }

    getAll() {
        const perms = this.sql.exec(
            `SELECT user_id, permission_type, target, granted_by, granted_at FROM permissions ORDER BY granted_at DESC`
        ).toArray().map(r => ({
            userId: r.user_id,
            type: r.permission_type,
            target: r.target,
            grantedBy: r.granted_by,
            grantedAt: r.granted_at
        }));
        return jsonResponse({ count: perms.length, permissions: perms });
    }
}
