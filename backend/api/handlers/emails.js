import { jsonResponse, extractPath } from '../utils.js';
import { generateRandomEmail } from '../../utils/index.js';

export async function handleEmailRoutes(request, env, url, storage) {
    const { method } = request;
    const { pathname, searchParams } = url;
    const { inboxDB } = storage;

    if (method === 'GET' && pathname === '/api/all') {
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');
        const emails = await inboxDB.getAll(limit, offset);
        return jsonResponse({ count: emails.length, total: emails.total, emails: emails.emails });
    }

    if (method === 'POST' && pathname === '/api/create') {
        const email = generateRandomEmail(env);
        return jsonResponse({
            success: true,
            email,
            message: `Email created. Use GET /api/inbox/${encodeURIComponent(email)} to fetch emails`
        });
    }

    if (pathname.startsWith('/api/inbox/')) {
        const email = extractPath(pathname, '/api/inbox/');

        if (method === 'GET') {
            const limit = parseInt(searchParams.get('limit') || '10');
            const emails = await inboxDB.getByAddress(email, limit);
            return jsonResponse({ email, count: emails.length, emails });
        }

        if (method === 'DELETE') {
            const deleteUrl = new URL('https://inbox/inbox');
            deleteUrl.searchParams.set('email_to', email);
            await inboxDB.getStub().fetch(deleteUrl.toString(), { method: 'DELETE' });
            return jsonResponse({ success: true, message: 'Inbox cleared' });
        }
    }

    if (method === 'DELETE' && pathname.startsWith('/api/email/')) {
        const emailId = parseInt(extractPath(pathname, '/api/email/'));
        if (isNaN(emailId)) {
            return jsonResponse({ error: 'Invalid email ID' }, 400);
        }

        const deleteUrl = new URL('https://inbox/email');
        deleteUrl.searchParams.set('id', emailId.toString());
        await inboxDB.getStub().fetch(deleteUrl.toString(), { method: 'DELETE' });
        return jsonResponse({ success: true, message: 'Email deleted' });
    }

    return null;
}
