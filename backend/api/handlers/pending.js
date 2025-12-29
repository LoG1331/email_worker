import { jsonResponse } from '../utils.js';
import { getConfig } from '../../config.js';
import { sendMessageWithKeyboard } from '../../telegram/index.js';

export async function handlePendingRoutes(request, env, url, storage) {
    const { method } = request;
    const { pathname } = url;
    const { pendingDB, userDB, permissionDB, registrationDB } = storage;

    if (method === 'GET' && pathname === '/api/pending') {
        const requests = await pendingDB.getPending();
        // Enrich with user info
        const enriched = await Promise.all(requests.map(async r => ({
            ...r,
            user: await userDB.getUser(r.userId)
        })));
        return jsonResponse({ count: enriched.length, requests: enriched });
    }

    if (method === 'POST' && pathname.startsWith('/api/pending/')) {
        const parts = pathname.split('/');
        const id = parseInt(parts[3]);
        const action = parts[4]; // approve or reject

        if (action === 'approve') {
            const { type, target } = await request.json();
            const result = await pendingDB.resolve(id, 'APPROVED', 'ADMIN');
            if (result.success && result.request) {
                const { userId, email } = result.request;
                const { EMAIL_DOMAIN } = getConfig(env);

                // Grant permission
                await permissionDB.grant(userId, type, target || null, 'ADMIN');

                // Register email for user
                const fullEmail = `${email}@${EMAIL_DOMAIN}`;
                await registrationDB.register(userId, fullEmail);

                // Notify user via Telegram
                const permText = type === 'DOMAIN' ? '🌐 Full Domain' : `📧 Email: ${email}`;
                await sendMessageWithKeyboard(env, userId,
                    `✅ Yêu cầu đã được duyệt!\n\n${permText}\n📧 ${fullEmail}\n\nBạn có thể sử dụng email này ngay bây giờ.`,
                    [[{ text: '📋 Xem email', callback_data: 'myemail' }]]
                );
            }
            return jsonResponse(result);
        }

        if (action === 'reject') {
            const result = await pendingDB.resolve(id, 'REJECTED', 'ADMIN');
            if (result.success && result.request) {
                const { userId, email } = result.request;
                const { EMAIL_DOMAIN } = getConfig(env);

                // Notify user via Telegram
                await sendMessageWithKeyboard(env, userId,
                    `❌ Yêu cầu bị từ chối\n\n📧 ${email}@${EMAIL_DOMAIN}\n\nLiên hệ admin để biết thêm chi tiết.`
                );
            }
            return jsonResponse(result);
        }
    }

    return null;
}
