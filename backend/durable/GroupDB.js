import { jsonResponse } from './base.js';

export class GroupDB {
    constructor(state) {
        this.sql = state.storage.sql;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                color TEXT DEFAULT '#3B82F6',
                created_at TEXT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS group_emails (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER NOT NULL,
                email_address TEXT NOT NULL,
                added_at TEXT NOT NULL,
                UNIQUE(group_id, email_address),
                FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
            );
            
            CREATE INDEX IF NOT EXISTS idx_group_emails_group ON group_emails(group_id);
            CREATE INDEX IF NOT EXISTS idx_group_emails_email ON group_emails(email_address);
        `);
        this.initialized = true;
    }

    async fetch(request) {
        const { pathname, searchParams } = new URL(request.url);
        const method = request.method;
        await this.init();

        // Email-group assignments
        if (pathname.match(/^\/groups\/\d+\/emails$/) && method === 'POST') return this.addEmailToGroup(request, pathname);
        if (pathname.match(/^\/groups\/\d+\/emails\/.+$/) && method === 'DELETE') return this.removeEmailFromGroup(pathname);
        if (pathname.match(/^\/groups\/\d+\/emails$/) && method === 'GET') return this.getEmailsInGroup(pathname, searchParams);
        if (pathname.startsWith('/emails/') && pathname.endsWith('/groups') && method === 'GET') return this.getGroupsForEmail(pathname);

        // Group management
        if (pathname === '/groups' && method === 'GET') return this.getAllGroups();
        if (pathname === '/groups' && method === 'POST') return this.createGroup(request);
        if (pathname.match(/^\/groups\/\d+$/) && method === 'PUT') return this.updateGroup(request, pathname);
        if (pathname.match(/^\/groups\/\d+$/) && method === 'DELETE') return this.deleteGroup(pathname);

        return new Response('Not found', { status: 404 });
    }

    async createGroup(request) {
        const { name, color = '#3B82F6' } = await request.json();
        if (!name) return jsonResponse({ error: 'name required' }, 400);

        const now = new Date().toISOString();
        try {
            const result = this.sql.exec(
                `INSERT INTO groups (name, color, created_at) VALUES (?, ?, ?)`,
                name, color, now
            );
            return jsonResponse({ success: true, id: result.lastInsertRowid, name, color });
        } catch {
            return jsonResponse({ error: 'Group name already exists' }, 409);
        }
    }

    async updateGroup(request, pathname) {
        const groupId = parseInt(pathname.split('/')[2]);
        const { name, color } = await request.json();

        if (name) {
            this.sql.exec(`UPDATE groups SET name = ? WHERE id = ?`, name, groupId);
        }
        if (color) {
            this.sql.exec(`UPDATE groups SET color = ? WHERE id = ?`, color, groupId);
        }

        return jsonResponse({ success: true });
    }

    deleteGroup(pathname) {
        const groupId = parseInt(pathname.split('/')[2]);
        this.sql.exec(`DELETE FROM groups WHERE id = ?`, groupId);
        return jsonResponse({ success: true });
    }

    getAllGroups() {
        const groups = this.sql.exec(`
            SELECT g.id, g.name, g.color, g.created_at,
                   COUNT(ge.id) as email_count
             FROM groups g
             LEFT JOIN group_emails ge ON g.id = ge.group_id
             GROUP BY g.id
             ORDER BY g.created_at DESC
         `).toArray().map(r => ({
            id: r.id,
            name: r.name,
            color: r.color,
            createdAt: r.created_at,
            emailCount: r.email_count
        }));

        return jsonResponse({ count: groups.length, groups });
    }

    async addEmailToGroup(request, pathname) {
        const groupId = parseInt(pathname.split('/')[2]);
        const { emailAddress } = await request.json();
        if (!emailAddress) return jsonResponse({ error: 'emailAddress required' }, 400);

        const now = new Date().toISOString();
        try {
            this.sql.exec(
                `INSERT INTO group_emails (group_id, email_address, added_at) VALUES (?, ?, ?)`,
                groupId, emailAddress, now
            );
            return jsonResponse({ success: true });
        } catch {
            return jsonResponse({ error: 'Email already in group' }, 409);
        }
    }

    removeEmailFromGroup(pathname) {
        const parts = pathname.split('/');
        const groupId = parseInt(parts[2]);
        const emailAddress = decodeURIComponent(parts[4]);

        this.sql.exec(
            `DELETE FROM group_emails WHERE group_id = ? AND email_address = ?`,
            groupId, emailAddress
        );
        return jsonResponse({ success: true });
    }

    getEmailsInGroup(pathname, searchParams) {
        const groupId = parseInt(pathname.split('/')[2]);
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');

        const emails = this.sql.exec(`
            SELECT email_address, added_at
            FROM group_emails
            WHERE group_id = ?
            ORDER BY added_at DESC
            LIMIT ? OFFSET ?
        `, groupId, limit, offset).toArray().map(r => ({
            emailAddress: r.email_address,
            addedAt: r.added_at
        }));

        const total = this.sql.exec(
            `SELECT COUNT(*) as count FROM group_emails WHERE group_id = ?`,
            groupId
        ).one().count;

        return jsonResponse({ emails, total });
    }

    getGroupsForEmail(pathname) {
        const emailAddress = decodeURIComponent(pathname.split('/')[2]);

        const groups = this.sql.exec(`
            SELECT g.id, g.name, g.color
            FROM groups g
            JOIN group_emails ge ON g.id = ge.group_id
            WHERE ge.email_address = ?
            ORDER BY g.name
        `, emailAddress).toArray().map(r => ({
            id: r.id,
            name: r.name,
            color: r.color
        }));

        return jsonResponse({ groups });
    }
}
