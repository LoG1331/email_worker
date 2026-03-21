import express from 'express';
import { asyncHandler } from '../utils/async-handler.mjs';
import { assertSuperAdmin } from '../services/account-service.mjs';
import { pruneStoredRawMime } from '../services/email-service.mjs';

export function createMaintenanceRouter(config) {
    const router = express.Router();

    router.post('/prune-raw-mime', asyncHandler(async (req, res) => {
        assertSuperAdmin(req.auth);
        const result = await pruneStoredRawMime(config);
        res.json({
            success: true,
            ...result,
            requestId: req.requestId
        });
    }));

    return router;
}
