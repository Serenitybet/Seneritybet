// ⚠️ Route seed désactivée définitivement en production
import { Router } from "express";

const seedRouter = Router();

// Route désactivée — retourne 404
seedRouter.all("*", (_req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

export default seedRouter;
