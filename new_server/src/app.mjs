import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { requestContext } from './middleware/request-context.mjs';
import { createBearerAuth, createUserAuth } from './middleware/auth.mjs';
import { createAdminsRouter } from './routes/admins.routes.mjs';
import { createAuthRouter } from './routes/auth.routes.mjs';
import { createUsersRouter } from './routes/users.routes.mjs';
import { createPermissionsRouter } from './routes/permissions.routes.mjs';
import { errorHandler, notFoundHandler } from './middleware/error-handler.mjs';
import { createBlockedSendersRouter } from './routes/blocked-senders.routes.mjs';
import { createDomainsRouter } from './routes/domains.routes.mjs';
import { createEmailRegistersRouter } from './routes/email-registers.routes.mjs';
import { createEmailsRouter, createInboxesRouter } from './routes/emails.routes.mjs';
import { createGroupsRouter } from './routes/groups.routes.mjs';
import { createHealthRouter } from './routes/health.routes.mjs';
import { createInboundRouter } from './routes/inbound.routes.mjs';
import { createMaintenanceRouter } from './routes/maintenance.routes.mjs';
import { createSystemRouter } from './routes/system.routes.mjs';
import { createTelegramRouter } from './routes/telegram.routes.mjs';

function createHelmetOptions() {
    const directives = helmet.contentSecurityPolicy.getDefaultDirectives();
    directives['img-src'] = [`'self'`, 'data:', 'blob:', 'https:', 'http:'];
    directives['media-src'] = [`'self'`, 'data:', 'blob:', 'https:', 'http:'];

    return {
        crossOriginResourcePolicy: false,
        contentSecurityPolicy: {
            directives
        }
    };
}

function createCorsMiddleware(config) {
    if (!config.corsAllowedOrigins.length) {
        return null;
    }

    return cors({
        origin(origin, callback) {
            if (!origin || config.corsAllowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(null, false);
        },
        credentials: true
    });
}

function withOptionalMiddleware(optionalMiddleware, ...middlewares) {
    return optionalMiddleware ? [optionalMiddleware, ...middlewares] : middlewares;
}

function createRateLimiter(windowMs, max) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false
    });
}

function createFrontendMiddleware(config) {
    const indexPath = path.join(config.frontendDistPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
        return null;
    }

    const staticMiddleware = express.static(config.frontendDistPath, {
        index: false,
        maxAge: '1y',
        immutable: true,
        setHeaders(res, filePath) {
            if (filePath.endsWith('index.html')) {
                res.setHeader('Cache-Control', 'no-cache');
                return;
            }

            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    });

    const htmlFallback = (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }

        if (req.path.startsWith('/v1/') || req.path === '/health') {
            return next();
        }

        if (path.extname(req.path)) {
            return next();
        }

        const acceptsHtml = req.accepts(['html', 'json']) === 'html';
        if (!acceptsHtml) {
            return next();
        }

        return res.sendFile(indexPath);
    };

    return {
        staticMiddleware,
        htmlFallback
    };
}

export function createApp(config) {
    const app = express();

    if (config.trustProxy) {
        app.set('trust proxy', 1);
    }

    app.disable('x-powered-by');
    app.use(requestContext);
    app.use(helmet(createHelmetOptions()));

    const corsMiddleware = createCorsMiddleware(config);
    app.use(express.json({
        limit: config.maxJsonBodyBytes
    }));

    const inboundAuth = createBearerAuth(config.inboundAuthToken, 'inbound');
    const userAuth = createUserAuth(config);
    const inboundLimiter = createRateLimiter(config.inboundRateLimitWindowMs, config.inboundRateLimitMax);
    const authLimiter = createRateLimiter(config.authRateLimitWindowMs, config.authRateLimitMax);
    const telegramLimiter = createRateLimiter(config.telegramWebhookRateLimitWindowMs, config.telegramWebhookRateLimitMax);

    app.use('/health', ...withOptionalMiddleware(corsMiddleware, createHealthRouter(config)));
    app.use('/v1/inbound', ...withOptionalMiddleware(corsMiddleware, inboundLimiter, inboundAuth, createInboundRouter(config)));
    app.use('/v1/auth', ...withOptionalMiddleware(corsMiddleware, authLimiter, createAuthRouter(config, userAuth)));
    app.use('/v1/users', ...withOptionalMiddleware(corsMiddleware, authLimiter, userAuth, createUsersRouter(config)));
    app.use('/v1/admins', ...withOptionalMiddleware(corsMiddleware, authLimiter, userAuth, createAdminsRouter(config)));
    app.use('/v1/permissions', ...withOptionalMiddleware(corsMiddleware, authLimiter, userAuth, createPermissionsRouter(config)));
    app.use('/v1/domains', ...withOptionalMiddleware(corsMiddleware, authLimiter, userAuth, createDomainsRouter(config)));
    app.use('/v1/blocked-senders', ...withOptionalMiddleware(corsMiddleware, authLimiter, userAuth, createBlockedSendersRouter(config)));
    app.use('/v1/email-registers', ...withOptionalMiddleware(corsMiddleware, authLimiter, userAuth, createEmailRegistersRouter(config)));
    app.use('/v1/emails', ...withOptionalMiddleware(corsMiddleware, authLimiter, userAuth, createEmailsRouter(config)));
    app.use('/v1/groups', ...withOptionalMiddleware(corsMiddleware, authLimiter, userAuth, createGroupsRouter(config)));
    app.use('/v1/inboxes', ...withOptionalMiddleware(corsMiddleware, authLimiter, userAuth, createInboxesRouter(config)));
    app.use('/v1/maintenance', ...withOptionalMiddleware(corsMiddleware, authLimiter, userAuth, createMaintenanceRouter(config)));
    app.use('/v1/system', ...withOptionalMiddleware(corsMiddleware, authLimiter, userAuth, createSystemRouter(config)));
    app.use('/v1/telegram', ...withOptionalMiddleware(corsMiddleware, telegramLimiter, createTelegramRouter(config)));

    const frontendMiddleware = createFrontendMiddleware(config);
    if (frontendMiddleware) {
        app.use(frontendMiddleware.staticMiddleware);
        app.get(/^(?!\/v1\/|\/health$).*/, frontendMiddleware.htmlFallback);
    }

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
