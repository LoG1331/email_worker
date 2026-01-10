import { getConfig } from './config.js';
import { InboxDB, ServiceDB, UserDB, PermissionDB, PendingDB, RegistrationDB, GroupDB } from './db.js';
import { jsonResponse, CORS_HEADERS } from './api/utils.js';

import { handleEmailRoutes } from './api/handlers/emails.js';
import { handleServiceRoutes } from './api/handlers/services.js';
import { handleUserRoutes } from './api/handlers/users.js';
import { handlePermissionRoutes } from './api/handlers/permissions.js';
import { handlePendingRoutes } from './api/handlers/pending.js';
import { handleGroupRoutes } from './api/handlers/groups.js';
import { handleTelegramSetupRoutes } from './api/handlers/telegram.js';
import { handleSetupRoutes } from './api/handlers/setup.js';

export async function handleApiRequest(request, env, url) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS });
    }

    // Allow config status check without auth (for login modal)
    const isConfigStatusCheck = (url.pathname === '/api/config' || url.pathname === '/api/setup/status') && request.method === 'GET';

    // All routes require authentication (if configured), except config status check
    const authKey = request.headers.get('Authorization')?.replace('Bearer ', '');
    const config = await getConfig(env);

    // If configured and not a status check, require valid API key
    if (config && !isConfigStatusCheck && authKey !== config.API_KEY) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const storage = {
        inboxDB: new InboxDB(env),
        serviceDB: new ServiceDB(env),
        userDB: new UserDB(env),
        permissionDB: new PermissionDB(env),
        pendingDB: new PendingDB(env),
        registrationDB: new RegistrationDB(env),
        groupDB: new GroupDB(env)
    };

    const routes = [
        handleEmailRoutes,
        handleServiceRoutes,
        handleUserRoutes,
        handlePermissionRoutes,
        handlePendingRoutes,
        handleGroupRoutes,
        handleTelegramSetupRoutes,
        handleSetupRoutes
    ];

    for (const route of routes) {
        const response = await route(request, env, url, storage);
        if (response) return response;
    }

    return jsonResponse({ error: 'Not found' }, 404);
}
