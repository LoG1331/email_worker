import express from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.mjs';
import {
    assertSuperAdmin,
    deletePermission,
    ensureDomainPermission,
    getPermissionById,
    hasGlobalPermission,
    listAccessibleDomains,
    listPermissions,
    updatePermission,
    upsertPermission
} from '../services/account-service.mjs';
import {
    getDomain,
    listDomains,
    updateDomain,
    upsertDomain
} from '../services/domain-service.mjs';

const statusSchema = z.enum(['active', 'disabled']);
const permissionRoleSchema = z.enum(['viewer', 'operator', 'admin']);

const domainUpsertSchema = z.object({
    domain: z.string().min(1),
    description: z.string().optional(),
    status: statusSchema.optional(),
    inboundEnabled: z.boolean().optional(),
    isDefault: z.boolean().optional()
});

const domainUpdateSchema = z.object({
    description: z.string().optional(),
    status: statusSchema.optional(),
    inboundEnabled: z.boolean().optional(),
    isDefault: z.boolean().optional()
});

const permissionCreateSchema = z.object({
    userId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
    username: z.string().min(1).optional(),
    displayName: z.string().optional(),
    telegramId: z.union([z.string(), z.null()]).optional(),
    localPart: z.union([z.string(), z.null()]).optional(),
    role: permissionRoleSchema,
    status: statusSchema.optional()
}).refine(payload => payload.userId !== undefined || payload.username !== undefined, {
    message: 'userId or username is required'
});

const permissionUpdateSchema = z.object({
    role: permissionRoleSchema.optional(),
    status: statusSchema.optional()
}).refine(payload => payload.role !== undefined || payload.status !== undefined, {
    message: 'role or status is required'
});

export function createDomainsRouter(config) {
    const router = express.Router();

    router.get('/', asyncHandler(async (req, res) => {
        let domains = await listDomains(config);

        if (!hasGlobalPermission(req.auth)) {
            const accessibleDomains = new Set(await listAccessibleDomains(config, req.auth, {
                domainLevelOnly: true
            }));
            domains = domains.filter(domain => accessibleDomains.has(domain.domain));
        }

        res.json({
            count: domains.length,
            domains,
            requestId: req.requestId
        });
    }));

    router.post('/', asyncHandler(async (req, res) => {
        assertSuperAdmin(req.auth);
        const payload = domainUpsertSchema.parse(req.body);
        const domain = await upsertDomain(config, payload);
        res.status(201).json({
            success: true,
            domain,
            requestId: req.requestId
        });
    }));

    router.get('/:domain', asyncHandler(async (req, res) => {
        await ensureDomainPermission(config, req.auth, req.params.domain, 'view');
        const domain = await getDomain(config, req.params.domain);
        res.json({
            domain,
            requestId: req.requestId
        });
    }));

    router.patch('/:domain', asyncHandler(async (req, res) => {
        await ensureDomainPermission(config, req.auth, req.params.domain, 'admin');
        const payload = domainUpdateSchema.parse(req.body);
        const domain = await updateDomain(config, req.params.domain, payload);
        res.json({
            success: true,
            domain,
            requestId: req.requestId
        });
    }));

    router.get('/:domain/permissions', asyncHandler(async (req, res) => {
        await ensureDomainPermission(config, req.auth, req.params.domain, 'admin');
        const permissions = await listPermissions(config, {
            domain: req.params.domain
        });
        res.json({
            count: permissions.length,
            permissions,
            requestId: req.requestId
        });
    }));

    router.post('/:domain/permissions', asyncHandler(async (req, res) => {
        await ensureDomainPermission(config, req.auth, req.params.domain, 'admin');
        const payload = permissionCreateSchema.parse(req.body);
        const permission = await upsertPermission(config, {
            ...payload,
            domain: req.params.domain
        }, req.auth);
        res.status(201).json({
            success: true,
            permission,
            requestId: req.requestId
        });
    }));

    router.get('/:domain/permissions/:permissionId', asyncHandler(async (req, res) => {
        await ensureDomainPermission(config, req.auth, req.params.domain, 'admin');
        const permission = await getPermissionById(config, req.params.permissionId);
        if (permission.domain !== req.params.domain.toLowerCase()) {
            return res.status(404).json({
                error: 'Permission not found in this domain',
                requestId: req.requestId
            });
        }

        res.json({
            permission,
            requestId: req.requestId
        });
    }));

    router.patch('/:domain/permissions/:permissionId', asyncHandler(async (req, res) => {
        await ensureDomainPermission(config, req.auth, req.params.domain, 'admin');
        const currentPermission = await getPermissionById(config, req.params.permissionId);
        if (currentPermission.domain !== req.params.domain.toLowerCase()) {
            return res.status(404).json({
                error: 'Permission not found in this domain',
                requestId: req.requestId
            });
        }

        const payload = permissionUpdateSchema.parse(req.body);
        const permission = await updatePermission(config, req.params.permissionId, payload, req.auth);
        res.json({
            success: true,
            permission,
            requestId: req.requestId
        });
    }));

    router.delete('/:domain/permissions/:permissionId', asyncHandler(async (req, res) => {
        await ensureDomainPermission(config, req.auth, req.params.domain, 'admin');
        const currentPermission = await getPermissionById(config, req.params.permissionId);
        if (currentPermission.domain !== req.params.domain.toLowerCase()) {
            return res.status(404).json({
                error: 'Permission not found in this domain',
                requestId: req.requestId
            });
        }

        const result = await deletePermission(config, req.params.permissionId);
        res.json({
            ...result,
            requestId: req.requestId
        });
    }));

    return router;
}
