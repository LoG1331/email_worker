import { maybePruneStoredRawMime, getDb, vacuumDatabase, withTransaction } from '../db/index.mjs';
import { hasGlobalPermission } from './account-service.mjs';
import { enqueueInboundEmailNotification, processTelegramOutbox } from '../telegram/notifications.mjs';
import { normalizeDomain, parseEmailAddress, parseEnvelopeAddress } from '../utils/email.mjs';
import { HttpError } from '../utils/http.mjs';
import { decodeCursor, encodeCursor } from '../utils/cursor.mjs';

const EMAIL_BATCH_LIMIT = 200;
const PERMISSION_LEVELS = {
    view: 1,
    write: 1
};

function cleanText(value) {
    return String(value ?? '').trim();
}

function nowIso() {
    return new Date().toISOString();
}

function normalizeStartTime(value) {
    if (value === undefined || value === null || value === '') {
        return '';
    }

    const numericValue = Number.parseInt(String(value), 10);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
        throw new HttpError(400, 'Invalid stime filter');
    }

    const epochMs = numericValue < 1_000_000_000_000
        ? numericValue * 1000
        : numericValue;
    const parsed = new Date(epochMs);
    if (Number.isNaN(parsed.getTime())) {
        throw new HttpError(400, 'Invalid stime filter');
    }

    return parsed.toISOString();
}

function normalizeEmailSearch(value) {
    if (value === undefined || value === null) {
        return '';
    }

    return String(value).trim();
}

function splitEmailSearchTerms(value) {
    const normalized = normalizeEmailSearch(value);
    if (!normalized) {
        return [];
    }

    return [...new Set(
        normalized
            .split(/\s+/)
            .map(term => term.trim())
            .filter(Boolean)
    )];
}

function normalizePruneOlderThanDays(value) {
    const numericValue = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isInteger(numericValue) || numericValue < 0) {
        throw new HttpError(400, 'olderThanDays must be a non-negative integer');
    }

    return numericValue;
}

function normalizePruneLimit(value, fallback = 5000) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    const numericValue = Number.parseInt(String(value), 10);
    if (!Number.isInteger(numericValue) || numericValue <= 0) {
        throw new HttpError(400, 'limit must be a positive integer');
    }

    return Math.min(50000, numericValue);
}

function parseEmailFeedCursor(cursor) {
    if (!cursor) {
        return null;
    }

    const payload = decodeCursor(cursor, 'Invalid email cursor');
    const receivedAt = String(payload?.receivedAt || '').trim();
    const id = Number.parseInt(String(payload?.id ?? ''), 10);
    if (!receivedAt || !Number.isInteger(id) || id <= 0 || Number.isNaN(Date.parse(receivedAt))) {
        throw new HttpError(400, 'Invalid email cursor');
    }

    return {
        receivedAt,
        id
    };
}

function buildEmailCursorSql(cursor, alias = 'e') {
    if (!cursor) {
        return {
            clause: '',
            values: []
        };
    }

    return {
        clause: ` AND (${alias}.received_at < ? OR (${alias}.received_at = ? AND ${alias}.id < ?))`,
        values: [cursor.receivedAt, cursor.receivedAt, cursor.id]
    };
}

function buildCursorPage(rows, limit, mapRow, buildCursor) {
    const pageRows = rows.slice(0, limit);
    return {
        count: pageRows.length,
        items: pageRows.map(mapRow),
        hasMore: rows.length > limit,
        nextCursor: rows.length > limit && pageRows.length
            ? buildCursor(pageRows[pageRows.length - 1])
            : null
    };
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

function uniqueNumericIds(values) {
    return [...new Set(
        values
            .map(value => Number(value))
            .filter(value => Number.isInteger(value) && value > 0)
    )];
}

function escapeSqlLikePattern(value) {
    return String(value).replace(/[\\%_]/g, '\\$&');
}

function buildEmailSearchSql(search, alias = 'e') {
    const terms = splitEmailSearchTerms(search);
    if (!terms.length) {
        return {
            clause: '',
            values: []
        };
    }
    const searchableColumns = [
        `${alias}.subject`,
        `${alias}.text_body`,
        `${alias}.html_body`,
        `${alias}.envelope_from`,
        `${alias}.sender_json`,
        `${alias}.message_id`,
        `${alias}.recipient_address`,
        `${alias}.local_part`,
        `${alias}.recipient_domain`,
        `${alias}.worker_name`,
        `${alias}.source_domain`,
        `CAST(${alias}.raw_mime AS TEXT)`
    ];

    const termClauses = [];
    const values = [];

    for (const term of terms) {
        const pattern = `%${escapeSqlLikePattern(term)}%`;
        termClauses.push(
            `(${searchableColumns.map(column => `${column} LIKE ? ESCAPE '\\' COLLATE NOCASE`).join(' OR ')})`
        );
        values.push(...searchableColumns.map(() => pattern));
    }

    return {
        clause: `(${termClauses.join(' AND ')})`,
        values
    };
}

async function reindexGroupPositionsTx(db, groupIds) {
    for (const groupId of uniqueNumericIds(groupIds)) {
        const rows = await db.all(
            `
                SELECT id
                FROM group_emails
                WHERE group_id = ?
                ORDER BY position ASC, id ASC
            `,
            [groupId]
        );

        let position = 0;
        for (const row of rows) {
            position += 1;
            await db.run(
                `
                    UPDATE group_emails
                    SET position = ?
                    WHERE id = ?
                `,
                [position, row.id]
            );
        }
    }
}

async function touchGroupsTx(db, groupIds) {
    const normalizedGroupIds = uniqueNumericIds(groupIds);
    if (!normalizedGroupIds.length) {
        return;
    }

    await db.run(
        `
            UPDATE groups
            SET updated_at = ?
            WHERE id IN (${normalizedGroupIds.map(() => '?').join(', ')})
        `,
        [nowIso(), ...normalizedGroupIds]
    );
}

async function getAffectedGroupIdsForEmailDeleteTx(db, conditionSql, values) {
    const rows = await db.all(
        `
            SELECT DISTINCT ge.group_id
            FROM group_emails ge
            JOIN emails e ON e.id = ge.email_id
            WHERE ${conditionSql}
            ORDER BY ge.group_id ASC
        `,
        values
    );

    return rows.map(row => row.group_id);
}

function buildPruneEmailsScope(options = {}) {
    const olderThanDays = normalizePruneOlderThanDays(options.olderThanDays);
    const conditions = [`e.received_at < datetime('now', ?)`];
    const values = [`-${olderThanDays} days`];
    let normalizedDomain = '';

    if (options.domain) {
        normalizedDomain = normalizeDomain(options.domain);
        if (!normalizedDomain) {
            throw new HttpError(400, 'Valid domain is required');
        }

        conditions.push(`e.recipient_domain = ?`);
        values.push(normalizedDomain);
    }

    return {
        olderThanDays,
        normalizedDomain: normalizedDomain || null,
        conditions,
        values
    };
}

async function getPruneEmailAggregateTx(db, scope) {
    return db.get(
        `
            SELECT
                COUNT(*) AS total,
                MIN(e.received_at) AS oldest_received_at,
                MAX(e.received_at) AS newest_received_at
            FROM emails e
            WHERE ${scope.conditions.join(' AND ')}
        `,
        scope.values
    );
}

async function getPruneEmailTargetIdsTx(db, scope, limit) {
    const rows = await db.all(
        `
            SELECT e.id
            FROM emails e
            WHERE ${scope.conditions.join(' AND ')}
            ORDER BY e.received_at ASC, e.id ASC
            LIMIT ?
        `,
        [...scope.values, limit]
    );

    return rows.map(row => row.id);
}

function buildEmailVisibilitySql(userId, permission = 'view', { requireRegistration = true, emailAlias = 'e' } = {}) {
    getRequiredPermissionLevel(permission);
    const conditions = [
        `
            EXISTS (
                SELECT 1
                FROM permissions p
                WHERE p.user_id = ?
                  AND p.domain_id = ${emailAlias}.domain_id
                  AND p.status = 'active'
            )
        `
    ];
    const values = [userId];

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
    if (hasGlobalPermission(auth) && (subjectUserId === null || subjectUserId === Number(auth?.userId || 0))) {
        return parsedAddress;
    }

    const requireRegistration = options.requireRegistration !== false;
    getRequiredPermissionLevel(permission);
    const db = await getDb(config);
    const values = [
        parsedAddress.domain,
        subjectUserId || auth?.userId || 0
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

    void enqueueInboundEmailNotification(config, result.id)
        .then(queueResult => {
            if (queueResult?.queued) {
                return processTelegramOutbox(config, { limit: 1 });
            }

            return null;
        })
        .catch(error => {
            console.error('Telegram inbound notification failed:', error);
        });

    return result;
}

export async function listEmails(config, auth, filters = {}) {
    const db = await getDb(config);
    const conditions = [];
    const values = [];
    const limit = filters.limit || 50;
    const cursor = parseEmailFeedCursor(filters.cursor);
    const scope = filters.scope || '';
    const isRegisteredScope = scope === 'registered';
    const isSystemScope = scope === 'system';

    if (scope && !isRegisteredScope && !isSystemScope) {
        throw new HttpError(400, 'Invalid scope filter');
    }

    if (isSystemScope && !hasGlobalPermission(auth)) {
        throw new HttpError(403, 'System scope is only available to admins');
    }

    const bypassVisibility = hasGlobalPermission(auth) && !isRegisteredScope;

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

    const searchClause = buildEmailSearchSql(filters.search, 'e');
    if (searchClause.clause) {
        conditions.push(searchClause.clause);
        values.push(...searchClause.values);
    }

    if (!bypassVisibility) {
        const visibility = buildEmailVisibilitySql(auth?.userId || 0, 'view', {
            requireRegistration: true
        });
        conditions.push(...visibility.conditions);
        values.push(...visibility.values);
    }

    const cursorClause = buildEmailCursorSql(cursor, 'e');
    const allConditions = [...conditions];
    if (cursorClause.clause) {
        allConditions.push(cursorClause.clause.replace(/^ AND /, ''));
    }

    const whereClause = allConditions.length ? `WHERE ${allConditions.join(' AND ')}` : '';
    const rows = await db.all(
        `
            ${baseEmailSelect()}
            FROM emails e
            ${groupCountJoinSql()}
            ${whereClause}
            ORDER BY e.received_at DESC, e.id DESC
            LIMIT ?
        `,
        [...values, ...cursorClause.values, limit + 1]
    );

    const page = buildCursorPage(
        rows,
        limit,
        row => mapEmailRow(row),
        row => encodeCursor({ receivedAt: row.received_at, id: row.id })
    );

    return {
        count: page.count,
        emails: page.items,
        hasMore: page.hasMore,
        nextCursor: page.nextCursor
    };
}

export async function getInboxByAddress(config, emailAddress, options = {}) {
    const parsedAddress = parseEmailAddress(emailAddress);
    if (!parsedAddress) {
        throw new HttpError(400, 'Invalid email address');
    }

    const limit = options.limit || 50;
    const cursor = parseEmailFeedCursor(options.cursor);
    const startTime = normalizeStartTime(options.stime);
    const db = await getDb(config);
    const conditions = [`e.recipient_address = ?`];
    const values = [parsedAddress.email];

    if (startTime) {
        conditions.push(`e.received_at > ?`);
        values.push(startTime);
    }

    const cursorClause = buildEmailCursorSql(cursor, 'e');
    const rows = await db.all(
        `
            ${baseEmailSelect()}
            FROM emails e
            ${groupCountJoinSql()}
            WHERE ${conditions.join(' AND ')}${cursorClause.clause}
            ORDER BY e.received_at DESC, e.id DESC
            LIMIT ?
        `,
        [...values, ...cursorClause.values, limit + 1]
    );

    const page = buildCursorPage(
        rows,
        limit,
        row => mapEmailRow(row),
        row => encodeCursor({ receivedAt: row.received_at, id: row.id })
    );

    return {
        count: page.count,
        emails: page.items,
        hasMore: page.hasMore,
        nextCursor: page.nextCursor
    };
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
    return deleteEmailsByIds(config, [emailId]);
}

export async function deleteEmailsByRecipient(config, emailAddress) {
    const parsedAddress = parseEmailAddress(emailAddress);
    if (!parsedAddress) {
        throw new HttpError(400, 'Invalid email address');
    }

    await withTransaction(config, async (db) => {
        const affectedGroupIds = await getAffectedGroupIdsForEmailDeleteTx(db, 'e.recipient_address = ?', [parsedAddress.email]);
        await db.run(`DELETE FROM emails WHERE recipient_address = ?`, [parsedAddress.email]);
        await reindexGroupPositionsTx(db, affectedGroupIds);
        await touchGroupsTx(db, affectedGroupIds);
    });
    return { success: true };
}

export async function deleteEmailsByIds(config, emailIds) {
    const normalizedEmailIds = normalizeEmailIds(emailIds);

    const result = await withTransaction(config, async (db) => {
        const affectedGroupIds = await getAffectedGroupIdsForEmailDeleteTx(
            db,
            `e.id IN (${buildInPlaceholders(normalizedEmailIds)})`,
            normalizedEmailIds
        );
        const deleteResult = await db.run(
            `
                DELETE FROM emails
                WHERE id IN (${buildInPlaceholders(normalizedEmailIds)})
            `,
            normalizedEmailIds
        );
        await reindexGroupPositionsTx(db, affectedGroupIds);
        await touchGroupsTx(db, affectedGroupIds);

        return deleteResult;
    });

    return {
        success: true,
        deleted: result?.changes || 0
    };
}

export async function pruneStoredRawMime(config) {
    return maybePruneStoredRawMime(config, { force: true });
}

export async function pruneEmails(config, options = {}) {
    const scope = buildPruneEmailsScope(options);
    const limit = normalizePruneLimit(options.limit, 5000);
    const dryRun = options.dryRun === true;
    const db = await getDb(config);
    const aggregate = await getPruneEmailAggregateTx(db, scope);
    const totalMatched = Number(aggregate?.total || 0);

    if (dryRun) {
        const previewIds = await getPruneEmailTargetIdsTx(db, scope, limit);
        const affectedGroupIds = previewIds.length
            ? await getAffectedGroupIdsForEmailDeleteTx(
                db,
                `e.id IN (${buildInPlaceholders(previewIds)})`,
                previewIds
            )
            : [];

        return {
            dryRun: true,
            domain: scope.normalizedDomain,
            olderThanDays: scope.olderThanDays,
            limit,
            matched: totalMatched,
            selected: previewIds.length,
            deleted: 0,
            hasMore: totalMatched > previewIds.length,
            affectedGroups: affectedGroupIds.length,
            oldestReceivedAt: aggregate?.oldest_received_at || null,
            newestReceivedAt: aggregate?.newest_received_at || null
        };
    }

    const result = await withTransaction(config, async (transactionDb) => {
        const targetIds = await getPruneEmailTargetIdsTx(transactionDb, scope, limit);
        if (!targetIds.length) {
            return {
                dryRun: false,
                domain: scope.normalizedDomain,
                olderThanDays: scope.olderThanDays,
                limit,
                matched: totalMatched,
                selected: 0,
                deleted: 0,
                hasMore: false,
                affectedGroups: 0,
                oldestReceivedAt: aggregate?.oldest_received_at || null,
                newestReceivedAt: aggregate?.newest_received_at || null
            };
        }

        const affectedGroupIds = await getAffectedGroupIdsForEmailDeleteTx(
            transactionDb,
            `e.id IN (${buildInPlaceholders(targetIds)})`,
            targetIds
        );

        const result = await transactionDb.run(
            `
                DELETE FROM emails
                WHERE id IN (${buildInPlaceholders(targetIds)})
            `,
            targetIds
        );

        await reindexGroupPositionsTx(transactionDb, affectedGroupIds);
        await touchGroupsTx(transactionDb, affectedGroupIds);

        const remainingCount = Math.max(0, totalMatched - targetIds.length);
        return {
            dryRun: false,
            domain: scope.normalizedDomain,
            olderThanDays: scope.olderThanDays,
            limit,
            matched: totalMatched,
            selected: targetIds.length,
            deleted: result.changes || 0,
            hasMore: remainingCount > 0,
            remaining: remainingCount,
            affectedGroups: affectedGroupIds.length,
            oldestReceivedAt: aggregate?.oldest_received_at || null,
            newestReceivedAt: aggregate?.newest_received_at || null
        };
    });

    result.vacuum = await vacuumDatabase(config);
    return result;
}

export { assertRegisteredMailboxPermission };
