import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

const seedRouter = Router();

// Route temporaire — créer le compte admin en production
// Protégée par un secret simple (pas de JWT requis)
seedRouter.post("/", async (req: Request, res: Response) => {
  const { secret } = req.body;
  if (secret !== "serenitybet-init-2026") {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }
  try {
    const hash = await bcrypt.hash("Admin@2024!", 10);
    const admin = await prisma.user.upsert({
      where: { email: "admin@serenitybet.td" },
      update: {},
      create: {
        email: "admin@serenitybet.td",
        phone: "+23500000001",
        firstName: "Admin",
        lastName: "Serenitybet",
        password: hash,
        role: "ADMIN",
        status: "ACTIVE",
        kycStatus: "APPROVED",
        dateOfBirth: new Date("1985-01-01"),
      },
    });

    const trader = await prisma.user.upsert({
      where: { email: "trader@serenitybet.td" },
      update: {},
      create: {
        email: "trader@serenitybet.td",
        phone: "+23500000002",
        firstName: "Trader",
        lastName: "Serenitybet",
        password: await bcrypt.hash("Trader@2024!", 10),
        role: "TRADER",
        status: "ACTIVE",
        kycStatus: "APPROVED",
        dateOfBirth: new Date("1990-01-01"),
      },
    });

    res.json({ success: true, created: [admin.email, trader.email] });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

export default seedRouter;
