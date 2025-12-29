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

export async function handleApiRequest(request, env, url) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS });
    }

    const authKey = request.headers.get('Authorization')?.replace('Bearer ', '');
    const { API_KEY } = getConfig(env);
    if (authKey !== API_KEY) {
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
        handleTelegramSetupRoutes
    ];

    for (const route of routes) {
        const response = await route(request, env, url, storage);
        if (response) return response;
    }

    return jsonResponse({ error: 'Not found' }, 404);
}
