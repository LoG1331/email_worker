import express from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.mjs';
import {
    createEmailRegister,
    deleteEmailRegister,
    listEmailRegisters
} from '../services/email-register-service.mjs';

const createEmailRegisterSchema = z.object({
    emailAddress: z.string().min(1)
});

export function createEmailRegistersRouter(config) {
    const router = express.Router();

    router.get('/', asyncHandler(async (req, res) => {
        const registrations = await listEmailRegisters(config, req.auth, {
            ownerUserId: req.query.ownerUserId ? String(req.query.ownerUserId) : ''
        });

        res.json({
            count: registrations.length,
            registrations,
            requestId: req.requestId
        });
    }));

    router.post('/', asyncHandler(async (req, res) => {
        const payload = createEmailRegisterSchema.parse(req.body);
        const registration = await createEmailRegister(config, req.auth, payload);
        res.status(201).json({
            success: true,
            registration,
            requestId: req.requestId
        });
    }));

    router.delete('/:registrationId', asyncHandler(async (req, res) => {
        const result = await deleteEmailRegister(config, req.auth, req.params.registrationId);
        res.json({
            ...result,
            requestId: req.requestId
        });
    }));

    return router;
}
