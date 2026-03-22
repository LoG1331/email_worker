import { getDb, withTransaction } from '../db/index.mjs';
import { assertRegisteredMailboxPermission } from './email-service.mjs';
import { getAuthorizedEmailsByIds } from './email-service.mjs';
import { parseEmailAddress } from '../utils/email.mjs';
import { HttpError } from '../utils/http.mjs';
import { decodeCursor, encodeCursor } from '../utils/cursor.mjs';

function cleanText(value) {
    return String(value ?? '').trim();
}

function nowIso() {
    return new Date().toISOString();
}

function parseNumericId(value, label = 'id') {
    const numericValue = Number.parseInt(String(value), 10);
    if (!Number.isInteger(numericValue) || numericValue <= 0) {
        throw new HttpError(400, `Valid ${label} is required`);
    }

    return numericValue;
}

function normalizeColor(value) {
    const normalized = cleanText(value);
    if (!normalized) {
        return '#3B82F6';
    }

    if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) {
        throw new HttpError(400, 'Invalid color value');
    }

    return normalized;
}

function normalizeEmailIds(emailIds, { allowEmpty = false, max = 200 } = {}) {
    if (!Array.isArray(emailIds)) {
        throw new HttpError(400, 'emailIds must be an array');
    }

    const ids = [...new Set(emailIds.map(value => parseNumericId(value, 'email id')))];
    if (!allowEmpty && !ids.length) {
        throw new HttpError(400, 'At least one email id is required');
    }

    if (ids.length > max) {
        throw new HttpError(400, `Maximum ${max} email ids are allowed per request`);
    }

    return ids;
}

function normalizeEmailAddresses(emailAddresses, { allowEmpty = false, max = 200 } = {}) {
    if (!Array.isArray(emailAddresses)) {
        throw new HttpError(400, 'emailAddresses must be an array');
    }

    const addresses = [...new Set(
        emailAddresses
            .map((value) => {
                const parsed = parseEmailAddress(value);
                if (!parsed) {
                    throw new HttpError(400, `Invalid email address: ${value}`);
                }

                return parsed.email;
            })
    )];

    if (!allowEmpty && !addresses.length) {
        throw new HttpError(400, 'At least one email address is required');
    }

    if (addresses.length > max) {
        throw new HttpError(400, `Maximum ${max} email addresses are allowed per request`);
    }

    return addresses;
}

function parseGroupEmailCursor(cursor) {
    if (!cursor) {
        return null;
    }

    const payload = decodeCursor(cursor, 'Invalid group email cursor');
    const position = Number.parseInt(String(payload?.position ?? ''), 10);
    const linkId = Number.parseInt(String(payload?.linkId ?? ''), 10);
    if (!Number.isInteger(position) || position < 0 || !Number.isInteger(linkId) || linkId <= 0) {
        throw new HttpError(400, 'Invalid group email cursor');
    }

    return {
        position,
        linkId
    };
}

function mapGroupRow(row) {
    return {
        id: row.id,
        ownerUserId: row.owner_user_id,
        owner: row.owner_username ? {
            id: row.owner_user_id,
            username: row.owner_username,
            displayName: row.owner_display_name
        } : null,
        name: row.name,
        color: row.color,
        description: row.description,
        emailCount: row.email_count || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function getGroupRecordForActor(db, auth, groupId) {
    const numericGroupId = parseNumericId(groupId, 'group id');
    const ownerUserId = parseNumericId(auth?.userId, 'user id');

    const row = await db.get(
        `
            SELECT
                g.*,
                u.username AS owner_username,
                u.display_name AS owner_display_name,
                COUNT(ge.id) AS email_count
            FROM groups g
            JOIN users u ON u.id = g.owner_user_id
            LEFT JOIN group_emails ge ON ge.group_id = g.id
            WHERE g.id = ?
              AND g.owner_user_id = ?
            GROUP BY g.id, u.username, u.display_name
            LIMIT 1
        `,
        [numericGroupId, ownerUserId]
    );

    if (!row) {
        throw new HttpError(404, 'Group not found');
    }

    return row;
}

async function getMaxGroupPosition(db, groupId) {
    const row = await db.get(
        `
            SELECT COALESCE(MAX(position), 0) AS max_position
            FROM group_emails
            WHERE group_id = ?
        `,
        [groupId]
    );

    return Number(row?.max_position || 0);
}

async function insertGroupEmailIdsTx(db, groupId, emailIds, addedByUserId) {
    let position = await getMaxGroupPosition(db, groupId);
    const timestamp = nowIso();

    for (const emailId of emailIds) {
        const existing = await db.get(
            `
                SELECT id
                FROM group_emails
                WHERE group_id = ?
                  AND email_id = ?
                LIMIT 1
            `,
            [groupId, emailId]
        );

        if (existing) {
            continue;
        }

        position += 1;
        await db.run(
            `
                INSERT INTO group_emails (
                    group_id,
                    email_id,
                    position,
                    added_at,
                    added_by_user_id
                )
                VALUES (?, ?, ?, ?, ?)
            `,
            [groupId, emailId, position, timestamp, addedByUserId || null]
        );
    }
}

async function assertEmailIdsAccessible(config, auth, ownerUserId, emailIds) {
    const result = await getAuthorizedEmailsByIds(config, auth, emailIds, {
        allowEmpty: true,
        permission: 'view',
        userId: ownerUserId
    });

    if (result.missingIds.length || result.deniedIds.length) {
        throw new HttpError(403, 'Some email ids are missing or inaccessible', {
            missingIds: result.missingIds,
            deniedIds: result.deniedIds
        });
    }
}

async function ensureMailboxRegistrationsForOwnerTx(config, db, auth, ownerUserId, emailAddresses) {
    const normalizedAddresses = normalizeEmailAddresses(emailAddresses);
    const timestamp = nowIso();

    for (const emailAddress of normalizedAddresses) {
        await assertRegisteredMailboxPermission(config, auth, emailAddress, 'view', {
            userId: ownerUserId,
            requireRegistration: false
        });

        const existing = await db.get(
            `
                SELECT id, owner_user_id
                FROM email_registers
                WHERE recipient_address = ?
                LIMIT 1
            `,
            [emailAddress]
        );

        if (existing) {
            if (existing.owner_user_id !== ownerUserId) {
                throw new HttpError(409, 'Email address is already registered by another user', {
                    emailAddress
                });
            }

            await db.run(
                `
                    UPDATE email_registers
                    SET updated_at = ?
                    WHERE id = ?
                `,
                [timestamp, existing.id]
            );
            continue;
        }

        const parsedAddress = parseEmailAddress(emailAddress);
        const domain = await db.get(
            `
                SELECT id
                FROM domains
                WHERE name = ?
                LIMIT 1
            `,
            [parsedAddress.domain]
        );

        if (!domain) {
            throw new HttpError(404, 'Domain not found for email registration', {
                emailAddress
            });
        }

        await db.run(
            `
                INSERT INTO email_registers (
                    owner_user_id,
                    domain_id,
                    recipient_address,
                    local_part,
                    recipient_domain,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                ownerUserId,
                domain.id,
                parsedAddress.email,
                parsedAddress.localPart,
                parsedAddress.domain,
                timestamp,
                timestamp
            ]
        );
    }

    return normalizedAddresses;
}

async function getEmailIdsByAddressesTx(db, emailAddresses) {
    if (!emailAddresses.length) {
        return [];
    }

    const rows = await db.all(
        `
            SELECT id
            FROM emails
            WHERE recipient_address IN (${emailAddresses.map(() => '?').join(', ')})
            ORDER BY received_at DESC, id DESC
        `,
        emailAddresses
    );

    return [...new Set(rows.map((row) => row.id))];
}

export async function listGroups(config, auth, pagination = {}) {
    const ownerUserId = parseNumericId(auth?.userId, 'user id');
    const db = await getDb(config);
    const limit = pagination.limit || 50;
    const offset = pagination.offset || 0;
    const [rows, totalRow] = await Promise.all([
        db.all(
        `
            SELECT
                g.*,
                u.username AS owner_username,
                u.display_name AS owner_display_name,
                COUNT(ge.id) AS email_count
            FROM groups g
            JOIN users u ON u.id = g.owner_user_id
            LEFT JOIN group_emails ge ON ge.group_id = g.id
            WHERE g.owner_user_id = ?
            GROUP BY g.id, u.username, u.display_name
            ORDER BY g.updated_at DESC, g.id DESC
            LIMIT ? OFFSET ?
        `,
            [ownerUserId, limit, offset]
        ),
        db.get(
            `
                SELECT COUNT(*) AS total
                FROM groups g
                WHERE g.owner_user_id = ?
            `,
            [ownerUserId]
        )
    ]);

    return {
        total: totalRow?.total || 0,
        groups: rows.map(mapGroupRow)
    };
}

export async function getGroup(config, auth, groupId) {
    const db = await getDb(config);
    const row = await getGroupRecordForActor(db, auth, groupId);
    return mapGroupRow(row);
}

export async function createGroup(config, auth, payload) {
    const name = cleanText(payload.name);
    if (!name) {
        throw new HttpError(400, 'name is required');
    }

    const ownerUserId = parseNumericId(auth?.userId, 'user id');
    const color = normalizeColor(payload.color);
    const description = cleanText(payload.description);
    let groupId = null;

    await withTransaction(config, async (db) => {
        try {
            const result = await db.run(
                `
                    INSERT INTO groups (
                        owner_user_id,
                        name,
                        color,
                        description,
                        created_at,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                `,
                [ownerUserId, name, color, description, nowIso(), nowIso()]
            );

            groupId = result.lastID;
        } catch (error) {
            if (String(error?.message || '').toLowerCase().includes('unique')) {
                throw new HttpError(409, 'Group name already exists for this user');
            }

            throw error;
        }
    });

    return getGroup(config, auth, groupId);
}

export async function updateGroup(config, auth, groupId, payload) {
    await withTransaction(config, async (db) => {
        const group = await getGroupRecordForActor(db, auth, groupId);
        const nextName = payload.name === undefined ? group.name : cleanText(payload.name);
        if (!nextName) {
            throw new HttpError(400, 'name is required');
        }

        const nextColor = payload.color === undefined ? group.color : normalizeColor(payload.color);
        const nextDescription = payload.description === undefined ? group.description : cleanText(payload.description);

        try {
            await db.run(
                `
                    UPDATE groups
                    SET name = ?,
                        color = ?,
                        description = ?,
                        updated_at = ?
                    WHERE id = ?
                `,
                [nextName, nextColor, nextDescription, nowIso(), group.id]
            );
        } catch (error) {
            if (String(error?.message || '').toLowerCase().includes('unique')) {
                throw new HttpError(409, 'Group name already exists for this user');
            }

            throw error;
        }
    });

    return getGroup(config, auth, groupId);
}

export async function deleteGroup(config, auth, groupId) {
    const db = await getDb(config);
    const group = await getGroupRecordForActor(db, auth, groupId);
    await db.run(`DELETE FROM groups WHERE id = ?`, [group.id]);
    return { success: true };
}

export async function listGroupEmails(config, auth, groupId, pagination = {}) {
    const limit = pagination.limit || 100;
    const cursor = parseGroupEmailCursor(pagination.cursor);
    const includeRawMime = pagination.includeRawMime === true;

    const db = await getDb(config);
    const group = await getGroupRecordForActor(db, auth, groupId);
    const cursorClause = cursor
        ? ` AND (position > ? OR (position = ? AND id > ?))`
        : '';
    const cursorValues = cursor ? [cursor.position, cursor.position, cursor.linkId] : [];
    const groupEmailRows = await db.all(
            `
                SELECT
                    id,
                    email_id,
                    position,
                    added_at,
                    added_by_user_id
                FROM group_emails
                WHERE group_id = ?
                ${cursorClause}
                ORDER BY position ASC, id ASC
                LIMIT ?
            `,
            [group.id, ...cursorValues, limit + 1]
        );

    const pageRows = groupEmailRows.slice(0, limit);
    const emailIds = pageRows.map(row => row.email_id);
    const batchResult = await getAuthorizedEmailsByIds(config, auth, emailIds, {
        allowEmpty: true,
        includeRawMime,
        permission: 'view',
        userId: group.owner_user_id
    });

    const prunableIds = [...batchResult.missingIds, ...batchResult.deniedIds];
    if (prunableIds.length) {
        await withTransaction(config, async (transactionDb) => {
            await transactionDb.run(
                `
                    DELETE FROM group_emails
                    WHERE group_id = ?
                      AND email_id IN (${prunableIds.map(() => '?').join(', ')})
                `,
                [group.id, ...prunableIds]
            );

            const remainingRows = await transactionDb.all(
                `
                    SELECT id
                    FROM group_emails
                    WHERE group_id = ?
                    ORDER BY position ASC, id ASC
                `,
                [group.id]
            );

            let position = 0;
            for (const row of remainingRows) {
                position += 1;
                await transactionDb.run(
                    `
                        UPDATE group_emails
                        SET position = ?
                        WHERE id = ?
                    `,
                    [position, row.id]
                );
            }

            await transactionDb.run(
                `
                    UPDATE groups
                    SET updated_at = ?
                    WHERE id = ?
                `,
                [nowIso(), group.id]
            );
        });

        throw new HttpError(409, 'Group contained inaccessible emails; denied or stale ids were removed', {
            missingIds: batchResult.missingIds,
            deniedIds: batchResult.deniedIds,
            prunedIds: prunableIds
        });
    }

    const emailsById = new Map(batchResult.emails.map(email => [email.id, email]));
    const emails = pageRows
        .map(row => {
            const email = emailsById.get(row.email_id);
            if (!email) {
                return null;
            }

            return {
                ...email,
                groupPosition: row.position,
                groupAddedAt: row.added_at,
                groupAddedByUserId: row.added_by_user_id
            };
        })
        .filter(Boolean);

    const lastRow = pageRows[pageRows.length - 1];
    return {
        group: mapGroupRow(group),
        count: emails.length,
        emails,
        hasMore: groupEmailRows.length > limit,
        nextCursor: groupEmailRows.length > limit && lastRow
            ? encodeCursor({
                position: lastRow.position,
                linkId: lastRow.id
            })
            : null
    };
}

export async function addEmailsToGroup(config, auth, groupId, payload = {}) {
    const normalizedEmailIds = payload.emailAddresses?.length
        ? null
        : normalizeEmailIds(payload.emailIds);

    await withTransaction(config, async (db) => {
        const group = await getGroupRecordForActor(db, auth, groupId);
        const resolvedEmailIds = payload.emailAddresses?.length
            ? await getEmailIdsByAddressesTx(
                db,
                await ensureMailboxRegistrationsForOwnerTx(config, db, auth, group.owner_user_id, payload.emailAddresses)
            )
            : normalizedEmailIds;

        await assertEmailIdsAccessible(config, auth, group.owner_user_id, resolvedEmailIds);
        await insertGroupEmailIdsTx(db, group.id, resolvedEmailIds, auth?.userId || null);
        await db.run(
            `
                UPDATE groups
                SET updated_at = ?
                WHERE id = ?
            `,
            [nowIso(), group.id]
        );
    });

    return listGroupEmails(config, auth, groupId, {
        limit: 100
    });
}

export async function removeEmailFromGroup(config, auth, groupId, emailId) {
    const numericEmailId = parseNumericId(emailId, 'email id');
    await withTransaction(config, async (db) => {
        const group = await getGroupRecordForActor(db, auth, groupId);
        await db.run(
            `
                DELETE FROM group_emails
                WHERE group_id = ?
                  AND email_id = ?
            `,
            [group.id, numericEmailId]
        );

        const remainingRows = await db.all(
            `
                SELECT id
                FROM group_emails
                WHERE group_id = ?
                ORDER BY position ASC, id ASC
            `,
            [group.id]
        );

        let position = 0;
        for (const row of remainingRows) {
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

        await db.run(
            `
                UPDATE groups
                SET updated_at = ?
                WHERE id = ?
            `,
            [nowIso(), group.id]
        );
    });

    return { success: true };
}
