import { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";

type Handler = (req: any, res: Response, next: NextFunction) => Promise<any>;

/** Wraps async Express handlers so errors are forwarded to next() automatically. */
export const asyncHandler = (fn: Handler) =>
  (req: Request | AuthRequest, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
