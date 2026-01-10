import { isConfigured, saveConfig, getConfig } from '../../config.js';
import { jsonResponse } from '../utils.js';

// Mask sensitive data for display
function maskToken(token) {
    if (!token) return null;
    if (token.length <= 8) return '****';
    return token.slice(0, 4) + '****' + token.slice(-4);
}

export async function handleSetupRoutes(request, env, url) {
    const pathname = url.pathname;
    const method = request.method;

    // GET /api/setup/status - Check if app is configured
    if (method === 'GET' && pathname === '/api/setup/status') {
        const configured = await isConfigured(env);
        return jsonResponse({ configured });
    }

    // GET /api/config - Get current config info (masked)
    if (method === 'GET' && pathname === '/api/config') {
        const config = await getConfig(env);
        const configKey = `${env.WORKER_NAME || 'default'}_config`;

        let source = 'none';
        let kvConfig = null;

        try {
            kvConfig = await env.CONFIG_STORE?.get(configKey, 'json');
            if (kvConfig && kvConfig.BOT_TOKEN) {
                source = 'kv';
            }
        } catch (e) {
            console.error('Error reading KV:', e);
        }

        const hasEnvConfig = env.BOT_TOKEN && env.API_KEY && env.EMAIL_DOMAIN;
        if (!kvConfig && hasEnvConfig) {
            source = 'env';
        }

        return jsonResponse({
            configured: config !== null,
            source,
            workerName: env.WORKER_NAME || 'default',
            config: config ? {
                BOT_TOKEN: maskToken(config.BOT_TOKEN),
                API_KEY: '[HIDDEN]',
                EMAIL_DOMAIN: config.EMAIL_DOMAIN
            } : null,
            raw: {
                hasKvConfig: !!kvConfig,
                hasEnvConfig
            }
        });
    }

    // PUT /api/config - Save/Update config
    if (method === 'PUT' && pathname === '/api/config') {
        try {
            const newConfig = await request.json();

            if (!newConfig.BOT_TOKEN || !newConfig.API_KEY || !newConfig.EMAIL_DOMAIN) {
                return jsonResponse({ error: 'Missing required fields: BOT_TOKEN, API_KEY, EMAIL_DOMAIN' }, 400);
            }

            await saveConfig(env, newConfig);

            return jsonResponse({
                success: true,
                message: 'Configuration saved successfully'
            });
        } catch (error) {
            return jsonResponse({ error: error.message || 'Failed to save configuration' }, 500);
        }
    }

    return null;
}
