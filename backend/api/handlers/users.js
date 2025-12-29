import { jsonResponse } from '../utils.js';

export async function handleUserRoutes(request, env, url, storage) {
    const { method } = request;
    const { pathname } = url;
    const { userDB, registrationDB } = storage;

    if (method === 'GET' && pathname === '/api/users') {
        const users = await userDB.getAllUsers();
        // Enrich with emails for each user
        const enriched = await Promise.all(users.map(async u => ({
            ...u,
            emails: await registrationDB.getEmailsByOwner(u.userId)
        })));
        return jsonResponse({ count: enriched.length, users: enriched });
    }

    return null;
}
