const MAX_ERROR_BODY_LENGTH = 500;

function sanitizeHeader(value) {
    return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

async function forwardToServer(message, env) {
    if (!env.FORWARD_TARGET_URL) {
        throw new Error('FORWARD_TARGET_URL is required');
    }

    const rawEmail = await new Response(message.raw).arrayBuffer();
    const headers = new Headers({
        'Content-Type': 'message/rfc822',
        'X-Email-Envelope-From': sanitizeHeader(message.from),
        'X-Email-Envelope-To': sanitizeHeader(message.to),
        'X-Email-Worker-Name': sanitizeHeader(env.WORKER_NAME || 'new-worker'),
        'X-Email-Received-At': new Date().toISOString(),
        'X-Email-Processing-Mode': 'forward',
        'X-Email-Size': String(rawEmail.byteLength)
    });

    if (env.EMAIL_DOMAIN) {
        headers.set('X-Email-Domain', sanitizeHeader(env.EMAIL_DOMAIN));
    }

    if (env.FORWARD_AUTH_TOKEN) {
        headers.set('Authorization', `Bearer ${env.FORWARD_AUTH_TOKEN}`);
    }

    const response = await fetch(env.FORWARD_TARGET_URL, {
        method: 'POST',
        headers,
        body: rawEmail
    });

    if (!response.ok) {
        const errorBody = (await response.text().catch(() => '')).slice(0, MAX_ERROR_BODY_LENGTH);
        throw new Error(`Forward target responded with ${response.status}${errorBody ? `: ${errorBody}` : ''}`);
    }

    console.log(`Forwarded ${message.to} to ${env.FORWARD_TARGET_URL}`);
}

export default {
    async email(message, env) {
        await forwardToServer(message, env);
    },

    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === '/health') {
            return Response.json({
                ok: true,
                mode: 'forward-only',
                targetConfigured: Boolean(env.FORWARD_TARGET_URL)
            });
        }

        return new Response('new_workers ingress only', {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8'
            }
        });
    }
};

