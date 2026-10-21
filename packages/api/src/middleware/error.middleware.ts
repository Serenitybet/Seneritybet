import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    // Données structurées optionnelles renvoyées au client en plus du
    // message (ex: mise maximale suggérée quand un plafond de gain est
    // dépassé — voir tpe.service.ts placeTicket).
    public data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: err.message, ...(err.data ? { data: err.data } : {}) });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, error: "Erreur interne du serveur" });
}
