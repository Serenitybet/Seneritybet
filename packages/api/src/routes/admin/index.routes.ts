import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.middleware";
import { adminUsersRouter } from "./users.routes";
import { adminBetsRouter } from "./bets.routes";
import { adminSportsRouter } from "./sports.routes";
import { adminReportsRouter } from "./reports.routes";
import { adminShopsRouter } from "./shops.routes";
import { adminPartnersRouter } from "./partners.routes";
import { adminTpeRouter } from "./tpe.routes";
import { adminTicketsRouter } from "./tickets.routes";
import { adminSettingsRouter } from "./settings.routes";
import { adminBannersRouter } from "./banners.routes";

export const adminRouter = Router();

adminRouter.use(authenticate);
adminRouter.use(requireRole("ADMIN", "SUPER_ADMIN", "TRADER", "FINANCE"));

adminRouter.use("/users", adminUsersRouter);
adminRouter.use("/bets", adminBetsRouter);
adminRouter.use("/sports", adminSportsRouter);
adminRouter.use("/reports", adminReportsRouter);
adminRouter.use("/shops", adminShopsRouter);
adminRouter.use("/partners", adminPartnersRouter);
adminRouter.use("/tpe", adminTpeRouter);
adminRouter.use("/tickets", adminTicketsRouter);
adminRouter.use("/settings", adminSettingsRouter);
adminRouter.use("/banners", adminBannersRouter);
