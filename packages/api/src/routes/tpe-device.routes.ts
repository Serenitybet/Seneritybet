import { Router, Request, Response } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { identifyTpeDevice, TpeRequest } from "../middleware/tpe.middleware";
import * as tpeService from "../services/tpe.service";

export const tpeDeviceRouter = Router();

// POST /api/tpe-device/register — premier démarrage, génère/retrouve le code d'appairage
tpeDeviceRouter.post("/register", asyncHandler(async (req: Request, res: Response) => {
  const { deviceSecret } = req.body;
  const result = await tpeService.registerDevice(deviceSecret);
  res.status(201).json({ success: true, data: result });
}));

// GET /api/tpe-device/status — poll de l'état d'appairage (en-tête X-Tpe-Secret)
tpeDeviceRouter.get("/status", identifyTpeDevice, asyncHandler(async (req: TpeRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      status: req.tpe!.status,
      pairingCode: req.tpe!.pairingCode,
      name: req.tpe!.name,
      code: req.tpe!.code,
      creditXAF: Number(req.tpe!.credit) / 100,
      lastSeenAt: req.tpe!.lastSeenAt,
      pairedAt: req.tpe!.pairedAt,
    },
  });
}));
