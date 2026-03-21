import { getDb, withTransaction } from '../db/index.mjs';
import { normalizeDomain } from '../utils/email.mjs';
import { HttpError } from '../utils/http.mjs';

const DOMAIN_STATUS = new Set(['active', 'disabled']);

function nowIso() {
    return new Date().toISOString();
}

function cleanText(value) {
    return String(value ?? '').trim();
}

function normalizeStatus(value, fallback = 'active') {
    const normalized = cleanText(value).toLowerCase();
    if (!normalized) {
        return fallback;
    }

    if (!DOMAIN_STATUS.has(normalized)) {
        throw new HttpError(400, `Unsupported domain status: ${value}`);
    }

    return normalized;
}

function mapDomainRow(row) {
    return {
        id: row.id,
        domain: row.name,
        description: row.description,
        status: row.status,
        inboundEnabled: Boolean(row.inbound_enabled),
        isDefault: Boolean(row.is_default),
        counts: {
            permissionCount: row.permission_count || 0,
            emails: row.email_count || 0
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function getDomainRecord(db, domainName) {
    const normalizedDomain = normalizeDomain(domainName);
    if (!normalizedDomain) {
        throw new HttpError(400, 'Valid domain is required');
    }

    const row = await db.get(`SELECT * FROM domains WHERE name = ? LIMIT 1`, [normalizedDomain]);
    if (!row) {
        throw new HttpError(404, 'Domain not found');
    }

    return row;
}

export async function listDomains(config, options = {}) {
    const db = await getDb(config);
    const conditions = [];
    const values = [];
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    if (Array.isArray(options.allowedDomains)) {
        const normalizedDomains = options.allowedDomains
            .map(domain => normalizeDomain(domain))
            .filter(Boolean);

        if (!normalizedDomains.length) {
            return {
                total: 0,
                domains: []
            };
        }

        conditions.push(`d.name IN (${normalizedDomains.map(() => '?').join(', ')})`);
        values.push(...normalizedDomains);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows, totalRow] = await Promise.all([
        db.all(
        `
            SELECT
                d.*,
                COALESCE(p.permission_count, 0) AS permission_count,
                COALESCE(e.email_count, 0) AS email_count
            FROM domains d
            LEFT JOIN (
                SELECT domain_id, COUNT(*) AS permission_count
                FROM permissions
                WHERE status = 'active'
                GROUP BY domain_id
            ) p ON p.domain_id = d.id
            LEFT JOIN (
                SELECT domain_id, COUNT(*) AS email_count
                FROM emails
                GROUP BY domain_id
            ) e ON e.domain_id = d.id
            ${whereClause}
            ORDER BY d.is_default DESC, d.name ASC
            LIMIT ? OFFSET ?
        `,
            [...values, limit, offset]
        ),
        db.get(
            `
                SELECT COUNT(*) AS total
                FROM domains d
                ${whereClause}
            `,
            values
        )
    ]);

    return {
        total: totalRow?.total || 0,
        domains: rows.map(mapDomainRow)
    };
}

export async function getDomain(config, domainName) {
    const normalizedDomain = normalizeDomain(domainName);
    if (!normalizedDomain) {
        throw new HttpError(400, 'Valid domain is required');
    }

    const db = await getDb(config);
    const row = await db.get(
        `
            SELECT
                d.*,
                COALESCE(p.permission_count, 0) AS permission_count,
                COALESCE(e.email_count, 0) AS email_count
            FROM domains d
            LEFT JOIN (
                SELECT domain_id, COUNT(*) AS permission_count
                FROM permissions
                WHERE status = 'active'
                GROUP BY domain_id
            ) p ON p.domain_id = d.id
            LEFT JOIN (
                SELECT domain_id, COUNT(*) AS email_count
                FROM emails
                GROUP BY domain_id
            ) e ON e.domain_id = d.id
            WHERE d.name = ?
            LIMIT 1
        `,
        [normalizedDomain]
    );

    if (!row) {
        throw new HttpError(404, 'Domain not found');
    }

    return mapDomainRow(row);
}

export async function upsertDomain(config, payload) {
    const domain = normalizeDomain(payload.domain);
    if (!domain) {
        throw new HttpError(400, 'Valid domain is required');
    }

    const description = cleanText(payload.description);
    const status = normalizeStatus(payload.status, 'active');
    const inboundEnabled = payload.inboundEnabled !== false;
    const isDefault = payload.isDefault === true;
    const timestamp = nowIso();

    await withTransaction(config, async (db) => {
        if (isDefault) {
            await db.run(
                `
                    UPDATE domains
                    SET is_default = 0,
                        updated_at = ?
                    WHERE is_default = 1
                `,
                [timestamp]
            );
        }

        await db.run(
            `
                INSERT INTO domains (
                    name,
                    description,
                    status,
                    inbound_enabled,
                    is_default,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    description = excluded.description,
                    status = excluded.status,
                    inbound_enabled = excluded.inbound_enabled,
                    is_default = excluded.is_default,
                    updated_at = excluded.updated_at
            `,
            [
                domain,
                description,
                status,
                inboundEnabled ? 1 : 0,
                isDefault ? 1 : 0,
                timestamp,
                timestamp
            ]
        );
    });

    return getDomain(config, domain);
}

export async function updateDomain(config, domainName, payload) {
    const normalizedDomain = normalizeDomain(domainName);
    await withTransaction(config, async (db) => {
        const current = await getDomainRecord(db, normalizedDomain);
        const nextDescription = payload.description === undefined ? current.description : cleanText(payload.description);
        const nextStatus = payload.status === undefined ? current.status : normalizeStatus(payload.status, current.status);
        const nextInboundEnabled = payload.inboundEnabled === undefined ? Boolean(current.inbound_enabled) : payload.inboundEnabled === true;
        const nextIsDefault = payload.isDefault === undefined ? Boolean(current.is_default) : payload.isDefault === true;
        const timestamp = nowIso();

        if (nextIsDefault) {
            await db.run(
                `
                    UPDATE domains
                    SET is_default = 0,
                        updated_at = ?
                    WHERE is_default = 1
                `,
                [timestamp]
            );
        }

        await db.run(
            `
                UPDATE domains
                SET description = ?,
                    status = ?,
                    inbound_enabled = ?,
                    is_default = ?,
                    updated_at = ?
                WHERE name = ?
            `,
            [
                nextDescription,
                nextStatus,
                nextInboundEnabled ? 1 : 0,
                nextIsDefault ? 1 : 0,
                timestamp,
                normalizedDomain
            ]
        );
    });

    return getDomain(config, normalizedDomain);
}
