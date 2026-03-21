import express from 'express';
import { z } from 'zod';
import { ensureDomainPermission, ensureMailboxPermission, hasGlobalPermission } from '../services/account-service.mjs';
import { asyncHandler } from '../utils/async-handler.mjs';
import { parseEmailAddress } from '../utils/email.mjs';
import { HttpError, parsePagination } from '../utils/http.mjs';
import {
    deleteEmailById,
    deleteEmailsByRecipient,
    assertRegisteredMailboxPermission,
    getAuthorizedEmailsByIds,
    getInboxByAddress,
    listEmails
} from '../services/email-service.mjs';

const batchEmailSchema = z.object({
    emailIds: z.array(z.union([z.number().int().positive(), z.string().min(1)])).min(1).max(200),
    includeRawMime: z.boolean().optional()
});

export function createEmailsRouter(config) {
    const router = express.Router();

    router.get('/', asyncHandler(async (req, res) => {
        const requestedDomain = req.query.domain ? String(req.query.domain) : '';
        const requestedAddress = req.query.address ? String(req.query.address) : '';

        if (requestedDomain && requestedAddress) {
            const parsedAddress = parseEmailAddress(requestedAddress);
            if (!parsedAddress) {
                throw new HttpError(400, 'Invalid email address filter');
            }

            if (parsedAddress.domain !== requestedDomain.toLowerCase()) {
                throw new HttpError(400, 'address domain does not match domain filter');
            }
        }

        if (hasGlobalPermission(req.auth)) {
            if (requestedAddress) {
                await ensureMailboxPermission(config, req.auth, requestedAddress, 'view');
            } else if (requestedDomain) {
                await ensureDomainPermission(config, req.auth, requestedDomain, 'view');
            }
        }

        const result = await listEmails(config, {
            ...req.auth,
        }, {
            limit: parsePagination(req.query.limit, 50, { min: 1, max: 200 }),
            offset: parsePagination(req.query.offset, 0, { min: 0, max: 100000 }),
            domain: requestedDomain,
            address: requestedAddress
        });

        res.json({
            total: result.total,
            count: result.emails.length,
            emails: result.emails,
            requestId: req.requestId
        });
    }));

    router.post('/batch', asyncHandler(async (req, res) => {
        const payload = batchEmailSchema.parse(req.body);
        const result = await getAuthorizedEmailsByIds(config, req.auth, payload.emailIds, {
            includeRawMime: payload.includeRawMime === true,
            permission: 'view'
        });

        res.json({
            count: result.count,
            emails: result.emails,
            missingIds: result.missingIds,
            deniedIds: result.deniedIds,
            requestId: req.requestId
        });
    }));

    router.get('/:id', asyncHandler(async (req, res) => {
        const result = await getAuthorizedEmailsByIds(config, req.auth, [req.params.id], {
            includeRawMime: req.query.includeRawMime === '1'
        });

        if (result.missingIds.length) {
            throw new HttpError(404, 'Email not found');
        }

        if (result.deniedIds.length) {
            throw new HttpError(403, 'Email is not available for this user');
        }

        res.json({
            email: result.emails[0],
            requestId: req.requestId
        });
    }));

    router.delete('/:id', asyncHandler(async (req, res) => {
        const lookup = await getAuthorizedEmailsByIds(config, req.auth, [req.params.id], {
            permission: 'write'
        });

        if (lookup.missingIds.length) {
            throw new HttpError(404, 'Email not found');
        }

        if (lookup.deniedIds.length) {
            throw new HttpError(403, 'Email is not available for this user');
        }

        const result = await deleteEmailById(config, req.params.id);
        res.json({
            ...result,
            requestId: req.requestId
        });
    }));

    return router;
}

export function createInboxesRouter(config) {
    const router = express.Router();

    router.get('/:emailAddress', asyncHandler(async (req, res) => {
        const emailAddress = decodeURIComponent(req.params.emailAddress);
        const parsedAddress = parseEmailAddress(emailAddress);
        if (!parsedAddress) {
            throw new HttpError(400, 'Invalid email address');
        }

        await assertRegisteredMailboxPermission(config, req.auth, parsedAddress.email, 'view');
        const emails = await getInboxByAddress(
            config,
            emailAddress,
            parsePagination(req.query.limit, 50, { min: 1, max: 200 })
        );

        res.json({
            emailAddress,
            count: emails.length,
            emails,
            requestId: req.requestId
        });
    }));

    router.delete('/:emailAddress', asyncHandler(async (req, res) => {
        const emailAddress = decodeURIComponent(req.params.emailAddress);
        const parsedAddress = parseEmailAddress(emailAddress);
        if (!parsedAddress) {
            throw new HttpError(400, 'Invalid email address');
        }

        await assertRegisteredMailboxPermission(config, req.auth, parsedAddress.email, 'write');
        const result = await deleteEmailsByRecipient(config, emailAddress);
        res.json({
            ...result,
            requestId: req.requestId
        });
    }));

    return router;
}
