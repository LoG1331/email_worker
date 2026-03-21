import { getDb, withTransaction } from '../db/index.mjs';
import { hasGlobalPermission } from './account-service.mjs';
import { getAuthorizedEmailsByIds } from './email-service.mjs';
import { HttpError } from '../utils/http.mjs';

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
    const values = [numericGroupId];
    let whereClause = `g.id = ?`;

    if (!hasGlobalPermission(auth)) {
        whereClause += ` AND g.owner_user_id = ?`;
        values.push(auth?.userId || 0);
    }

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
            WHERE ${whereClause}
            GROUP BY g.id, u.username, u.display_name
            LIMIT 1
        `,
        values
    );

    if (!row) {
        throw new HttpError(404, 'Group not found');
    }

    return row;
}

function getListOwnerUserId(auth, filters = {}) {
    if (hasGlobalPermission(auth) && filters.ownerUserId) {
        return parseNumericId(filters.ownerUserId, 'owner user id');
    }

    return parseNumericId(auth?.userId, 'user id');
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

export async function listGroups(config, auth, filters = {}) {
    const ownerUserId = getListOwnerUserId(auth, filters);
    const db = await getDb(config);
    const rows = await db.all(
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
        `,
        [ownerUserId]
    );

    return rows.map(mapGroupRow);
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
    const offset = pagination.offset || 0;
    const includeRawMime = pagination.includeRawMime === true;

    const db = await getDb(config);
    const group = await getGroupRecordForActor(db, auth, groupId);
    const [groupEmailRows, totalRow] = await Promise.all([
        db.all(
            `
                SELECT
                    email_id,
                    position,
                    added_at,
                    added_by_user_id
                FROM group_emails
                WHERE group_id = ?
                ORDER BY position ASC, id ASC
                LIMIT ? OFFSET ?
            `,
            [group.id, limit, offset]
        ),
        db.get(
            `
                SELECT COUNT(*) AS total
                FROM group_emails
                WHERE group_id = ?
            `,
            [group.id]
        )
    ]);

    const emailIds = groupEmailRows.map(row => row.email_id);
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
    return {
        group: mapGroupRow(group),
        total: totalRow?.total || 0,
        count: batchResult.emails.length,
        emails: groupEmailRows
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
            .filter(Boolean)
    };
}

export async function addEmailsToGroup(config, auth, groupId, emailIds) {
    const normalizedEmailIds = normalizeEmailIds(emailIds);

    await withTransaction(config, async (db) => {
        const group = await getGroupRecordForActor(db, auth, groupId);
        await assertEmailIdsAccessible(config, auth, group.owner_user_id, normalizedEmailIds);
        await insertGroupEmailIdsTx(db, group.id, normalizedEmailIds, auth?.userId || null);
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
        limit: 100,
        offset: 0
    });
}

export async function replaceGroupEmails(config, auth, groupId, emailIds) {
    const normalizedEmailIds = normalizeEmailIds(emailIds, {
        allowEmpty: true
    });

    await withTransaction(config, async (db) => {
        const group = await getGroupRecordForActor(db, auth, groupId);
        await assertEmailIdsAccessible(config, auth, group.owner_user_id, normalizedEmailIds);
        await db.run(`DELETE FROM group_emails WHERE group_id = ?`, [group.id]);

        let position = 0;
        const timestamp = nowIso();
        for (const emailId of normalizedEmailIds) {
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
                [group.id, emailId, position, timestamp, auth?.userId || null]
            );
        }

        await db.run(
            `
                UPDATE groups
                SET updated_at = ?
                WHERE id = ?
            `,
            [timestamp, group.id]
        );
    });

    return listGroupEmails(config, auth, groupId, {
        limit: Math.max(normalizedEmailIds.length, 1),
        offset: 0
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
