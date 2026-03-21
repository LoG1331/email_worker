import { maybePruneStoredRawMime, getDb, withTransaction } from '../db/index.mjs';
import { hasGlobalPermission } from './account-service.mjs';
import { normalizeDomain, parseEmailAddress, parseEnvelopeAddress } from '../utils/email.mjs';
import { HttpError } from '../utils/http.mjs';

const EMAIL_BATCH_LIMIT = 200;
const PERMISSION_LEVELS = {
    view: 1,
    write: 2,
    admin: 3
};

function cleanText(value) {
    return String(value ?? '').trim();
}

function nowIso() {
    return new Date().toISOString();
}

function parsePositiveId(value, label = 'id') {
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new HttpError(400, `Valid ${label} is required`);
    }

    return parsed;
}

function parseSenderJson(value) {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function parseEmailId(value) {
    return parsePositiveId(value, 'email id');
}

function normalizeEmailIds(emailIds, { max = EMAIL_BATCH_LIMIT, allowEmpty = false } = {}) {
    if (!Array.isArray(emailIds)) {
        throw new HttpError(400, 'emailIds must be an array');
    }

    const uniqueEmailIds = [...new Set(emailIds.map(parseEmailId))];
    if (!allowEmpty && !uniqueEmailIds.length) {
        throw new HttpError(400, 'At least one email id is required');
    }

    if (uniqueEmailIds.length > max) {
        throw new HttpError(400, `Maximum ${max} email ids are allowed per request`);
    }

    return uniqueEmailIds;
}

function getRequiredPermissionLevel(permission) {
    const level = PERMISSION_LEVELS[permission];
    if (!level) {
        throw new HttpError(500, `Unsupported email permission: ${permission}`);
    }

    return level;
}

function groupCountJoinSql() {
    return `
        LEFT JOIN (
            SELECT email_id, COUNT(*) AS group_count
            FROM group_emails
            GROUP BY email_id
        ) gc ON gc.email_id = e.id
    `;
}

function baseEmailSelect({ includeRawMime = false } = {}) {
    return `
        SELECT
            e.id,
            e.domain_id,
            e.recipient_address,
            e.local_part,
            e.recipient_domain,
            e.envelope_from,
            e.sender_json,
            e.subject,
            e.text_body,
            e.html_body,
            e.worker_name,
            e.source_domain,
            e.message_id,
            e.received_at,
            e.created_at,
            LENGTH(e.raw_mime) AS raw_mime_size,
            ${includeRawMime ? 'e.raw_mime' : 'NULL AS raw_mime'},
            COALESCE(gc.group_count, 0) AS group_count
    `;
}

function mapEmailRow(row, includeRawMime = false) {
    const email = {
        id: row.id,
        to: row.recipient_address,
        localPart: row.local_part,
        domain: row.recipient_domain,
        envelopeFrom: row.envelope_from,
        from: parseSenderJson(row.sender_json),
        subject: row.subject,
        text: row.text_body,
        html: row.html_body,
        workerName: row.worker_name,
        sourceDomain: row.source_domain,
        messageId: row.message_id,
        receivedAt: row.received_at,
        createdAt: row.created_at,
        hasRawMime: Boolean(row.raw_mime_size),
        rawMimeSize: row.raw_mime_size || 0,
        groupCount: row.group_count || 0
    };

    if (includeRawMime) {
        email.rawMime = row.raw_mime ? Buffer.from(row.raw_mime).toString('base64') : null;
    }

    return email;
}

function mapRowsById(rows, includeRawMime = false) {
    return new Map(rows.map(row => [row.id, mapEmailRow(row, includeRawMime)]));
}

function buildInPlaceholders(values) {
    return values.map(() => '?').join(', ');
}

function buildPermissionLevelCase(alias = 'p') {
    return `
        CASE ${alias}.role
            WHEN 'viewer' THEN 1
            WHEN 'operator' THEN 2
            WHEN 'admin' THEN 3
            ELSE 0
        END
    `;
}

function buildEmailVisibilitySql(userId, permission = 'view', { requireRegistration = true, emailAlias = 'e' } = {}) {
    const requiredLevel = getRequiredPermissionLevel(permission);
    const conditions = [
        `
            EXISTS (
                SELECT 1
                FROM permissions p
                WHERE p.user_id = ?
                  AND p.domain_id = ${emailAlias}.domain_id
                  AND p.status = 'active'
                  AND (${buildPermissionLevelCase('p')}) >= ?
                  AND (p.local_part IS NULL OR p.local_part = ${emailAlias}.local_part)
            )
        `
    ];
    const values = [userId, requiredLevel];

    if (requireRegistration) {
        conditions.push(
            `
                EXISTS (
                    SELECT 1
                    FROM email_registers er
                    WHERE er.owner_user_id = ?
                      AND er.recipient_address = ${emailAlias}.recipient_address
                )
            `
        );
        values.push(userId);
    }

    return {
        conditions,
        values
    };
}

async function assertRegisteredMailboxPermission(config, auth, emailAddress, permission = 'view', options = {}) {
    const parsedAddress = parseEmailAddress(emailAddress);
    if (!parsedAddress) {
        throw new HttpError(400, 'Valid email address is required');
    }

    const subjectUserId = options.userId === undefined || options.userId === null
        ? null
        : parsePositiveId(options.userId, 'user id');
    if (!subjectUserId && hasGlobalPermission(auth)) {
        return parsedAddress;
    }

    const requireRegistration = options.requireRegistration !== false;
    const requiredLevel = getRequiredPermissionLevel(permission);
    const db = await getDb(config);
    const values = [
        parsedAddress.domain,
        subjectUserId || auth?.userId || 0,
        requiredLevel,
        parsedAddress.localPart
    ];
    let registrationClause = '';

    if (requireRegistration) {
        registrationClause = `
            AND EXISTS (
                SELECT 1
                FROM email_registers er
                WHERE er.owner_user_id = ?
                  AND er.recipient_address = ?
            )
        `;
        values.push(subjectUserId || auth?.userId || 0, parsedAddress.email);
    }

    const row = await db.get(
        `
            SELECT d.id
            FROM domains d
            WHERE d.name = ?
              AND EXISTS (
                  SELECT 1
                  FROM permissions p
                  WHERE p.user_id = ?
                    AND p.domain_id = d.id
                    AND p.status = 'active'
                    AND (${buildPermissionLevelCase('p')}) >= ?
                    AND (p.local_part IS NULL OR p.local_part = ?)
              )
              ${registrationClause}
            LIMIT 1
        `,
        values
    );

    if (!row) {
        throw new HttpError(403, `Mailbox ${parsedAddress.email} is not available for this user`);
    }

    return parsedAddress;
}

async function getDomainForIngress(db, config, domainName) {
    const normalizedDomain = normalizeDomain(domainName);
    if (!normalizedDomain) {
        throw new HttpError(400, 'Recipient domain is missing');
    }

    const current = await db.get(`SELECT * FROM domains WHERE name = ? LIMIT 1`, [normalizedDomain]);
    if (current) {
        if (current.status !== 'active') {
            throw new HttpError(409, 'Recipient domain is disabled');
        }

        if (!current.inbound_enabled) {
            throw new HttpError(409, 'Inbound is disabled for this domain');
        }

        return current;
    }

    if (!config.autoCreateDomainsOnIngress) {
        throw new HttpError(422, 'Recipient domain is not registered');
    }

    const timestamp = nowIso();
    const result = await db.run(
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
            VALUES (?, '', 'active', 1, 0, ?, ?)
        `,
        [normalizedDomain, timestamp, timestamp]
    );

    return db.get(`SELECT * FROM domains WHERE id = ? LIMIT 1`, [result.lastID]);
}

async function fetchEmailRowsByIds(db, emailIds, { includeRawMime = false } = {}) {
    if (!emailIds.length) {
        return [];
    }

    const placeholders = buildInPlaceholders(emailIds);
    return db.all(
        `
            ${baseEmailSelect({ includeRawMime })}
            FROM emails e
            ${groupCountJoinSql()}
            WHERE e.id IN (${placeholders})
        `,
        emailIds
    );
}

async function fetchAccessibleEmailRowsByIds(db, userId, emailIds, permission = 'view', {
    includeRawMime = false,
    requireRegistration = true
} = {}) {
    if (!emailIds.length) {
        return [];
    }

    const placeholders = buildInPlaceholders(emailIds);
    const visibility = buildEmailVisibilitySql(userId, permission, {
        requireRegistration
    });
    return db.all(
        `
            ${baseEmailSelect({ includeRawMime })}
            FROM emails e
            ${groupCountJoinSql()}
            WHERE e.id IN (${placeholders})
              AND ${visibility.conditions.join(' AND ')}
        `,
        [...emailIds, ...visibility.values]
    );
}

export async function ingestInboundEmail(config, payload) {
    const envelope = parseEnvelopeAddress(payload.envelopeTo);
    if (!envelope) {
        throw new HttpError(400, 'Valid X-Email-Envelope-To header is required');
    }

    const subject = cleanText(payload.subject) || '(No Subject)';
    const receivedAt = cleanText(payload.receivedAt) || nowIso();
    const rawMime = config.storeRawMime ? payload.rawMime : null;

    const result = await withTransaction(config, async (db) => {
        const domain = await getDomainForIngress(db, config, envelope.domain);
        const insertResult = await db.run(
            `
                INSERT INTO emails (
                    domain_id,
                    recipient_address,
                    local_part,
                    recipient_domain,
                    envelope_from,
                    sender_json,
                    subject,
                    text_body,
                    html_body,
                    worker_name,
                    source_domain,
                    message_id,
                    received_at,
                    raw_mime
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                domain.id,
                envelope.email,
                envelope.localPart,
                domain.name,
                cleanText(payload.envelopeFrom),
                payload.senderJson ? JSON.stringify(payload.senderJson) : null,
                subject,
                payload.textBody || '',
                payload.htmlBody || '',
                cleanText(payload.workerName),
                cleanText(payload.sourceDomain),
                cleanText(payload.messageId),
                receivedAt,
                rawMime
            ]
        );

        return {
            id: insertResult.lastID,
            envelopeTo: envelope.email,
            domain: domain.name,
            receivedAt
        };
    });

    void maybePruneStoredRawMime(config).catch(error => {
        console.error('Background prune failed:', error);
    });

    return result;
}

export async function listEmails(config, auth, filters = {}) {
    const db = await getDb(config);
    const conditions = [];
    const values = [];
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const bypassVisibility = hasGlobalPermission(auth);

    if (filters.domain) {
        const domain = normalizeDomain(filters.domain);
        if (!domain) {
            throw new HttpError(400, 'Invalid domain filter');
        }

        conditions.push(`e.recipient_domain = ?`);
        values.push(domain);
    }

    if (filters.address) {
        const parsedAddress = parseEmailAddress(filters.address);
        if (!parsedAddress) {
            throw new HttpError(400, 'Invalid email address filter');
        }

        conditions.push(`e.recipient_address = ?`);
        values.push(parsedAddress.email);
    }

    if (!bypassVisibility) {
        const visibility = buildEmailVisibilitySql(auth?.userId || 0, 'view', {
            requireRegistration: true
        });
        conditions.push(...visibility.conditions);
        values.push(...visibility.values);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await db.all(
        `
            ${baseEmailSelect()}
            FROM emails e
            ${groupCountJoinSql()}
            ${whereClause}
            ORDER BY e.received_at DESC, e.id DESC
            LIMIT ? OFFSET ?
        `,
        [...values, limit, offset]
    );

    const totalRow = await db.get(
        `
            SELECT COUNT(*) AS total
            FROM emails e
            ${whereClause}
        `,
        values
    );

    return {
        total: totalRow?.total || 0,
        emails: rows.map(row => mapEmailRow(row))
    };
}

export async function getInboxByAddress(config, emailAddress, limit = 50) {
    const parsedAddress = parseEmailAddress(emailAddress);
    if (!parsedAddress) {
        throw new HttpError(400, 'Invalid email address');
    }

    const db = await getDb(config);
    const rows = await db.all(
        `
            ${baseEmailSelect()}
            FROM emails e
            ${groupCountJoinSql()}
            WHERE e.recipient_address = ?
            ORDER BY e.received_at DESC, e.id DESC
            LIMIT ?
        `,
        [parsedAddress.email, limit]
    );

    return rows.map(row => mapEmailRow(row));
}

export async function getEmailById(config, id, { includeRawMime = false } = {}) {
    const emailId = parseEmailId(id);
    const db = await getDb(config);
    const rows = await fetchEmailRowsByIds(db, [emailId], { includeRawMime });
    if (!rows.length) {
        throw new HttpError(404, 'Email not found');
    }

    return mapEmailRow(rows[0], includeRawMime);
}

export async function getAuthorizedEmailsByIds(config, auth, emailIds, options = {}) {
    const normalizedEmailIds = normalizeEmailIds(emailIds, {
        max: options.max || EMAIL_BATCH_LIMIT,
        allowEmpty: options.allowEmpty === true
    });

    if (!normalizedEmailIds.length) {
        return {
            count: 0,
            emails: [],
            missingIds: [],
            deniedIds: []
        };
    }

    const db = await getDb(config);
    const includeRawMime = options.includeRawMime === true;
    const permission = options.permission || 'view';
    const subjectUserId = options.userId === undefined || options.userId === null
        ? null
        : parsePositiveId(options.userId, 'user id');
    const bypassVisibility = subjectUserId === null && hasGlobalPermission(auth);
    const [existingRows, accessibleRows] = await Promise.all([
        db.all(
            `
                SELECT id
                FROM emails
                WHERE id IN (${buildInPlaceholders(normalizedEmailIds)})
            `,
            normalizedEmailIds
        ),
        bypassVisibility
            ? fetchEmailRowsByIds(db, normalizedEmailIds, { includeRawMime })
            : fetchAccessibleEmailRowsByIds(
                db,
                subjectUserId || auth?.userId || 0,
                normalizedEmailIds,
                permission,
                {
                    includeRawMime,
                    requireRegistration: options.requireRegistration !== false
                }
            )
    ]);

    const existingIds = new Set(existingRows.map(row => row.id));
    const accessibleById = mapRowsById(accessibleRows, includeRawMime);
    const emails = [];
    const missingIds = [];
    const deniedIds = [];

    for (const emailId of normalizedEmailIds) {
        if (!existingIds.has(emailId)) {
            missingIds.push(emailId);
            continue;
        }

        const email = accessibleById.get(emailId);
        if (!email) {
            deniedIds.push(emailId);
            continue;
        }

        emails.push(email);
    }

    return {
        count: emails.length,
        emails,
        missingIds,
        deniedIds
    };
}

export async function deleteEmailById(config, id) {
    const emailId = parseEmailId(id);
    const db = await getDb(config);
    await db.run(`DELETE FROM emails WHERE id = ?`, [emailId]);
    return { success: true };
}

export async function deleteEmailsByRecipient(config, emailAddress) {
    const parsedAddress = parseEmailAddress(emailAddress);
    if (!parsedAddress) {
        throw new HttpError(400, 'Invalid email address');
    }

    const db = await getDb(config);
    await db.run(`DELETE FROM emails WHERE recipient_address = ?`, [parsedAddress.email]);
    return { success: true };
}

export async function pruneStoredRawMime(config) {
    return maybePruneStoredRawMime(config, { force: true });
}

export { assertRegisteredMailboxPermission };
