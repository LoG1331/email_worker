import express from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.mjs';
import {
    addEmailsToGroup,
    createGroup,
    deleteGroup,
    getGroup,
    listGroupEmails,
    listGroups,
    removeEmailFromGroup,
    replaceGroupEmails,
    updateGroup
} from '../services/group-service.mjs';
import { parsePagination } from '../utils/http.mjs';

const groupCreateSchema = z.object({
    name: z.string().min(1),
    color: z.string().optional(),
    description: z.string().optional()
});

const groupUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    color: z.string().optional(),
    description: z.string().optional()
});

const groupEmailBatchSchema = z.object({
    emailIds: z.array(z.union([z.number().int().positive(), z.string().min(1)])).max(200),
    includeRawMime: z.boolean().optional()
});

export function createGroupsRouter(config) {
    const router = express.Router();

    router.get('/', asyncHandler(async (req, res) => {
        const groups = await listGroups(config, req.auth, {
            ownerUserId: req.query.ownerUserId ? String(req.query.ownerUserId) : ''
        });
        res.json({
            count: groups.length,
            groups,
            requestId: req.requestId
        });
    }));

    router.post('/', asyncHandler(async (req, res) => {
        const payload = groupCreateSchema.parse(req.body);
        const group = await createGroup(config, req.auth, payload);
        res.status(201).json({
            success: true,
            group,
            requestId: req.requestId
        });
    }));

    router.get('/:groupId', asyncHandler(async (req, res) => {
        const group = await getGroup(config, req.auth, req.params.groupId);
        res.json({
            group,
            requestId: req.requestId
        });
    }));

    router.patch('/:groupId', asyncHandler(async (req, res) => {
        const payload = groupUpdateSchema.parse(req.body);
        const group = await updateGroup(config, req.auth, req.params.groupId, payload);
        res.json({
            success: true,
            group,
            requestId: req.requestId
        });
    }));

    router.delete('/:groupId', asyncHandler(async (req, res) => {
        const result = await deleteGroup(config, req.auth, req.params.groupId);
        res.json({
            ...result,
            requestId: req.requestId
        });
    }));

    router.get('/:groupId/emails', asyncHandler(async (req, res) => {
        const result = await listGroupEmails(config, req.auth, req.params.groupId, {
            limit: parsePagination(req.query.limit, 100, { min: 1, max: 200 }),
            offset: parsePagination(req.query.offset, 0, { min: 0, max: 100000 }),
            includeRawMime: req.query.includeRawMime === '1'
        });
        res.json({
            ...result,
            requestId: req.requestId
        });
    }));

    router.post('/:groupId/emails', asyncHandler(async (req, res) => {
        const payload = groupEmailBatchSchema.parse(req.body);
        const result = await addEmailsToGroup(config, req.auth, req.params.groupId, payload.emailIds);
        res.status(201).json({
            success: true,
            ...result,
            requestId: req.requestId
        });
    }));

    router.put('/:groupId/emails', asyncHandler(async (req, res) => {
        const payload = groupEmailBatchSchema.parse(req.body);
        const result = await replaceGroupEmails(config, req.auth, req.params.groupId, payload.emailIds);
        res.json({
            success: true,
            ...result,
            requestId: req.requestId
        });
    }));

    router.delete('/:groupId/emails/:emailId', asyncHandler(async (req, res) => {
        const result = await removeEmailFromGroup(config, req.auth, req.params.groupId, req.params.emailId);
        res.json({
            ...result,
            requestId: req.requestId
        });
    }));

    return router;
}
