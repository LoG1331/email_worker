// Đọc config với priority order: KV store → Environment variables → null
// Priority 1: KV store (runtime config) - cho phép update qua UI
// Priority 2: Environment variables (wrangler secrets) - backward compatible
// Priority 3: null - chưa config, cần setup wizard

// Helper to get KV key with worker name prefix
const getConfigKey = (env) => `${env.WORKER_NAME || 'default'}_config`;

// Async function - checks KV store first, then environment variables
export async function getConfig(env) {
    const key = getConfigKey(env);

    // Priority 1: KV store (runtime config)
    try {
        const kvConfig = await env.CONFIG_STORE?.get(key, 'json');
        if (kvConfig && kvConfig.BOT_TOKEN && kvConfig.API_KEY && kvConfig.EMAIL_DOMAIN) {
            return kvConfig;
        }
    } catch (e) {
        console.error('Error reading from CONFIG_STORE:', e);
    }

    // Priority 2: Environment variables (wrangler secrets) - backward compatible
    if (env.BOT_TOKEN && env.API_KEY && env.EMAIL_DOMAIN) {
        return {
            BOT_TOKEN: env.BOT_TOKEN,
            EMAIL_DOMAIN: env.EMAIL_DOMAIN,
            API_KEY: env.API_KEY
        };
    }

    // Priority 3: Not configured
    return null;
}

// Alias for backward compatibility
export const getConfigAsync = getConfig;

export async function isConfigured(env) {
    const config = await getConfig(env);
    return config !== null;
}

export async function saveConfig(env, config) {
    if (!config.BOT_TOKEN || !config.API_KEY || !config.EMAIL_DOMAIN) {
        throw new Error('Missing required config fields');
    }
    const key = getConfigKey(env);
    await env.CONFIG_STORE.put(key, JSON.stringify(config));
    return true;
}
