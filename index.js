import PostalMime from 'postal-mime';
import { sendToTelegram, handleTelegramCommand, handleCallbackQuery } from './backend/telegram/index.js';
import { InboxDB as InboxClient, RegistrationDB as RegistrationClient, ServiceDB as ServiceClient, PermissionDB as PermissionClient } from './backend/db.js';
import { handleApiRequest } from './backend/api.js';
import { InboxDB, RegistrationDB, ServiceDB, UserDB, PermissionDB, PendingDB, GroupDB } from './backend/durable/index.js';

export { InboxDB, RegistrationDB, ServiceDB, UserDB, PermissionDB, PendingDB, GroupDB };

export default {
    async email(message, env) {
        try {
            const email = await new PostalMime().parse(message.raw);
            const inboxDB = new InboxClient(env);
            const registrationDB = new RegistrationClient(env);
            const serviceDB = new ServiceClient(env);
            const permissionDB = new PermissionClient(env);

            await inboxDB.save({
                to: message.to,
                from: email.from,
                subject: email.subject || '(No Subject)',
                text: email.text || '',
                html: email.html,
                date: new Date().toISOString()
            });

            // Track service subscription by sender (full from info)
            const senderInfo = email.from ? `${email.from.name || ''} <${email.from.address}>`.trim() : null;
            if (senderInfo && email.from?.address) {
                await serviceDB.recordService(message.to, senderInfo);
                console.log(`📊 Tracked service: ${senderInfo} -> ${message.to}`);
            }

            const owner = await registrationDB.getOwner(message.to);
            if (owner) {
                // Check if user still has permission
                const emailPrefix = message.to.split('@')[0];
                const access = await permissionDB.checkAccess(owner, emailPrefix);

                if (access.hasAccess) {
                    const from = email.from ? `${email.from.name || ''} <${email.from.address}>` : 'Unknown';
                    const header = `📬 Email riêng cho bạn!\nTo: ${message.to}\nFrom: ${from}\nSub: ${email.subject || '(No Subject)'}\n----------------\n`;
                    await sendToTelegram(env, owner, header);
                    await sendToTelegram(env, owner, email.html || email.text || '');
                } else {
                    console.log(`🚫 User ${owner} không có quyền nhận email ${message.to}`);
                }
            }
        } catch (e) {
            console.error('❌ Lỗi xử lý email:', e.message);
        }
    },

    async fetch(request, env) {
        const url = new URL(request.url);
        const { pathname } = url;

        if (pathname === '/webhook' && request.method === 'POST') {
            try {
                const update = await request.json();
                if (update.callback_query) {
                    await handleCallbackQuery(update, env);
                } else if (update.message) {
                    await handleTelegramCommand(update, env);
                }
                return new Response('OK');
            } catch {
                return new Response('Error', { status: 500 });
            }
        }

        if (pathname.startsWith('/api/')) return handleApiRequest(request, env, url);
        if (pathname === '/health') return new Response('OK');

        // Serve static assets from /public directory
        if (pathname === '/' || pathname === '/index.html') {
            return env.ASSETS.fetch(request);
        }

        return new Response('Email Worker Bot');
    }
};
