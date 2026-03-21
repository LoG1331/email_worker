import { createApp } from './app.mjs';
import { loadConfig } from './config.mjs';
import { closeDb, getDb, maybePruneStoredRawMime } from './db/index.mjs';
import { ensureBootstrapAdmin, revokeExpiredSessions } from './services/account-service.mjs';

const config = loadConfig();
await getDb(config);
await maybePruneStoredRawMime(config, { force: true });
await revokeExpiredSessions(config);
await ensureBootstrapAdmin(config);

const app = createApp(config);
const server = app.listen(config.port, config.host, () => {
    console.log(`new_server listening on http://${config.host}:${config.port}`);
});

async function shutdown(signal) {
    console.log(`Received ${signal}, shutting down new_server`);
    server.close(async () => {
        try {
            await closeDb();
        } finally {
            process.exit(0);
        }
    });
}

process.on('SIGINT', () => {
    void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});
