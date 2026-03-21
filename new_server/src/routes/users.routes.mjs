import express from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.mjs';
import {
    assertSuperAdmin,
    createUser,
    getUserById,
    getUserByTelegramId,
    listUsers,
    rotateUserApiKey,
    updateUser
} from '../services/account-service.mjs';

const createUserSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(8),
    displayName: z.string().optional(),
    telegramId: z.union([z.string(), z.null()]).optional(),
    status: z.enum(['active', 'disabled']).optional(),
    generateApiKey: z.boolean().optional(),
    apiKey: z.string().min(16).optional()
});

const updateUserSchema = z.object({
    username: z.string().min(3).optional(),
    password: z.string().min(8).optional(),
    displayName: z.string().optional(),
    telegramId: z.union([z.string(), z.null()]).optional(),
    status: z.enum(['active', 'disabled']).optional()
});

const rotateApiKeySchema = z.object({
    apiKey: z.string().min(16).optional()
});

export function createUsersRouter(config) {
    const router = express.Router();

    router.get('/', asyncHandler(async (req, res) => {
        assertSuperAdmin(req.auth);
        const users = await listUsers(config);
        res.json({
            count: users.length,
            users,
            requestId: req.requestId
        });
    }));

    router.get('/by-telegram/:telegramId', asyncHandler(async (req, res) => {
        assertSuperAdmin(req.auth);
        const user = await getUserByTelegramId(config, req.params.telegramId);
        res.json({
            user,
            requestId: req.requestId
        });
    }));

    router.post('/', asyncHandler(async (req, res) => {
        assertSuperAdmin(req.auth);
        const payload = createUserSchema.parse(req.body);
        const result = await createUser(config, payload);
        res.status(201).json({
            success: true,
            user: result.user,
            apiKey: result.apiKey,
            requestId: req.requestId
        });
    }));

    router.get('/:userId', asyncHandler(async (req, res) => {
        assertSuperAdmin(req.auth);
        const user = await getUserById(config, req.params.userId);
        res.json({
            user,
            requestId: req.requestId
        });
    }));

    router.patch('/:userId', asyncHandler(async (req, res) => {
        assertSuperAdmin(req.auth);
        const payload = updateUserSchema.parse(req.body);
        const user = await updateUser(config, req.params.userId, payload);
        res.json({
            success: true,
            user,
            requestId: req.requestId
        });
    }));

    router.post('/:userId/api-key/rotate', asyncHandler(async (req, res) => {
        assertSuperAdmin(req.auth);
        const payload = rotateApiKeySchema.parse(req.body ?? {});
        const result = await rotateUserApiKey(config, req.params.userId, payload);
        res.json({
            success: true,
            user: result.user,
            apiKey: result.apiKey,
            requestId: req.requestId
        });
    }));

    return router;
}
