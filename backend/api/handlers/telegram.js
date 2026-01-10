import { jsonResponse } from '../utils.js';
import { getConfig } from '../../config.js';

export async function handleTelegramSetupRoutes(request, env, url, storage) {
    const { method } = request;
    const { pathname } = url;

    if (method === 'POST' && pathname === '/api/setup-telegram') {
        try {
            const config = await getConfig(env);
            if (!config || !config.BOT_TOKEN) {
                return jsonResponse({ error: 'BOT_TOKEN not configured' }, 503);
            }

            const { BOT_TOKEN } = config;
            const workerUrl = url.origin;

            const tgFetch = async (method, body) => {
                const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                return res.json();
            };

            // Set webhook
            const webhook = await tgFetch('setWebhook', {
                url: `${workerUrl}/webhook`,
                allowed_updates: ['message', 'callback_query'],
                drop_pending_updates: true
            });

            // Set commands
            const commands = await tgFetch('setMyCommands', {
                commands: [
                    { command: 'start', description: 'Mở menu bot' },
                    { command: 'use', description: 'Thêm email (VD: /use myname)' }
                ]
            });

            // Get webhook info
            const info = await tgFetch('getWebhookInfo', {});

            return jsonResponse({
                success: webhook.ok && commands.ok,
                webhook: webhook.ok ? 'OK' : webhook.description,
                commands: commands.ok ? 'OK' : commands.description,
                webhookUrl: info.result?.url,
                pendingUpdates: info.result?.pending_update_count || 0
            });
        } catch (error) {
            return jsonResponse({
                error: 'Exception in setup-telegram',
                message: error.message,
                stack: error.stack
            }, 500);
        }
    }

    return null;
}
