export type BetType = "SINGLE" | "ACCUMULATOR";
export type BetStatus = "PENDING" | "WON" | "LOST" | "CANCELLED" | "REFUNDED" | "MANUAL_REVIEW";
export type BetItemResult = "WON" | "LOST" | "VOID";

export interface BetSelection {
  eventId: string;
  marketId: string;
  oddId: string;
  oddValue: number;
}

export interface PlaceBetPayload {
  selections: BetSelection[];
  stake: number; // centimes XAF
  type: BetType;
}

export interface BetItemDTO {
  id: string;
  eventId: string;
  eventLabel: string; // "Man City vs Arsenal"
  marketName: string;
  oddLabel: string;
  oddValue: number;
  result?: BetItemResult;
}

export interface BetDTO {
  id: string;
  type: BetType;
  stake: number;
  totalOdds: number;
  potentialWin: number;
  status: BetStatus;
  isManualCheck: boolean;
  createdAt: string;
  settledAt?: string;
  items: BetItemDTO[];
}
