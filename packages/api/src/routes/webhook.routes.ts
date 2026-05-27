import { Router, Request, Response } from "express";
import { confirmDeposit } from "../services/wallet.service";

export const webhookRouter = Router();

// Les webhooks arrivent en raw body pour vérification signature
webhookRouter.use((req, _res, next) => {
  let data = "";
  req.on("data", (chunk) => { data += chunk; });
  req.on("end", () => { (req as any).rawBody = data; next(); });
});

webhookRouter.post("/airtel-money", async (req: Request, res: Response) => {
  // Airtel envoie une confirmation de paiement
  const { transaction } = req.body;
  if (transaction?.status === "TS" && transaction?.id) {
    await confirmDeposit(transaction.id, "AIRTEL_MONEY");
  }
  res.status(200).json({ status: "received" });
});

webhookRouter.post("/orange-money", async (req: Request, res: Response) => {
  const { pay_token, status } = req.body;
  if (status === "SUCCESS" && pay_token) {
    await confirmDeposit(pay_token, "ORANGE_MONEY");
  }
  res.status(200).json({ status: "received" });
});

webhookRouter.post("/moov-money", async (req: Request, res: Response) => {
  const { transactionId, status } = req.body;
  if (status === "SUCCESS" && transactionId) {
    await confirmDeposit(transactionId, "MOOV_MONEY");
  }
  res.status(200).json({ status: "received" });
});
