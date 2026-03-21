import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/app.mjs';
import { loadConfig } from '../src/config.mjs';
import { closeDb, getDb, maybePruneStoredRawMime } from '../src/db/index.mjs';
import { ensureBootstrapAdmin, revokeExpiredSessions } from '../src/services/account-service.mjs';

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
    await maybePruneStoredRawMime(config, { force: true });
    await revokeExpiredSessions(config);
    await ensureBootstrapAdmin(config);

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

async function main() {
    const tempRoot = await mkdtemp(path.join(tmpdir(), 'email-worker-new-server-'));
    let server;

    try {
        const config = loadConfig({
            NODE_ENV: 'test',
            HOST: '127.0.0.1',
            INBOUND_AUTH_TOKEN: 'smoke-inbound-token',
            AUTH_JWT_SECRET: 'smoke-jwt-secret',
            API_KEY_PEPPER: 'smoke-api-pepper',
            NEW_SERVER_SQLITE_PATH: path.join(tempRoot, 'smoke.sqlite'),
            STORE_RAW_MIME: '0',
            BOOTSTRAP_ADMIN_USERNAME: 'admin',
            BOOTSTRAP_ADMIN_PASSWORD: 'admin-pass-123',
            BOOTSTRAP_ADMIN_DISPLAY_NAME: 'Smoke Admin'
        });

        const started = await startServer(config);
        server = started.server;
        const { baseUrl } = started;

        const health = await request(baseUrl, '/health');
        assertStatus(health, 200, 'health');
        assert.equal(health.body.ok, true);
        assert.equal(health.body.service, 'new_server');
        assert.equal(health.body.storage.engine, 'sqlite');
        assert.equal(health.body.storage.ready, true);
        assert.equal('sqlitePath' in health.body, false);

        const adminLogin = await request(baseUrl, '/v1/auth/login', {
            method: 'POST',
            json: {
                username: 'admin',
                password: 'admin-pass-123'
            }
        });
        assertStatus(adminLogin, 200, 'admin login');
        const adminToken = adminLogin.body.sessionToken;
        assert.ok(adminToken);
        assert.equal(adminLogin.body.account.isAdmin, true);

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

        const createPermission = await request(baseUrl, '/v1/permissions', {
            method: 'POST',
            token: adminToken,
            json: {
                userId: aliceUserId,
                domain: 'example.com',
                localPart: 'alice',
                role: 'operator'
            }
        });
        assertStatus(createPermission, 201, 'create permission');
        const permissionId = createPermission.body.permission.id;
        assert.ok(permissionId);

        const createBobDomainPermission = await request(baseUrl, '/v1/permissions', {
            method: 'POST',
            token: adminToken,
            json: {
                userId: bobUserId,
                domain: 'example.com',
                role: 'viewer'
            }
        });
        assertStatus(createBobDomainPermission, 201, 'create bob domain permission');
        const bobPermissionId = createBobDomainPermission.body.permission.id;
        assert.ok(bobPermissionId);

        const upsertBobDomainPermission = await request(baseUrl, '/v1/permissions', {
            method: 'POST',
            token: adminToken,
            json: {
                userId: bobUserId,
                domain: 'example.com',
                role: 'admin'
            }
        });
        assertStatus(upsertBobDomainPermission, 201, 'upsert bob domain permission');
        assert.equal(upsertBobDomainPermission.body.permission.id, bobPermissionId);
        assert.equal(upsertBobDomainPermission.body.permission.role, 'admin');

        const listBobPermissions = await request(baseUrl, `/v1/permissions?userId=${bobUserId}&domain=example.com`, {
            token: adminToken
        });
        assertStatus(listBobPermissions, 200, 'list bob permissions');
        assert.equal(listBobPermissions.body.count, 1);
        assert.equal(listBobPermissions.body.permissions[0].id, bobPermissionId);
        assert.equal(listBobPermissions.body.permissions[0].localPart, null);
        assert.equal(listBobPermissions.body.permissions[0].role, 'admin');

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

        const listAliceRegisters = await request(baseUrl, '/v1/email-registers', {
            token: aliceToken
        });
        assertStatus(listAliceRegisters, 200, 'list alice registrations');
        assert.equal(listAliceRegisters.body.count, 1);

        const bobLogin = await request(baseUrl, '/v1/auth/login', {
            method: 'POST',
            json: {
                username: 'bob',
                password: 'bob-pass-123'
            }
        });
        assertStatus(bobLogin, 200, 'bob login');
        const bobToken = bobLogin.body.sessionToken;

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

        const secretInbox = await request(baseUrl, '/v1/inboxes/secret%40example.com', {
            token: adminToken
        });
        assertStatus(secretInbox, 200, 'secret inbox');
        assert.equal(secretInbox.body.count, 1);
        const deniedEmailId = secretInbox.body.emails[0].id;
        assert.ok(deniedEmailId);

        const batchFetch = await request(baseUrl, '/v1/emails/batch', {
            method: 'POST',
            token: aliceToken,
            json: {
                emailIds: [allowedEmailId, deniedEmailId]
            }
        });
        assertStatus(batchFetch, 200, 'batch fetch');
        assert.equal(batchFetch.body.count, 1);
        assert.deepEqual(batchFetch.body.missingIds, []);
        assert.deepEqual(batchFetch.body.deniedIds, [deniedEmailId]);
        assert.deepEqual(batchFetch.body.emails.map(email => email.id), [allowedEmailId]);

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

        const addGroupEmails = await request(baseUrl, `/v1/groups/${groupId}/emails`, {
            method: 'POST',
            token: aliceToken,
            json: {
                emailIds: [allowedEmailId]
            }
        });
        assertStatus(addGroupEmails, 201, 'add group emails');
        assert.equal(addGroupEmails.body.count, 1);

        const deletePermission = await request(baseUrl, `/v1/permissions/${permissionId}`, {
            method: 'DELETE',
            token: adminToken
        });
        assertStatus(deletePermission, 200, 'delete permission');

        const firstGroupFetch = await request(baseUrl, `/v1/groups/${groupId}/emails`, {
            token: aliceToken
        });
        assertStatus(firstGroupFetch, 409, 'group fetch after permission revoke');
        assert.deepEqual(firstGroupFetch.body.details.deniedIds, [allowedEmailId]);
        assert.deepEqual(firstGroupFetch.body.details.prunedIds, [allowedEmailId]);

        const secondGroupFetch = await request(baseUrl, `/v1/groups/${groupId}/emails`, {
            token: aliceToken
        });
        assertStatus(secondGroupFetch, 200, 'group fetch after prune');
        assert.equal(secondGroupFetch.body.count, 0);
        assert.equal(secondGroupFetch.body.total, 0);

        console.log('new_server smoke test passed');
    } finally {
        await stopServer(server);
        await closeDb();
        await rm(tempRoot, { recursive: true, force: true });
    }
}

await main();
