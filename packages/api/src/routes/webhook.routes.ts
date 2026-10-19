import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { confirmDeposit } from "../services/wallet.service";

export const webhookRouter = Router();

// Les webhooks sont montés AVANT express.json() dans app.ts (pour pouvoir
// capturer le corps brut en vue d'une éventuelle vérification de signature) —
// express.json() ne tourne donc jamais pour ces routes et req.body n'est
// jamais rempli automatiquement. On le fait nous-mêmes ici.
webhookRouter.use((req, _res, next) => {
  let data = "";
  req.on("data", (chunk) => { data += chunk; });
  req.on("end", () => {
    (req as any).rawBody = data;
    try { req.body = data ? JSON.parse(data) : {}; } catch { req.body = {}; }
    next();
  });
});

// Aucun des trois opérateurs (Airtel Money, Orange Money, Moov Money) ne
// documente publiquement de schéma de signature de webhook vérifiable — on
// ferme donc l'accès via un secret partagé inclus dans l'URL de callback
// elle-même (à configurer comme URL de notification dans l'espace marchand
// de chaque opérateur), comparé en temps constant. Sans ce secret dans
// l'URL, n'importe qui pouvait auparavant appeler ces routes directement et
// faire confirmer un dépôt fictif (aucun paiement réel n'ayant eu lieu).
// À renforcer plus tard par une revérification serveur-à-serveur du statut
// auprès de chaque opérateur, si leur API le permet, plutôt que de se fier
// uniquement au contenu du webhook.
function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.WEBHOOK_SECRET;
  const provided = String(req.params.secret ?? "");
  if (
    !expected ||
    !provided ||
    expected.length !== provided.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
  ) {
    res.status(404).end(); // ne pas révéler l'existence de la route à qui n'a pas le secret
    return;
  }
  next();
}

webhookRouter.post("/airtel-money/:secret", requireWebhookSecret, async (req: Request, res: Response) => {
  // Airtel envoie une confirmation de paiement
  const { transaction } = req.body;
  if (transaction?.status === "TS" && transaction?.id) {
    await confirmDeposit(transaction.id, "AIRTEL_MONEY");
  }
  res.status(200).json({ status: "received" });
});

webhookRouter.post("/orange-money/:secret", requireWebhookSecret, async (req: Request, res: Response) => {
  const { pay_token, status } = req.body;
  if (status === "SUCCESS" && pay_token) {
    await confirmDeposit(pay_token, "ORANGE_MONEY");
  }
  res.status(200).json({ status: "received" });
});

webhookRouter.post("/moov-money/:secret", requireWebhookSecret, async (req: Request, res: Response) => {
  const { transactionId, status } = req.body;
  if (status === "SUCCESS" && transactionId) {
    await confirmDeposit(transactionId, "MOOV_MONEY");
  }
  res.status(200).json({ status: "received" });
});
