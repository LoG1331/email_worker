import { jsonResponse, extractPath } from '../utils.js';

export async function handleGroupRoutes(request, env, url, storage) {
    const { method } = request;
    const { pathname, searchParams } = url;
    const { groupDB, inboxDB } = storage;

    // Group management
    if (method === 'POST' && pathname === '/api/groups') {
        const { name, color } = await request.json();
        if (!name) return jsonResponse({ error: 'name required' }, 400);
        const result = await groupDB.createGroup(name, color);
        return jsonResponse(result);
    }

    if (method === 'GET' && pathname === '/api/groups') {
        const groups = await groupDB.getAllGroups();
        return jsonResponse({ count: groups.length, groups });
    }

    if (method === 'PUT' && pathname.startsWith('/api/groups/')) {
        const groupId = parseInt(extractPath(pathname, '/api/groups/'));
        const { name, color } = await request.json();
        await groupDB.updateGroup(groupId, name, color);
        return jsonResponse({ success: true });
    }

    if (method === 'DELETE' && pathname.startsWith('/api/groups/') && !pathname.includes('/emails')) {
        const groupId = parseInt(extractPath(pathname, '/api/groups/'));
        await groupDB.deleteGroup(groupId);
        return jsonResponse({ success: true });
    }

    // Email-group assignments
    if (method === 'POST' && pathname.match(/^\/api\/groups\/\d+\/emails$/)) {
        const groupId = parseInt(pathname.split('/')[3]);
        const { emailAddress } = await request.json();
        if (!emailAddress) return jsonResponse({ error: 'emailAddress required' }, 400);
        const result = await groupDB.addEmailToGroup(groupId, emailAddress);
        return jsonResponse(result);
    }

    if (method === 'DELETE' && pathname.match(/^\/api\/groups\/\d+\/emails\/.+$/)) {
        const parts = pathname.split('/');
        const groupId = parseInt(parts[3]);
        const emailAddress = decodeURIComponent(parts[5]);
        await groupDB.removeEmailFromGroup(groupId, emailAddress);
        return jsonResponse({ success: true });
    }

    if (method === 'GET' && pathname.match(/^\/api\/groups\/\d+\/emails$/)) {
        const groupId = parseInt(pathname.split('/')[3]);
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Get email addresses in this group
        const emailsData = await groupDB.getEmailsInGroup(groupId, limit, offset);
        const emailAddresses = emailsData.emails.map(e => e.emailAddress);

        // If no email addresses in group, return empty
        if (emailAddresses.length === 0) {
            return jsonResponse({
                count: 0,
                total: 0,
                addresses: [],
                emails: []
            });
        }

        // Get actual emails from inbox that were sent TO these addresses (optimized)
        const emailsResponse = await inboxDB.getByRecipients(emailAddresses, limit, offset);
        const filteredEmails = emailsResponse.emails || [];

        return jsonResponse({
            count: filteredEmails.length,
            total: emailsResponse.total,
            addresses: emailsData.emails,  // { emailAddress, addedAt }
            emails: filteredEmails         // Actual email messages
        });
    }

    if (method === 'GET' && pathname.startsWith('/api/emails/') && pathname.endsWith('/groups')) {
        const emailAddress = decodeURIComponent(pathname.split('/')[3]);
        const groups = await groupDB.getGroupsForEmail(emailAddress);
        return jsonResponse({ groups });
    }

    return null;
}
