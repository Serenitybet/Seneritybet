import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.middleware";
import { adminUsersRouter } from "./users.routes";
import { adminBetsRouter } from "./bets.routes";
import { adminSportsRouter } from "./sports.routes";
import { adminReportsRouter } from "./reports.routes";

export const adminRouter = Router();

adminRouter.use(authenticate);
adminRouter.use(requireRole("ADMIN", "SUPER_ADMIN", "TRADER", "FINANCE"));

adminRouter.use("/users", adminUsersRouter);
adminRouter.use("/bets", adminBetsRouter);
adminRouter.use("/sports", adminSportsRouter);
adminRouter.use("/reports", adminReportsRouter);
