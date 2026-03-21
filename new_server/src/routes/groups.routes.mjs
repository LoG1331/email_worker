import express from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.mjs';
import { parsePagination } from '../utils/http.mjs';
import {
    addEmailsToGroup,
    createGroup,
    deleteGroup,
    getGroup,
    listGroupEmails,
    listGroups,
    removeEmailFromGroup,
    updateGroup
} from '../services/group-service.mjs';

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
    emailIds: z.array(z.union([z.number().int().positive(), z.string().min(1)])).max(200).optional(),
    emailAddresses: z.array(z.string().min(1)).max(200).optional()
}).refine((payload) => Boolean(payload.emailIds?.length || payload.emailAddresses?.length), {
    message: 'emailIds or emailAddresses is required'
});

export function createGroupsRouter(config) {
    const router = express.Router();

    router.get('/', asyncHandler(async (req, res) => {
        const result = await listGroups(config, req.auth, {
            limit: parsePagination(req.query.limit, 50, { min: 1, max: 200 }),
            offset: parsePagination(req.query.offset, 0, { min: 0, max: 100000 })
        });
        res.json({
            total: result.total,
            count: result.groups.length,
            groups: result.groups,
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
            cursor: req.query.cursor ? String(req.query.cursor) : '',
            includeRawMime: req.query.includeRawMime === '1'
        });

        res.json({
            group: result.group,
            count: result.count,
            emails: result.emails,
            nextCursor: result.nextCursor,
            hasMore: result.hasMore,
            requestId: req.requestId
        });
    }));

    router.post('/:groupId/emails', asyncHandler(async (req, res) => {
        const payload = groupEmailBatchSchema.parse(req.body);
        const result = await addEmailsToGroup(config, req.auth, req.params.groupId, payload);
        res.status(201).json({
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
