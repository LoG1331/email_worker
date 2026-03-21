import express from 'express';
import { asyncHandler } from '../utils/async-handler.mjs';
import { getDb } from '../db/index.mjs';

export function createHealthRouter(config) {
    const router = express.Router();

    router.get('/', asyncHandler(async (req, res) => {
        await getDb(config);
        res.json({
            ok: true,
            service: 'new_server',
            nodeEnv: config.nodeEnv,
            storage: {
                engine: 'sqlite',
                ready: true
            },
            requestId: req.requestId
        });
    }));

    return router;
}
