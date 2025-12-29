import { jsonResponse } from './base.js';

export class ServiceDB {
    constructor(state) {
        this.sql = state.storage.sql;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS service_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                service_domain TEXT NOT NULL,
                first_seen_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                email_count INTEGER DEFAULT 1,
                UNIQUE(email, service_domain)
            );
            CREATE INDEX IF NOT EXISTS idx_sub_email ON service_subscriptions(email);
            CREATE INDEX IF NOT EXISTS idx_sub_service ON service_subscriptions(service_domain);
        `);
        this.initialized = true;
    }

    async fetch(request) {
        const { pathname, searchParams } = new URL(request.url);
        const method = request.method;
        await this.init();

        if (pathname === '/service' && method === 'POST') {
            return this.recordService(request);
        }
        if (pathname === '/all-services' && method === 'GET') {
            return this.getAllServices();
        }
        if (pathname === '/services-by-email' && method === 'GET') {
            return this.getServicesByEmail(searchParams);
        }
        if (pathname === '/emails-by-service' && method === 'GET') {
            return this.getEmailsByService(searchParams);
        }
        if (pathname === '/service' && method === 'DELETE') {
            return this.deleteService(searchParams);
        }
        if (pathname === '/service-email' && method === 'DELETE') {
            return this.deleteEmailFromService(searchParams);
        }

        return new Response('Not found', { status: 404 });
    }

    async recordService(request) {
        const { email, serviceDomain } = await request.json();
        const now = new Date().toISOString();

        try {
            this.sql.exec(
                `INSERT INTO service_subscriptions (email, service_domain, first_seen_at, last_seen_at, email_count)
                 VALUES (?, ?, ?, ?, 1)
                 ON CONFLICT(email, service_domain) DO UPDATE SET
                    last_seen_at = excluded.last_seen_at,
                    email_count = email_count + 1`,
                email, serviceDomain, now, now
            );
            return jsonResponse({ success: true });
        } catch (e) {
            return jsonResponse({ success: false, error: e.message }, 500);
        }
    }

    getServicesByEmail(params) {
        const email = params.get('email');
        const services = this.sql.exec(
            `SELECT service_domain, email_count, first_seen_at, last_seen_at 
             FROM service_subscriptions 
             WHERE email = ? 
             ORDER BY last_seen_at DESC`,
            email
        ).toArray().map(row => ({
            service: row.service_domain,
            emailCount: row.email_count,
            firstSeen: row.first_seen_at,
            lastSeen: row.last_seen_at
        }));
        return jsonResponse({ email, services });
    }

    getEmailsByService(params) {
        const service = params.get('service');
        const emails = this.sql.exec(
            `SELECT email, email_count, first_seen_at, last_seen_at 
             FROM service_subscriptions 
             WHERE service_domain = ? 
             ORDER BY last_seen_at DESC`,
            service
        ).toArray().map(row => ({
            email: row.email,
            emailCount: row.email_count,
            firstSeen: row.first_seen_at,
            lastSeen: row.last_seen_at
        }));
        return jsonResponse({ service, emails });
    }

    getAllServices() {
        const services = this.sql.exec(
            `SELECT service_domain, 
                    COUNT(DISTINCT email) as email_count,
                    SUM(email_count) as total_emails,
                    MIN(first_seen_at) as first_seen,
                    MAX(last_seen_at) as last_seen
             FROM service_subscriptions 
             GROUP BY service_domain
             ORDER BY total_emails DESC`
        ).toArray().map(row => ({
            service: row.service_domain,
            uniqueEmails: row.email_count,
            totalEmails: row.total_emails,
            firstSeen: row.first_seen,
            lastSeen: row.last_seen
        }));
        return jsonResponse({ count: services.length, services });
    }

    deleteService(params) {
        const serviceDomain = params.get('service_domain');
        if (!serviceDomain) {
            return jsonResponse({ error: 'service_domain required' }, 400);
        }

        this.sql.exec(
            `DELETE FROM service_subscriptions WHERE service_domain = ?`,
            serviceDomain
        );
        return jsonResponse({ success: true, message: 'Service deleted' });
    }

    deleteEmailFromService(params) {
        const email = params.get('email');
        const serviceDomain = params.get('service_domain');

        if (!email || !serviceDomain) {
            return jsonResponse({ error: 'email and service_domain required' }, 400);
        }

        this.sql.exec(
            `DELETE FROM service_subscriptions WHERE email = ? AND service_domain = ?`,
            email, serviceDomain
        );
        return jsonResponse({ success: true, message: 'Email removed from service' });
    }
}
