// Đọc config từ Cloudflare Workers environment
// Secrets (BOT_TOKEN, API_KEY) được set qua: npx wrangler secret put <KEY>
// Variables (EMAIL_DOMAIN) được set trong wrangler.toml [vars]
export function getConfig(env) {
    return {
        BOT_TOKEN: env.BOT_TOKEN,
        EMAIL_DOMAIN: env.EMAIL_DOMAIN,
        API_KEY: env.API_KEY
    };
}
