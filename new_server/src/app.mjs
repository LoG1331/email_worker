import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { requestContext } from './middleware/request-context.mjs';
import { createBearerAuth, createUserAuth } from './middleware/auth.mjs';
import { createAdminsRouter } from './routes/admins.routes.mjs';
import { createAuthRouter } from './routes/auth.routes.mjs';
import { createUsersRouter } from './routes/users.routes.mjs';
import { createPermissionsRouter } from './routes/permissions.routes.mjs';
import { errorHandler, notFoundHandler } from './middleware/error-handler.mjs';
import { createDomainsRouter } from './routes/domains.routes.mjs';
import { createEmailRegistersRouter } from './routes/email-registers.routes.mjs';
import { createEmailsRouter, createInboxesRouter } from './routes/emails.routes.mjs';
import { createGroupsRouter } from './routes/groups.routes.mjs';
import { createHealthRouter } from './routes/health.routes.mjs';
import { createInboundRouter } from './routes/inbound.routes.mjs';
import { createMaintenanceRouter } from './routes/maintenance.routes.mjs';

function createCorsMiddleware(config) {
    if (!config.corsAllowedOrigins.length) {
        return null;
    }

    return cors({
        origin(origin, callback) {
            if (!origin || config.corsAllowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error('CORS origin not allowed'));
        },
        credentials: true
    });
}

function createRateLimiter(windowMs, max) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false
    });
}

export function createApp(config) {
    const app = express();

    if (config.trustProxy) {
        app.set('trust proxy', 1);
    }

    app.disable('x-powered-by');
    app.use(requestContext);
    app.use(helmet({
        crossOriginResourcePolicy: false
    }));

    const corsMiddleware = createCorsMiddleware(config);
    if (corsMiddleware) {
        app.use(corsMiddleware);
    }

    app.use(express.json({
        limit: config.maxJsonBodyBytes
    }));

    const inboundAuth = createBearerAuth(config.inboundAuthToken, 'inbound');
    const userAuth = createUserAuth(config);
    const inboundLimiter = createRateLimiter(config.inboundRateLimitWindowMs, config.inboundRateLimitMax);
    const authLimiter = createRateLimiter(config.authRateLimitWindowMs, config.authRateLimitMax);

    app.use('/health', createHealthRouter(config));
    app.use('/v1/inbound', inboundLimiter, inboundAuth, createInboundRouter(config));
    app.use('/v1/auth', authLimiter, createAuthRouter(config, userAuth));
    app.use('/v1/users', authLimiter, userAuth, createUsersRouter(config));
    app.use('/v1/admins', authLimiter, userAuth, createAdminsRouter(config));
    app.use('/v1/permissions', authLimiter, userAuth, createPermissionsRouter(config));
    app.use('/v1/domains', authLimiter, userAuth, createDomainsRouter(config));
    app.use('/v1/email-registers', authLimiter, userAuth, createEmailRegistersRouter(config));
    app.use('/v1/emails', authLimiter, userAuth, createEmailsRouter(config));
    app.use('/v1/groups', authLimiter, userAuth, createGroupsRouter(config));
    app.use('/v1/inboxes', authLimiter, userAuth, createInboxesRouter(config));
    app.use('/v1/maintenance', authLimiter, userAuth, createMaintenanceRouter(config));

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
