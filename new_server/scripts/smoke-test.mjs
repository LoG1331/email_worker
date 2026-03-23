import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/app.mjs';
import { loadConfig } from '../src/config.mjs';
import { closeDb, getDb, maybePruneStoredRawMime } from '../src/db/index.mjs';
import { ensureBootstrapAdmin, revokeExpiredSessions } from '../src/services/account-service.mjs';
import { ensureAuthSecrets } from '../src/services/auth-secrets-service.mjs';
import { getTelegramSettings } from '../src/services/telegram-settings-service.mjs';
import { startTelegramRuntime, stopTelegramRuntime } from '../src/telegram/runtime.mjs';

function createMimeMessage({ to, subject, messageId, text }) {
    return [
        'From: Sender <sender@example.net>',
        `To: ${to}`,
        `Subject: ${subject}`,
        `Message-ID: <${messageId}>`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        text
    ].join('\r\n');
}

function base64UrlEncode(value) {
    const buffer = Buffer.isBuffer(value)
        ? value
        : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
    return buffer.toString('base64url');
}

function signJwtForTest(secret, payload, expiresAtMs) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const fullPayload = {
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(expiresAtMs / 1000)
    };
    const signingInput = `${base64UrlEncode(header)}.${base64UrlEncode(fullPayload)}`;
    const signature = createHmac('sha256', secret)
        .update(signingInput)
        .digest('base64url');
    return `${signingInput}.${signature}`;
}

async function request(baseUrl, pathname, {
    method = 'GET',
    json,
    body,
    token,
    apiKey,
    headers = {}
} = {}) {
    const requestHeaders = new Headers(headers);

    if (token) {
        requestHeaders.set('Authorization', `Bearer ${token}`);
    }

    if (apiKey) {
        requestHeaders.set('X-Api-Key', apiKey);
    }

    let requestBody = body;
    if (json !== undefined) {
        requestHeaders.set('Content-Type', 'application/json');
        requestBody = JSON.stringify(json);
    }

    const response = await fetch(`${baseUrl}${pathname}`, {
        method,
        headers: requestHeaders,
        body: requestBody
    });

    const text = await response.text();
    let payload = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = text;
        }
    }

    return {
        status: response.status,
        body: payload
    };
}

function assertStatus(response, expectedStatus, label) {
    assert.equal(
        response.status,
        expectedStatus,
        `${label} failed with ${response.status}: ${JSON.stringify(response.body)}`
    );
}

async function startServer(config) {
    await getDb(config);
    await ensureAuthSecrets(config);
    await maybePruneStoredRawMime(config, { force: true });
    await revokeExpiredSessions(config);
    await ensureBootstrapAdmin(config);
    await startTelegramRuntime(config);

    const app = createApp(config);
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to resolve smoke test server address');
    }

    return {
        server,
        baseUrl: `http://127.0.0.1:${address.port}`
    };
}

async function stopServer(server) {
    if (!server) {
        return;
    }

    await new Promise((resolve, reject) => {
        server.close(error => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

async function startFakeTelegramApi() {
    const calls = [];
    let nextMessageId = 1000;
    const state = {
        failSendMessageCount: 0,
        failMethodCounts: {}
    };

    const server = createHttpServer(async (req, res) => {
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }

        const bodyText = Buffer.concat(chunks).toString('utf8');
        let body = null;
        if (bodyText) {
            body = JSON.parse(bodyText);
        }

        const match = req.url?.match(/^\/bot[^/]+\/([^/?]+)/);
        const method = match?.[1] || 'unknown';
        calls.push({
            method,
            body
        });

        if ((state.failMethodCounts[method] || 0) > 0) {
            state.failMethodCounts[method] -= 1;
            res.writeHead(500, {
                'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({
                ok: false,
                description: `forced ${method} failure`
            }));
            return;
        }

        if (method === 'sendMessage' && state.failSendMessageCount > 0) {
            state.failSendMessageCount -= 1;
            res.writeHead(500, {
                'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({
                ok: false,
                description: 'forced sendMessage failure'
            }));
            return;
        }

        let result = true;
        if (method === 'sendMessage' || method === 'editMessageText') {
            result = {
                message_id: nextMessageId++,
                text: body?.text || ''
            };
        }

        res.writeHead(200, {
            'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({
            ok: true,
            result
        }));
    });

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to resolve fake Telegram API address');
    }

    return {
        server,
        calls,
        state,
        baseUrl: `http://127.0.0.1:${address.port}`
    };
}

async function waitFor(predicate, timeoutMs = 2000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (predicate()) {
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 25));
    }

    throw new Error('Timed out waiting for async condition');
}

async function main() {
    const tempRoot = await mkdtemp(path.join(tmpdir(), 'email-worker-new-server-'));
    let server;
    let fakeTelegram;

    try {
        fakeTelegram = await startFakeTelegramApi();
        const config = loadConfig({
            NODE_ENV: 'test',
            HOST: '127.0.0.1',
            INBOUND_AUTH_TOKEN: 'smoke-inbound-token',
            NEW_SERVER_SQLITE_PATH: path.join(tempRoot, 'smoke.sqlite'),
            STORE_RAW_MIME: '0',
            BOOTSTRAP_ADMIN_USERNAME: 'admin',
            BOOTSTRAP_ADMIN_PASSWORD: 'admin-pass-123'
        });
        config.telegramApiBaseUrl = fakeTelegram.baseUrl;
        config.telegramOutboxPollIntervalMs = 50;
        config.telegramOutboxBaseBackoffMs = 50;

        const started = await startServer(config);
        server = started.server;
        const { baseUrl } = started;

        const health = await request(baseUrl, '/health');
        assertStatus(health, 200, 'health');
        assert.equal(health.body.ok, true);
        assert.equal(health.body.service, 'new_server');
        assert.ok(typeof health.body.systemTime === 'string');
        assert.ok(Number.isInteger(health.body.systemTimeMs));
        assert.equal(health.body.storage.engine, 'sqlite');
        assert.equal(health.body.storage.ready, true);
        assert.equal('sqlitePath' in health.body, false);
        assert.equal(health.body.telegram.enabled, false);
        assert.equal(fakeTelegram.calls.length, 0);

        const adminPassword = 'admin-pass-123';
        let adminToken = '';
        const adminLogin = await request(baseUrl, '/v1/auth/login', {
            method: 'POST',
            json: {
                username: 'admin',
                password: adminPassword
            }
        });
        assertStatus(adminLogin, 200, 'admin login');
        adminToken = adminLogin.body.sessionToken;
        assert.ok(adminToken);
        assert.equal(adminLogin.body.account.isAdmin, true);
        const adminUserId = adminLogin.body.account.id;

        const forgedAdminSession = await request(baseUrl, '/v1/auth/me', {
            token: signJwtForTest(config.inboundAuthToken, {
                token_type: 'session',
                sub: String(adminLogin.body.account.id),
                sid: String(adminLogin.body.session.id)
            }, Date.now() + 60 * 60 * 1000)
        });
        assertStatus(forgedAdminSession, 401, 'inbound token cannot forge session jwt');

        const adminProfileUpdate = await request(baseUrl, '/v1/auth/me', {
            method: 'PATCH',
            token: adminToken,
            json: {
                displayName: 'Admin Smoke',
                telegramId: '555555555'
            }
        });
        assertStatus(adminProfileUpdate, 200, 'admin updates own profile');
        assert.equal(adminProfileUpdate.body.account.telegramId, '555555555');

        const adminPasswordChange = await request(baseUrl, '/v1/auth/me/password', {
            method: 'POST',
            token: adminToken,
            json: {
                currentPassword: adminPassword,
                newPassword: 'admin-pass-456'
            }
        });
        assertStatus(adminPasswordChange, 200, 'admin changes own password');

        await ensureBootstrapAdmin(config);

        const adminOldPasswordLogin = await request(baseUrl, '/v1/auth/login', {
            method: 'POST',
            json: {
                username: 'admin',
                password: adminPassword
            }
        });
        assertStatus(adminOldPasswordLogin, 401, 'bootstrap rerun does not reset existing admin password');

        const adminLoginAfterBootstrapRerun = await request(baseUrl, '/v1/auth/login', {
            method: 'POST',
            json: {
                username: 'admin',
                password: 'admin-pass-456'
            }
        });
        assertStatus(adminLoginAfterBootstrapRerun, 200, 'admin login after bootstrap rerun');
        adminToken = adminLoginAfterBootstrapRerun.body.sessionToken;
        assert.equal(adminLoginAfterBootstrapRerun.body.account.telegramId, '555555555');

        const configureTelegram = await request(baseUrl, '/v1/system/telegram', {
            method: 'PATCH',
            token: adminToken,
            json: {
                enabled: true,
                publicBaseUrl: 'https://example.test',
                botToken: 'smoke-telegram-token'
            }
        });
        assertStatus(configureTelegram, 200, 'configure telegram via admin api');
        assert.equal(configureTelegram.body.settings.enabled, true);
        assert.equal(configureTelegram.body.settings.publicBaseUrl, 'https://example.test');
        assert.equal(configureTelegram.body.settings.botTokenConfigured, true);
        assert.match(String(configureTelegram.body.settings.botTokenMasked || ''), /smoke-/);
        assert.equal(fakeTelegram.calls[0]?.method, 'setWebhook');
        assert.equal(fakeTelegram.calls[0]?.body?.url, 'https://example.test/v1/telegram/webhook');

        const telegramSettings = await getTelegramSettings(config);
        assert.ok(telegramSettings.webhookSecret);
        assert.ok(!('botToken' in configureTelegram.body.runtime.settings) || configureTelegram.body.runtime.settings.botTokenConfigured === true);

        fakeTelegram.state.failMethodCounts.setWebhook = 1;
        const brokenTelegramReload = await request(baseUrl, '/v1/system/telegram', {
            method: 'PATCH',
            token: adminToken,
            json: {
                publicBaseUrl: 'https://broken.example.test'
            }
        });
        assertStatus(brokenTelegramReload, 502, 'telegram runtime reload rollback');
        assert.equal(brokenTelegramReload.body.rolledBack, true);
        assert.equal(brokenTelegramReload.body.rollbackError, null);
        assert.equal(brokenTelegramReload.body.settings.publicBaseUrl, 'https://example.test');
        assert.equal(brokenTelegramReload.body.runtime.enabled, true);
        assert.equal(brokenTelegramReload.body.runtime.workerActive, true);
        assert.equal(brokenTelegramReload.body.runtime.webhookUrl, 'https://example.test/v1/telegram/webhook');
        assert.equal(fakeTelegram.calls[1]?.method, 'setWebhook');
        assert.equal(fakeTelegram.calls[1]?.body?.url, 'https://broken.example.test/v1/telegram/webhook');
        assert.equal(fakeTelegram.calls[2]?.method, 'setWebhook');
        assert.equal(fakeTelegram.calls[2]?.body?.url, 'https://example.test/v1/telegram/webhook');

        const registerCommands = await request(baseUrl, '/v1/system/telegram/commands/register', {
            method: 'POST',
            token: adminToken
        });
        assertStatus(registerCommands, 200, 'register telegram commands');
        assert.equal(registerCommands.body.count, 11);
        assert.equal(fakeTelegram.calls[3]?.method, 'setMyCommands');
        assert.equal(Array.isArray(fakeTelegram.calls[3]?.body?.commands), true);
        assert.equal(fakeTelegram.calls[3]?.body?.commands[0]?.command, 'start');

        const createDomain = await request(baseUrl, '/v1/domains', {
            method: 'POST',
            token: adminToken,
            json: {
                domain: 'example.com',
                description: 'Smoke test domain'
            }
        });
        assertStatus(createDomain, 201, 'create domain');
        assert.equal(createDomain.body.domain.domain, 'example.com');

        const createDuplicateDomain = await request(baseUrl, '/v1/domains', {
            method: 'POST',
            token: adminToken,
            json: {
                domain: 'example.com',
                description: 'Duplicate domain'
            }
        });
        assertStatus(createDuplicateDomain, 409, 'duplicate domain create rejected');

        const patchDomainRemoved = await request(baseUrl, '/v1/domains/example.com', {
            method: 'PATCH',
            token: adminToken,
            json: {
                description: 'No longer supported'
            }
        });
        assertStatus(patchDomainRemoved, 404, 'domain patch removed');

        const createInvalidDomain = await request(baseUrl, '/v1/domains', {
            method: 'POST',
            token: adminToken,
            json: {
                domain: '-invalid..domain-',
                description: 'Should fail'
            }
        });
        assertStatus(createInvalidDomain, 400, 'create invalid domain');

        const createCleanupDomain = await request(baseUrl, '/v1/domains', {
            method: 'POST',
            token: adminToken,
            json: {
                domain: 'cleanup.test',
                description: 'Cascade cleanup domain'
            }
        });
        assertStatus(createCleanupDomain, 201, 'create cleanup domain');

        const registerMissingDomainMailbox = await request(baseUrl, '/v1/email-registers', {
            method: 'POST',
            token: adminToken,
            json: {
                emailAddress: 'ghost@missing.test'
            }
        });
        assertStatus(registerMissingDomainMailbox, 404, 'register mailbox requires existing domain');

        const createDisabledDomain = await request(baseUrl, '/v1/domains', {
            method: 'POST',
            token: adminToken,
            json: {
                domain: 'disabled.test',
                description: 'Disabled domain',
                status: 'disabled'
            }
        });
        assertStatus(createDisabledDomain, 201, 'create disabled domain');

        const registerDisabledDomainMailbox = await request(baseUrl, '/v1/email-registers', {
            method: 'POST',
            token: adminToken,
            json: {
                emailAddress: 'norecv@disabled.test'
            }
        });
        assertStatus(registerDisabledDomainMailbox, 409, 'register mailbox blocked on disabled domain');

        const createInboundOffDomain = await request(baseUrl, '/v1/domains', {
            method: 'POST',
            token: adminToken,
            json: {
                domain: 'inboundoff.test',
                description: 'Inbound off domain',
                inboundEnabled: false
            }
        });
        assertStatus(createInboundOffDomain, 201, 'create inbound-off domain');

        const registerInboundOffMailbox = await request(baseUrl, '/v1/email-registers', {
            method: 'POST',
            token: adminToken,
            json: {
                emailAddress: 'norecv@inboundoff.test'
            }
        });
        assertStatus(registerInboundOffMailbox, 409, 'register mailbox blocked when inbound disabled');

        const registerAdminMailbox = await request(baseUrl, '/v1/email-registers/new-mail?domain=example.com', {
            token: adminToken
        });
        assertStatus(registerAdminMailbox, 200, 'register random admin mailbox');
        assert.match(registerAdminMailbox.body.registration.emailAddress, /^[a-z0-9]+(?:[._]?[a-z0-9]+)*@example\.com$/);
        assert.equal(registerAdminMailbox.body.registration.domain, 'example.com');

        const createUser = await request(baseUrl, '/v1/users', {
            method: 'POST',
            token: adminToken,
            json: {
                username: 'alice',
                password: 'alice-pass-123',
                displayName: 'Alice Smoke',
                telegramId: '123456789'
            }
        });
        assertStatus(createUser, 201, 'create user');
        const aliceUserId = createUser.body.user.id;
        assert.ok(aliceUserId);

        const createBob = await request(baseUrl, '/v1/users', {
            method: 'POST',
            token: adminToken,
            json: {
                username: 'bob',
                password: 'bob-pass-123',
                displayName: 'Bob Smoke'
            }
        });
        assertStatus(createBob, 201, 'create bob');
        const bobUserId = createBob.body.user.id;
        assert.ok(bobUserId);

        const disableLastActiveAdmin = await request(baseUrl, `/v1/users/${adminUserId}`, {
            method: 'PATCH',
            token: adminToken,
            json: {
                status: 'disabled'
            }
        });
        assertStatus(disableLastActiveAdmin, 409, 'cannot disable last active admin');

        const grantBobAdmin = await request(baseUrl, '/v1/admins', {
            method: 'POST',
            token: adminToken,
            json: {
                userId: bobUserId
            }
        });
        assertStatus(grantBobAdmin, 201, 'grant bob admin');

        const disableBobAdmin = await request(baseUrl, `/v1/users/${bobUserId}`, {
            method: 'PATCH',
            token: adminToken,
            json: {
                status: 'disabled'
            }
        });
        assertStatus(disableBobAdmin, 200, 'disable bob admin');

        const revokeLastActiveAdmin = await request(baseUrl, `/v1/admins/${adminUserId}`, {
            method: 'DELETE',
            token: adminToken
        });
        assertStatus(revokeLastActiveAdmin, 409, 'cannot revoke last active admin');

        const reenableBob = await request(baseUrl, `/v1/users/${bobUserId}`, {
            method: 'PATCH',
            token: adminToken,
            json: {
                status: 'active'
            }
        });
        assertStatus(reenableBob, 200, 'reenable bob after admin guard checks');

        const revokeBobAdmin = await request(baseUrl, `/v1/admins/${bobUserId}`, {
            method: 'DELETE',
            token: adminToken
        });
        assertStatus(revokeBobAdmin, 200, 'revoke bob admin after guard checks');

        const createPermission = await request(baseUrl, '/v1/permissions', {
            method: 'POST',
            token: adminToken,
            json: {
                userId: aliceUserId,
                domain: 'example.com'
            }
        });
        assertStatus(createPermission, 201, 'create permission');
        const permissionId = createPermission.body.permission.id;
        assert.ok(permissionId);

        const createCleanupPermission = await request(baseUrl, '/v1/permissions', {
            method: 'POST',
            token: adminToken,
            json: {
                userId: aliceUserId,
                domain: 'cleanup.test'
            }
        });
        assertStatus(createCleanupPermission, 201, 'create cleanup permission');

        const patchPermissionRemoved = await request(baseUrl, `/v1/permissions/${permissionId}`, {
            method: 'PATCH',
            token: adminToken,
            json: {
                status: 'disabled'
            }
        });
        assertStatus(patchPermissionRemoved, 404, 'permission patch removed');

        const telegramUnauthorized = await request(baseUrl, '/v1/telegram/webhook', {
            method: 'POST',
            json: {
                update_id: 1,
                message: {
                    message_id: 1,
                    chat: { id: 123456789, type: 'private' },
                    from: { id: 123456789, is_bot: false, first_name: 'Alice' },
                    text: '/start'
                }
            }
        });
        assertStatus(telegramUnauthorized, 401, 'telegram webhook unauthorized');

        const telegramStart = await request(baseUrl, '/v1/telegram/webhook', {
            method: 'POST',
            headers: {
                'X-Telegram-Bot-Api-Secret-Token': telegramSettings.webhookSecret
            },
            json: {
                update_id: 2,
                message: {
                    message_id: 2,
                    chat: { id: 123456789, type: 'private' },
                    from: { id: 123456789, is_bot: false, first_name: 'Alice' },
                    text: '/start'
                }
            }
        });
        assertStatus(telegramStart, 200, 'telegram start');
        assert.equal(fakeTelegram.calls.at(-1)?.method, 'sendMessage');
        assert.match(String(fakeTelegram.calls.at(-1)?.body?.text || ''), /Supported commands:/);

        const telegramUnlinkedStart = await request(baseUrl, '/v1/telegram/webhook', {
            method: 'POST',
            headers: {
                'X-Telegram-Bot-Api-Secret-Token': telegramSettings.webhookSecret
            },
            json: {
                update_id: 21,
                message: {
                    message_id: 21,
                    chat: { id: 999000111, type: 'private' },
                    from: { id: 999000111, is_bot: false, first_name: 'Guest' },
                    text: '/start'
                }
            }
        });
        assertStatus(telegramUnlinkedStart, 200, 'telegram start for unlinked user');
        assert.equal(fakeTelegram.calls.at(-1)?.method, 'sendMessage');
        assert.match(String(fakeTelegram.calls.at(-1)?.body?.text || ''), /Your Telegram user id is: 999000111/);

        const telegramRegisterAlice = await request(baseUrl, '/v1/telegram/webhook', {
            method: 'POST',
            headers: {
                'X-Telegram-Bot-Api-Secret-Token': telegramSettings.webhookSecret
            },
            json: {
                update_id: 3,
                message: {
                    message_id: 3,
                    chat: { id: 123456789, type: 'private' },
                    from: { id: 123456789, is_bot: false, first_name: 'Alice' },
                    text: '/register alice@example.com'
                }
            }
        });
        assertStatus(telegramRegisterAlice, 200, 'telegram register alice mailbox');
        assert.match(String(fakeTelegram.calls.at(-1)?.body?.text || ''), /Registered alice@example.com/);

        const telegramMailboxes = await request(baseUrl, '/v1/telegram/webhook', {
            method: 'POST',
            headers: {
                'X-Telegram-Bot-Api-Secret-Token': telegramSettings.webhookSecret
            },
            json: {
                update_id: 4,
                message: {
                    message_id: 4,
                    chat: { id: 123456789, type: 'private' },
                    from: { id: 123456789, is_bot: false, first_name: 'Alice' },
                    text: '/mailboxes'
                }
            }
        });
        assertStatus(telegramMailboxes, 200, 'telegram mailboxes');
        assert.match(String(fakeTelegram.calls.at(-1)?.body?.text || ''), /alice@example\.com/);

        const telegramDomains = await request(baseUrl, '/v1/telegram/webhook', {
            method: 'POST',
            headers: {
                'X-Telegram-Bot-Api-Secret-Token': telegramSettings.webhookSecret
            },
            json: {
                update_id: 39,
                message: {
                    message_id: 39,
                    chat: { id: 123456789, type: 'private' },
                    from: { id: 123456789, is_bot: false, first_name: 'Alice' },
                    text: '/domains'
                }
            }
        });
        assertStatus(telegramDomains, 200, 'telegram domains');
        assert.match(String(fakeTelegram.calls.at(-1)?.body?.text || ''), /Available domains/);
        assert.match(String(fakeTelegram.calls.at(-1)?.body?.text || ''), /example\.com/);
        assert.match(String(fakeTelegram.calls.at(-1)?.body?.text || ''), /cleanup\.test/);
        assert.doesNotMatch(String(fakeTelegram.calls.at(-1)?.body?.text || ''), /disabled\.test/);
        assert.doesNotMatch(String(fakeTelegram.calls.at(-1)?.body?.text || ''), /inboundoff\.test/);

        const telegramNewMail = await request(baseUrl, '/v1/telegram/webhook', {
            method: 'POST',
            headers: {
                'X-Telegram-Bot-Api-Secret-Token': telegramSettings.webhookSecret
            },
            json: {
                update_id: 40,
                message: {
                    message_id: 40,
                    chat: { id: 123456789, type: 'private' },
                    from: { id: 123456789, is_bot: false, first_name: 'Alice' },
                    text: '/newmail cleanup.test'
                }
            }
        });
        assertStatus(telegramNewMail, 200, 'telegram newmail');
        assert.match(String(fakeTelegram.calls.at(-1)?.body?.text || ''), /^Registered [a-z0-9]+(?:[._-]?[a-z0-9]+)*@cleanup\.test\.$/);

        const telegramNewMailOnDomain = await request(baseUrl, '/v1/telegram/webhook', {
            method: 'POST',
            headers: {
                'X-Telegram-Bot-Api-Secret-Token': telegramSettings.webhookSecret
            },
            json: {
                update_id: 40_1,
                message: {
                    message_id: 40_1,
                    chat: { id: 123456789, type: 'private' },
                    from: { id: 123456789, is_bot: false, first_name: 'Alice' },
                    text: '/newmail example.com'
                }
            }
        });
        assertStatus(telegramNewMailOnDomain, 200, 'telegram newmail with domain');
        assert.match(String(fakeTelegram.calls.at(-1)?.body?.text || ''), /^Registered [a-z0-9]+(?:[._-]?[a-z0-9]+)*@example\.com\.$/);

        const telegramRegisterMissingArg = await request(baseUrl, '/v1/telegram/webhook', {
            method: 'POST',
            headers: {
                'X-Telegram-Bot-Api-Secret-Token': telegramSettings.webhookSecret
            },
            json: {
                update_id: 41,
                message: {
                    message_id: 41,
                    chat: { id: 123456789, type: 'private' },
                    from: { id: 123456789, is_bot: false, first_name: 'Alice' },
                    text: '/register'
                }
            }
        });
        assertStatus(telegramRegisterMissingArg, 200, 'telegram register missing arg');
        assert.match(String(fakeTelegram.calls.at(-1)?.body?.text || ''), /Usage: \/register <email>/);

        const telegramHelpAfterRegisterError = await request(baseUrl, '/v1/telegram/webhook', {
            method: 'POST',
            headers: {
                'X-Telegram-Bot-Api-Secret-Token': telegramSettings.webhookSecret
            },
            json: {
                update_id: 42,
                message: {
                    message_id: 42,
                    chat: { id: 123456789, type: 'private' },
                    from: { id: 123456789, is_bot: false, first_name: 'Alice' },
                    text: '/help'
                }
            }
        });
        assertStatus(telegramHelpAfterRegisterError, 200, 'telegram help after register error');
        assert.match(String(fakeTelegram.calls.at(-1)?.body?.text || ''), /Supported commands:/);

        const createBobDomainPermission = await request(baseUrl, '/v1/permissions', {
            method: 'POST',
            token: adminToken,
            json: {
                userId: bobUserId,
                domain: 'example.com'
            }
        });
        assertStatus(createBobDomainPermission, 201, 'create bob domain permission');
        const bobPermissionId = createBobDomainPermission.body.permission.id;
        assert.ok(bobPermissionId);

        const duplicateBobDomainPermission = await request(baseUrl, '/v1/permissions', {
            method: 'POST',
            token: adminToken,
            json: {
                userId: bobUserId,
                domain: 'example.com',
                status: 'active'
            }
        });
        assertStatus(duplicateBobDomainPermission, 409, 'duplicate bob domain permission rejected');

        const listBobPermissions = await request(baseUrl, `/v1/permissions?userId=${bobUserId}&domain=example.com`, {
            token: adminToken
        });
        assertStatus(listBobPermissions, 200, 'list bob permissions');
        assert.equal(listBobPermissions.body.count, 1);
        assert.equal(listBobPermissions.body.permissions[0].id, bobPermissionId);

        const ingestAliceEmail = await request(baseUrl, '/v1/inbound/email', {
            method: 'POST',
            token: config.inboundAuthToken,
            body: createMimeMessage({
                to: 'alice@example.com',
                subject: 'Alice smoke email',
                messageId: 'smoke-alice-1@example.net',
                text: 'Hello Alice'
            }),
            headers: {
                'Content-Type': 'message/rfc822',
                'X-Email-Envelope-To': 'alice@example.com',
                'X-Email-Envelope-From': 'sender@example.net',
                'X-Email-Worker-Name': 'smoke-worker'
            }
        });
        assertStatus(ingestAliceEmail, 202, 'ingest alice email');
        await waitFor(() => fakeTelegram.calls.some(call => call.method === 'sendMessage' && /New email received/.test(String(call.body?.text || ''))));
        const healthAfterFirstNotification = await request(baseUrl, '/health');
        assertStatus(healthAfterFirstNotification, 200, 'health after first telegram notification');
        assert.equal(healthAfterFirstNotification.body.telegram.outbox.pending, 0);
        assert.ok(healthAfterFirstNotification.body.telegram.outbox.sent >= 1);

        const ingestSecretEmail = await request(baseUrl, '/v1/inbound/email', {
            method: 'POST',
            token: config.inboundAuthToken,
            body: createMimeMessage({
                to: 'secret@example.com',
                subject: 'Secret smoke email',
                messageId: 'smoke-secret-1@example.net',
                text: 'Top secret'
            }),
            headers: {
                'Content-Type': 'message/rfc822',
                'X-Email-Envelope-To': 'secret@example.com',
                'X-Email-Envelope-From': 'sender@example.net',
                'X-Email-Worker-Name': 'smoke-worker'
            }
        });
        assertStatus(ingestSecretEmail, 202, 'ingest secret email');

        const aliceLogin = await request(baseUrl, '/v1/auth/login', {
            method: 'POST',
            json: {
                username: 'alice',
                password: 'alice-pass-123'
            }
        });
        assertStatus(aliceLogin, 200, 'alice login');
        const aliceToken = aliceLogin.body.sessionToken;
        assert.ok(aliceToken);
        assert.equal(aliceLogin.body.account.isAdmin, false);

        const rotateApiKey = await request(baseUrl, '/v1/auth/me/api-key/rotate', {
            method: 'POST',
            token: aliceToken,
            json: {}
        });
        assertStatus(rotateApiKey, 200, 'rotate own api key');
        const aliceApiKey = rotateApiKey.body.apiKey;
        assert.ok(aliceApiKey);

        const authMeViaApiKey = await request(baseUrl, '/v1/auth/me', {
            apiKey: aliceApiKey
        });
        assertStatus(authMeViaApiKey, 200, 'auth me via api key');
        assert.equal(authMeViaApiKey.body.account.username, 'alice');

        const registerAliceMailbox = await request(baseUrl, '/v1/email-registers', {
            method: 'POST',
            token: aliceToken,
            json: {
                emailAddress: 'alice@example.com'
            }
        });
        assertStatus(registerAliceMailbox, 201, 'register alice mailbox');
        assert.equal(registerAliceMailbox.body.registration.emailAddress, 'alice@example.com');

        const registerCleanupMailbox = await request(baseUrl, '/v1/email-registers', {
            method: 'POST',
            token: aliceToken,
            json: {
                emailAddress: 'cleanup@cleanup.test'
            }
        });
        assertStatus(registerCleanupMailbox, 201, 'register cleanup mailbox');
        assert.equal(registerCleanupMailbox.body.registration.emailAddress, 'cleanup@cleanup.test');

        const listAliceRegisters = await request(baseUrl, '/v1/email-registers', {
            token: aliceToken
        });
        assertStatus(listAliceRegisters, 200, 'list alice registrations');
        assert.equal(listAliceRegisters.body.count, 4);

        const bobLogin = await request(baseUrl, '/v1/auth/login', {
            method: 'POST',
            json: {
                username: 'bob',
                password: 'bob-pass-123'
            }
        });
        assertStatus(bobLogin, 200, 'bob login');
        const bobToken = bobLogin.body.sessionToken;

        const registerLegacyMailbox = await request(baseUrl, '/v1/email-registers', {
            method: 'POST',
            token: bobToken,
            json: {
                emailAddress: 'legacy@example.com'
            }
        });
        assertStatus(registerLegacyMailbox, 201, 'register legacy mailbox for prune');

        const ingestLegacyEmail = await request(baseUrl, '/v1/inbound/email', {
            method: 'POST',
            token: config.inboundAuthToken,
            body: createMimeMessage({
                to: 'legacy@example.com',
                subject: 'Legacy email',
                messageId: 'smoke-legacy-1@example.net',
                text: 'Very old email'
            }),
            headers: {
                'Content-Type': 'message/rfc822',
                'X-Email-Envelope-To': 'legacy@example.com',
                'X-Email-Envelope-From': 'sender@example.net',
                'X-Email-Received-At': '2020-01-01T00:00:00.000Z',
                'X-Email-Worker-Name': 'smoke-worker'
            }
        });
        assertStatus(ingestLegacyEmail, 202, 'ingest legacy email');

        const pruneEmailsDryRun = await request(baseUrl, '/v1/maintenance/prune-emails', {
            method: 'POST',
            token: adminToken,
            json: {
                olderThanDays: 365,
                domain: 'example.com',
                dryRun: true,
                limit: 10
            }
        });
        assertStatus(pruneEmailsDryRun, 200, 'prune emails dry run');
        assert.equal(pruneEmailsDryRun.body.dryRun, true);
        assert.equal(pruneEmailsDryRun.body.domain, 'example.com');
        assert.equal(pruneEmailsDryRun.body.matched, 1);
        assert.equal(pruneEmailsDryRun.body.selected, 1);
        assert.equal(pruneEmailsDryRun.body.deleted, 0);
        assert.equal(pruneEmailsDryRun.body.hasMore, false);

        const storageBeforePrune = await request(baseUrl, '/v1/maintenance/storage', {
            token: adminToken
        });
        assertStatus(storageBeforePrune, 200, 'maintenance storage before prune');
        assert.ok(storageBeforePrune.body.storage.sqliteTotalBytes >= 0);
        assert.ok(storageBeforePrune.body.storage.folderBytes >= storageBeforePrune.body.storage.sqliteTotalBytes);

        const pruneEmailsRun = await request(baseUrl, '/v1/maintenance/prune-emails', {
            method: 'POST',
            token: adminToken,
            json: {
                olderThanDays: 365,
                domain: 'example.com',
                dryRun: false,
                limit: 10
            }
        });
        assertStatus(pruneEmailsRun, 200, 'prune emails run');
        assert.equal(pruneEmailsRun.body.dryRun, false);
        assert.equal(pruneEmailsRun.body.deleted, 1);
        assert.equal(pruneEmailsRun.body.hasMore, false);
        assert.ok(pruneEmailsRun.body.vacuum);
        assert.ok(pruneEmailsRun.body.vacuum.before.totalBytes >= 0);
        assert.ok(pruneEmailsRun.body.vacuum.after.totalBytes >= 0);

        const legacyInboxAfterPrune = await request(baseUrl, '/v1/inboxes/legacy%40example.com', {
            token: bobToken
        });
        assertStatus(legacyInboxAfterPrune, 200, 'legacy inbox after prune');
        assert.equal(legacyInboxAfterPrune.body.count, 0);

        const bobCannotRegisterAliceMailbox = await request(baseUrl, '/v1/email-registers', {
            method: 'POST',
            token: bobToken,
            json: {
                emailAddress: 'alice@example.com'
            }
        });
        assertStatus(bobCannotRegisterAliceMailbox, 409, 'bob cannot register claimed mailbox');

        const bobEmailList = await request(baseUrl, '/v1/emails', {
            token: bobToken
        });
        assertStatus(bobEmailList, 200, 'bob email list without registrations');
        assert.equal(bobEmailList.body.count, 0);

        const aliceInbox = await request(baseUrl, '/v1/inboxes/alice%40example.com', {
            token: aliceToken
        });
        assertStatus(aliceInbox, 200, 'alice inbox');
        assert.equal(aliceInbox.body.count, 1);
        const allowedEmailId = aliceInbox.body.emails[0].id;
        assert.ok(allowedEmailId);
        const firstAliceReceivedAt = aliceInbox.body.emails[0].receivedAt;
        assert.ok(firstAliceReceivedAt);
        const firstAliceReceivedAtMs = Date.parse(firstAliceReceivedAt);
        assert.ok(Number.isFinite(firstAliceReceivedAtMs));

        fakeTelegram.state.failSendMessageCount = 1;
        const ingestAliceEmailSecond = await request(baseUrl, '/v1/inbound/email', {
            method: 'POST',
            token: config.inboundAuthToken,
            body: createMimeMessage({
                to: 'alice@example.com',
                subject: 'Alice smoke email 2',
                messageId: 'smoke-alice-2@example.net',
                text: 'Hello Alice again'
            }),
            headers: {
                'Content-Type': 'message/rfc822',
                'X-Email-Envelope-To': 'alice@example.com',
                'X-Email-Envelope-From': 'sender@example.net',
                'X-Email-Worker-Name': 'smoke-worker'
            }
        });
        assertStatus(ingestAliceEmailSecond, 202, 'ingest second alice email');
        await waitFor(() => fakeTelegram.calls.filter(call => call.method === 'sendMessage' && /Alice smoke email 2/.test(String(call.body?.text || ''))).length >= 2);
        const healthAfterRetry = await request(baseUrl, '/health');
        assertStatus(healthAfterRetry, 200, 'health after telegram retry');
        assert.equal(healthAfterRetry.body.telegram.outbox.pending, 0);
        assert.equal(healthAfterRetry.body.telegram.outbox.failed, 0);
        assert.ok(healthAfterRetry.body.telegram.outbox.sent >= 2);

        const aliceInboxCursorPage1 = await request(baseUrl, '/v1/inboxes/alice%40example.com?limit=1', {
            token: aliceToken
        });
        assertStatus(aliceInboxCursorPage1, 200, 'alice inbox cursor page 1');
        assert.equal(aliceInboxCursorPage1.body.count, 1);
        assert.equal(aliceInboxCursorPage1.body.hasMore, true);
        assert.ok(aliceInboxCursorPage1.body.nextCursor);
        const latestAliceEmailId = aliceInboxCursorPage1.body.emails[0].id;
        assert.ok(latestAliceEmailId);

        const aliceInboxCursorPage2 = await request(baseUrl, `/v1/inboxes/alice%40example.com?limit=1&cursor=${encodeURIComponent(aliceInboxCursorPage1.body.nextCursor)}`, {
            token: aliceToken
        });
        assertStatus(aliceInboxCursorPage2, 200, 'alice inbox cursor page 2');
        assert.equal(aliceInboxCursorPage2.body.count, 1);
        assert.equal(aliceInboxCursorPage2.body.emails[0].id, allowedEmailId);
        assert.equal(aliceInboxCursorPage2.body.hasMore, false);
        assert.equal(aliceInboxCursorPage2.body.nextCursor, null);

        const aliceInboxSince = await request(baseUrl, `/v1/inboxes/alice%40example.com?stime=${firstAliceReceivedAtMs}`, {
            token: aliceToken
        });
        assertStatus(aliceInboxSince, 200, 'alice inbox since time');
        assert.equal(aliceInboxSince.body.count, 1);
        assert.equal(aliceInboxSince.body.emails[0].subject, 'Alice smoke email 2');

        const ingestCleanupEmail = await request(baseUrl, '/v1/inbound/email', {
            method: 'POST',
            token: config.inboundAuthToken,
            body: createMimeMessage({
                to: 'cleanup@cleanup.test',
                subject: 'Cleanup smoke email',
                messageId: 'smoke-cleanup-1@example.net',
                text: 'Cleanup me'
            }),
            headers: {
                'Content-Type': 'message/rfc822',
                'X-Email-Envelope-To': 'cleanup@cleanup.test',
                'X-Email-Envelope-From': 'sender@example.net',
                'X-Email-Worker-Name': 'smoke-worker'
            }
        });
        assertStatus(ingestCleanupEmail, 202, 'ingest cleanup email');

        const cleanupInbox = await request(baseUrl, '/v1/inboxes/cleanup%40cleanup.test', {
            token: aliceToken
        });
        assertStatus(cleanupInbox, 200, 'cleanup inbox');
        assert.equal(cleanupInbox.body.count, 1);
        const cleanupEmailId = cleanupInbox.body.emails[0].id;
        assert.ok(cleanupEmailId);

        const secretInbox = await request(baseUrl, '/v1/inboxes/secret%40example.com', {
            token: adminToken
        });
        assertStatus(secretInbox, 200, 'secret inbox');
        assert.equal(secretInbox.body.count, 1);
        const deniedEmailId = secretInbox.body.emails[0].id;
        assert.ok(deniedEmailId);

        const createGroup = await request(baseUrl, '/v1/groups', {
            method: 'POST',
            token: aliceToken,
            json: {
                name: 'Important',
                color: '#2563EB',
                description: 'Smoke test group'
            }
        });
        assertStatus(createGroup, 201, 'create group');
        const groupId = createGroup.body.group.id;
        assert.ok(groupId);

        const adminGroupList = await request(baseUrl, '/v1/groups', {
            token: adminToken
        });
        assertStatus(adminGroupList, 200, 'admin list own groups only');
        assert.equal(adminGroupList.body.count, 0);

        const adminReadAliceGroup = await request(baseUrl, `/v1/groups/${groupId}`, {
            token: adminToken
        });
        assertStatus(adminReadAliceGroup, 404, 'admin cannot read another user group');

        const addGroupEmails = await request(baseUrl, `/v1/groups/${groupId}/emails`, {
            method: 'POST',
            token: aliceToken,
            json: {
                emailIds: [cleanupEmailId, allowedEmailId, latestAliceEmailId]
            }
        });
        assertStatus(addGroupEmails, 201, 'add group emails');
        assert.equal(addGroupEmails.body.count, 3);
        assert.equal(addGroupEmails.body.hasMore, false);
        assert.equal(addGroupEmails.body.nextCursor, null);

        const deleteCleanupDomain = await request(baseUrl, '/v1/domains/cleanup.test', {
            method: 'DELETE',
            token: adminToken
        });
        assertStatus(deleteCleanupDomain, 200, 'delete cleanup domain');

        const listAliceRegistersAfterDomainDelete = await request(baseUrl, '/v1/email-registers', {
            token: aliceToken
        });
        assertStatus(listAliceRegistersAfterDomainDelete, 200, 'list registrations after domain delete');
        assert.equal(listAliceRegistersAfterDomainDelete.body.count, 2);
        assert.ok(listAliceRegistersAfterDomainDelete.body.registrations.some((item) => item.emailAddress === 'alice@example.com'));
        assert.ok(listAliceRegistersAfterDomainDelete.body.registrations.every((item) => item.domain === 'example.com'));

        const fetchGroupAfterDomainDelete = await request(baseUrl, `/v1/groups/${groupId}/emails`, {
            token: aliceToken
        });
        assertStatus(fetchGroupAfterDomainDelete, 200, 'group fetch after domain delete');
        assert.equal(fetchGroupAfterDomainDelete.body.count, 2);
        assert.deepEqual(fetchGroupAfterDomainDelete.body.emails.map((email) => email.id), [allowedEmailId, latestAliceEmailId]);
        assert.deepEqual(fetchGroupAfterDomainDelete.body.emails.map((email) => email.groupPosition), [1, 2]);

        const fetchGroupEmails = await request(baseUrl, `/v1/groups/${groupId}/emails?limit=1`, {
            token: aliceToken
        });
        assertStatus(fetchGroupEmails, 200, 'fetch group emails');
        assert.equal(fetchGroupEmails.body.group.id, groupId);
        assert.equal(fetchGroupEmails.body.count, 1);
        assert.deepEqual(fetchGroupEmails.body.emails.map(email => email.id), [allowedEmailId]);
        assert.equal(fetchGroupEmails.body.hasMore, true);
        assert.ok(fetchGroupEmails.body.nextCursor);

        const fetchGroupEmailsPage2 = await request(baseUrl, `/v1/groups/${groupId}/emails?limit=1&cursor=${encodeURIComponent(fetchGroupEmails.body.nextCursor)}`, {
            token: aliceToken
        });
        assertStatus(fetchGroupEmailsPage2, 200, 'fetch group emails page 2');
        assert.equal(fetchGroupEmailsPage2.body.count, 1);
        assert.deepEqual(fetchGroupEmailsPage2.body.emails.map(email => email.id), [latestAliceEmailId]);
        assert.equal(fetchGroupEmailsPage2.body.hasMore, false);
        assert.equal(fetchGroupEmailsPage2.body.nextCursor, null);

        const registerArchiveMailbox = await request(baseUrl, '/v1/email-registers', {
            method: 'POST',
            token: aliceToken,
            json: {
                emailAddress: 'archive@example.com'
            }
        });
        assertStatus(registerArchiveMailbox, 201, 'register archive mailbox');

        const ingestArchiveEmailOne = await request(baseUrl, '/v1/inbound/email', {
            method: 'POST',
            token: config.inboundAuthToken,
            body: createMimeMessage({
                to: 'archive@example.com',
                subject: 'Archive email 1',
                messageId: 'smoke-archive-1@example.net',
                text: 'Archive one'
            }),
            headers: {
                'Content-Type': 'message/rfc822',
                'X-Email-Envelope-To': 'archive@example.com',
                'X-Email-Envelope-From': 'sender@example.net',
                'X-Email-Worker-Name': 'smoke-worker'
            }
        });
        assertStatus(ingestArchiveEmailOne, 202, 'ingest archive email 1');

        const ingestArchiveEmailTwo = await request(baseUrl, '/v1/inbound/email', {
            method: 'POST',
            token: config.inboundAuthToken,
            body: createMimeMessage({
                to: 'archive@example.com',
                subject: 'Archive email 2',
                messageId: 'smoke-archive-2@example.net',
                text: 'Archive two'
            }),
            headers: {
                'Content-Type': 'message/rfc822',
                'X-Email-Envelope-To': 'archive@example.com',
                'X-Email-Envelope-From': 'sender@example.net',
                'X-Email-Worker-Name': 'smoke-worker'
            }
        });
        assertStatus(ingestArchiveEmailTwo, 202, 'ingest archive email 2');

        const archiveInbox = await request(baseUrl, '/v1/inboxes/archive%40example.com', {
            token: aliceToken
        });
        assertStatus(archiveInbox, 200, 'archive inbox');
        const archiveEmailIds = archiveInbox.body.emails.map(email => email.id).sort((left, right) => left - right);
        assert.equal(archiveEmailIds.length, 2);

        const createCleanupPathsGroup = await request(baseUrl, '/v1/groups', {
            method: 'POST',
            token: aliceToken,
            json: {
                name: 'Cleanup Paths',
                color: '#0F766E',
                description: 'Regression checks for delete flows'
            }
        });
        assertStatus(createCleanupPathsGroup, 201, 'create cleanup paths group');
        const cleanupPathsGroupId = createCleanupPathsGroup.body.group.id;

        const addArchiveEmailsToGroup = await request(baseUrl, `/v1/groups/${cleanupPathsGroupId}/emails`, {
            method: 'POST',
            token: aliceToken,
            json: {
                emailIds: archiveEmailIds
            }
        });
        assertStatus(addArchiveEmailsToGroup, 201, 'add archive emails to cleanup paths group');
        assert.deepEqual(addArchiveEmailsToGroup.body.emails.map(email => email.groupPosition), [1, 2]);

        const cleanupPathsBeforeDelete = await request(baseUrl, `/v1/groups/${cleanupPathsGroupId}/emails`, {
            token: aliceToken
        });
        assertStatus(cleanupPathsBeforeDelete, 200, 'cleanup paths before single delete');
        assert.equal(cleanupPathsBeforeDelete.body.count, 2);

        await new Promise(resolve => setTimeout(resolve, 10));

        const deleteArchiveEmail = await request(baseUrl, `/v1/emails/${archiveEmailIds[0]}`, {
            method: 'DELETE',
            token: aliceToken
        });
        assertStatus(deleteArchiveEmail, 200, 'delete single archive email');

        const cleanupPathsAfterDelete = await request(baseUrl, `/v1/groups/${cleanupPathsGroupId}/emails`, {
            token: aliceToken
        });
        assertStatus(cleanupPathsAfterDelete, 200, 'cleanup paths after single delete');
        assert.equal(cleanupPathsAfterDelete.body.count, 1);
        assert.deepEqual(cleanupPathsAfterDelete.body.emails.map(email => email.id), [archiveEmailIds[1]]);
        assert.deepEqual(cleanupPathsAfterDelete.body.emails.map(email => email.groupPosition), [1]);
        assert.notEqual(cleanupPathsAfterDelete.body.group.updatedAt, cleanupPathsBeforeDelete.body.group.updatedAt);

        await new Promise(resolve => setTimeout(resolve, 10));

        const clearArchiveInbox = await request(baseUrl, '/v1/inboxes/archive%40example.com', {
            method: 'DELETE',
            token: aliceToken
        });
        assertStatus(clearArchiveInbox, 200, 'clear archive inbox');

        const cleanupPathsAfterClear = await request(baseUrl, `/v1/groups/${cleanupPathsGroupId}/emails`, {
            token: aliceToken
        });
        assertStatus(cleanupPathsAfterClear, 200, 'cleanup paths after clear inbox');
        assert.equal(cleanupPathsAfterClear.body.count, 0);
        assert.equal(cleanupPathsAfterClear.body.hasMore, false);
        assert.equal(cleanupPathsAfterClear.body.nextCursor, null);
        assert.notEqual(cleanupPathsAfterClear.body.group.updatedAt, cleanupPathsAfterDelete.body.group.updatedAt);

        const deletePermission = await request(baseUrl, `/v1/permissions/${permissionId}`, {
            method: 'DELETE',
            token: adminToken
        });
        assertStatus(deletePermission, 200, 'delete permission');

        const listAliceRegistersAfterPermissionDelete = await request(baseUrl, '/v1/email-registers', {
            token: aliceToken
        });
        assertStatus(listAliceRegistersAfterPermissionDelete, 200, 'list registrations after permission delete');
        assert.equal(listAliceRegistersAfterPermissionDelete.body.count, 0);

        const groupFetchAfterPermissionDelete = await request(baseUrl, `/v1/groups/${groupId}/emails`, {
            token: aliceToken
        });
        assertStatus(groupFetchAfterPermissionDelete, 200, 'group fetch after permission delete cleanup');
        assert.equal(groupFetchAfterPermissionDelete.body.count, 0);
        assert.equal(groupFetchAfterPermissionDelete.body.hasMore, false);
        assert.equal(groupFetchAfterPermissionDelete.body.nextCursor, null);

        console.log('new_server smoke test passed');
    } finally {
        await stopServer(server);
        await stopTelegramRuntime();
        await stopServer(fakeTelegram?.server);
        await closeDb();
        await rm(tempRoot, { recursive: true, force: true });
    }
}

await main();
