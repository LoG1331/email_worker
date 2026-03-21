import { getDb, withTransaction } from '../db/index.mjs';
import { ensureMailboxPermission, hasGlobalPermission } from './account-service.mjs';
import { parseEmailAddress } from '../utils/email.mjs';
import { HttpError } from '../utils/http.mjs';

function nowIso() {
    return new Date().toISOString();
}

function parseNumericId(value, label = 'id') {
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new HttpError(400, `Valid ${label} is required`);
    }

    return parsed;
}

function resolveOwnerUserId(auth, filters = {}) {
    if (hasGlobalPermission(auth) && filters.ownerUserId) {
        return parseNumericId(filters.ownerUserId, 'owner user id');
    }

    return parseNumericId(auth?.userId, 'user id');
}

function mapEmailRegisterRow(row) {
    return {
        id: row.id,
        ownerUserId: row.owner_user_id,
        owner: row.owner_username ? {
            id: row.owner_user_id,
            username: row.owner_username,
            displayName: row.owner_display_name
        } : null,
        emailAddress: row.recipient_address,
        localPart: row.local_part,
        domain: row.recipient_domain,
        emailCount: row.email_count || 0,
        latestReceivedAt: row.latest_received_at || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function getEmailRegisterRowForActor(db, auth, registrationId) {
    const numericRegistrationId = parseNumericId(registrationId, 'registration id');
    const values = [numericRegistrationId];
    let whereClause = 'er.id = ?';

    if (!hasGlobalPermission(auth)) {
        whereClause += ' AND er.owner_user_id = ?';
        values.push(parseNumericId(auth?.userId, 'user id'));
    }

    const row = await db.get(
        `
            SELECT
                er.*,
                u.username AS owner_username,
                u.display_name AS owner_display_name,
                COUNT(e.id) AS email_count,
                MAX(e.received_at) AS latest_received_at
            FROM email_registers er
            JOIN users u ON u.id = er.owner_user_id
            LEFT JOIN emails e ON e.recipient_address = er.recipient_address
            WHERE ${whereClause}
            GROUP BY er.id, u.username, u.display_name
            LIMIT 1
        `,
        values
    );

    if (!row) {
        throw new HttpError(404, 'Email registration not found');
    }

    return row;
}

async function reindexGroupPositionsTx(db, groupIds) {
    for (const groupId of groupIds) {
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

export async function listEmailRegisters(config, auth, filters = {}) {
    const ownerUserId = resolveOwnerUserId(auth, filters);
    const db = await getDb(config);
    const rows = await db.all(
        `
            SELECT
                er.*,
                u.username AS owner_username,
                u.display_name AS owner_display_name,
                COUNT(e.id) AS email_count,
                MAX(e.received_at) AS latest_received_at
            FROM email_registers er
            JOIN users u ON u.id = er.owner_user_id
            LEFT JOIN emails e ON e.recipient_address = er.recipient_address
            WHERE er.owner_user_id = ?
            GROUP BY er.id, u.username, u.display_name
            ORDER BY er.updated_at DESC, er.id DESC
        `,
        [ownerUserId]
    );

    return rows.map(mapEmailRegisterRow);
}

export async function createEmailRegister(config, auth, payload) {
    const parsedAddress = parseEmailAddress(payload.emailAddress);
    if (!parsedAddress) {
        throw new HttpError(400, 'Valid email address is required');
    }

    await ensureMailboxPermission(config, auth, parsedAddress.email, 'view');

    const ownerUserId = parseNumericId(auth?.userId, 'user id');
    let registrationId = null;

    await withTransaction(config, async (db) => {
        const existing = await db.get(
            `
                SELECT id, owner_user_id
                FROM email_registers
                WHERE recipient_address = ?
                LIMIT 1
            `,
            [parsedAddress.email]
        );

        if (existing) {
            if (existing.owner_user_id === ownerUserId) {
                await db.run(
                    `
                        UPDATE email_registers
                        SET updated_at = ?
                        WHERE id = ?
                    `,
                    [nowIso(), existing.id]
                );
                registrationId = existing.id;
                return;
            }

            throw new HttpError(409, 'Email address is already registered by another user');
        }

        const domain = await db.get(
            `
                SELECT id, name
                FROM domains
                WHERE name = ?
                LIMIT 1
            `,
            [parsedAddress.domain]
        );

        if (!domain) {
            throw new HttpError(404, 'Domain not found for email registration');
        }

        const timestamp = nowIso();
        const result = await db.run(
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

        registrationId = result.lastID;
    });

    const db = await getDb(config);
    const row = await getEmailRegisterRowForActor(db, auth, registrationId);
    return mapEmailRegisterRow(row);
}

export async function deleteEmailRegister(config, auth, registrationId) {
    await withTransaction(config, async (db) => {
        const registration = await getEmailRegisterRowForActor(db, auth, registrationId);
        const affectedGroups = await db.all(
            `
                SELECT DISTINCT g.id
                FROM groups g
                JOIN group_emails ge ON ge.group_id = g.id
                JOIN emails e ON e.id = ge.email_id
                WHERE g.owner_user_id = ?
                  AND e.recipient_address = ?
            `,
            [registration.owner_user_id, registration.recipient_address]
        );

        await db.run(`DELETE FROM email_registers WHERE id = ?`, [registration.id]);

        if (!affectedGroups.length) {
            return;
        }

        await db.run(
            `
                DELETE FROM group_emails
                WHERE group_id IN (
                    SELECT id
                    FROM groups
                    WHERE owner_user_id = ?
                )
                  AND email_id IN (
                    SELECT id
                    FROM emails
                    WHERE recipient_address = ?
                )
            `,
            [registration.owner_user_id, registration.recipient_address]
        );

        const affectedGroupIds = affectedGroups.map(row => row.id);
        await reindexGroupPositionsTx(db, affectedGroupIds);
        await db.run(
            `
                UPDATE groups
                SET updated_at = ?
                WHERE id IN (${affectedGroupIds.map(() => '?').join(', ')})
            `,
            [nowIso(), ...affectedGroupIds]
        );
    });

    return { success: true };
}
