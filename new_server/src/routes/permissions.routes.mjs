import express from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.mjs';
import {
    assertSuperAdmin,
    deletePermission,
    getPermissionById,
    listPermissions,
    updatePermission,
    upsertPermission
} from '../services/account-service.mjs';

const permissionCreateSchema = z.object({
    userId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
    username: z.string().min(1).optional(),
    displayName: z.string().optional(),
    telegramId: z.union([z.string(), z.null()]).optional(),
    domain: z.string().min(1),
    localPart: z.union([z.string(), z.null()]).optional(),
    role: z.enum(['viewer', 'operator', 'admin']),
    status: z.enum(['active', 'disabled']).optional()
}).refine(payload => payload.userId !== undefined || payload.username !== undefined, {
    message: 'userId or username is required'
});

const permissionUpdateSchema = z.object({
    role: z.enum(['viewer', 'operator', 'admin']).optional(),
    status: z.enum(['active', 'disabled']).optional()
}).refine(payload => payload.role !== undefined || payload.status !== undefined, {
    message: 'role or status is required'
});

export function createPermissionsRouter(config) {
    const router = express.Router();

    router.get('/', asyncHandler(async (req, res) => {
        assertSuperAdmin(req.auth);
        const permissions = await listPermissions(config, {
            userId: req.query.userId ? String(req.query.userId) : '',
            username: req.query.username ? String(req.query.username) : '',
            domain: req.query.domain ? String(req.query.domain) : '',
            localPart: req.query.localPart ? String(req.query.localPart) : '',
            role: req.query.role ? String(req.query.role) : '',
            status: req.query.status ? String(req.query.status) : ''
        });
        res.json({
            count: permissions.length,
            permissions,
            requestId: req.requestId
        });
    }));

    router.post('/', asyncHandler(async (req, res) => {
        assertSuperAdmin(req.auth);
        const payload = permissionCreateSchema.parse(req.body);
        const permission = await upsertPermission(config, payload, req.auth);
        res.status(201).json({
            success: true,
            permission,
            requestId: req.requestId
        });
    }));

    router.get('/:permissionId', asyncHandler(async (req, res) => {
        assertSuperAdmin(req.auth);
        const permission = await getPermissionById(config, req.params.permissionId);
        res.json({
            permission,
            requestId: req.requestId
        });
    }));

    router.patch('/:permissionId', asyncHandler(async (req, res) => {
        assertSuperAdmin(req.auth);
        const payload = permissionUpdateSchema.parse(req.body);
        const permission = await updatePermission(config, req.params.permissionId, payload, req.auth);
        res.json({
            success: true,
            permission,
            requestId: req.requestId
        });
    }));

    router.delete('/:permissionId', asyncHandler(async (req, res) => {
        assertSuperAdmin(req.auth);
        const result = await deletePermission(config, req.params.permissionId);
        res.json({
            ...result,
            requestId: req.requestId
        });
    }));

    return router;
}
