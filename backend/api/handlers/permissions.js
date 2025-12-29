import { jsonResponse } from '../utils.js';
import { sendMessageWithKeyboard } from '../../telegram/index.js';

export async function handlePermissionRoutes(request, env, url, storage) {
    const { method } = request;
    const { pathname, searchParams } = url;
    const { permissionDB, registrationDB } = storage;

    if (method === 'GET' && pathname === '/api/permissions') {
        const permissions = await permissionDB.getAllPermissions();
        return jsonResponse({ count: permissions.length, permissions });
    }

    if (method === 'POST' && pathname === '/api/permissions') {
        const { userId, type, target } = await request.json();
        if (!userId || !type) {
            return jsonResponse({ error: 'userId and type required' }, 400);
        }
        await permissionDB.grant(userId, type, target || null, 'ADMIN');
        return jsonResponse({ success: true, message: 'Permission granted' });
    }

    if (method === 'DELETE' && pathname === '/api/permissions') {
        const userId = searchParams.get('userId');
        const type = searchParams.get('type');
        const target = searchParams.get('target');
        if (!userId || !type) {
            return jsonResponse({ error: 'userId and type required' }, 400);
        }

        // 1. Thu hồi permission
        await permissionDB.revoke(userId, type, target || null);

        // 2. Lấy emails user đang dùng
        const userEmails = await registrationDB.getEmailsByOwner(userId);

        // 3. Check và cleanup từng email không còn quyền
        const removedEmails = [];
        for (const email of userEmails) {
            const prefix = email.split('@')[0];
            const access = await permissionDB.checkAccess(userId, prefix);
            if (!access.hasAccess) {
                await registrationDB.unregister(email);
                removedEmails.push(email);
            }
        }

        // 4. Thông báo user nếu có email bị xóa
        if (removedEmails.length > 0) {
            const msg = `🔔 Quyền đã bị thu hồi\n\n📧 Emails bị xóa:\n${removedEmails.map(e => `• ${e}`).join('\n')}\n\n💡 Liên hệ admin nếu cần hỗ trợ.`;
            await sendMessageWithKeyboard(env, userId, msg);
        }

        return jsonResponse({
            success: true,
            message: 'Permission revoked',
            removedEmails
        });
    }

    return null;
}
