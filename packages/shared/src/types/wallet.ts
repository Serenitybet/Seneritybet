export type TransactionType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "BET_PLACED"
  | "BET_WON"
  | "BET_REFUND"
  | "BONUS";

export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type PaymentProvider = "AIRTEL_MONEY" | "ORANGE_MONEY" | "MOOV_MONEY";

export interface WalletDTO {
  balance: number;       // centimes XAF
  bonusBalance: number;  // centimes XAF
}

export interface TransactionDTO {
  id: string;
  type: TransactionType;
  amount: number;        // centimes XAF
  balanceBefore: number;
  balanceAfter: number;
  status: TransactionStatus;
  provider?: PaymentProvider;
  phoneNumber?: string;
  createdAt: string;
}

export interface DepositPayload {
  amount: number;        // centimes XAF
  provider: PaymentProvider;
  phoneNumber: string;
}

export interface WithdrawPayload {
  amount: number;        // centimes XAF
  provider: PaymentProvider;
  phoneNumber: string;
}

// Libellés Mobile Money pour l'UI
export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  AIRTEL_MONEY: "Airtel Money",
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money (Flooz)",
};
