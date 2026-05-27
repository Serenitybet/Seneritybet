export type EventStatus = "UPCOMING" | "LIVE" | "FINISHED" | "CANCELLED" | "POSTPONED";
export type MarketType =
  | "MATCH_WINNER"
  | "DOUBLE_CHANCE"
  | "OVER_UNDER"
  | "BOTH_TEAMS_SCORE"
  | "HANDICAP"
  | "CORRECT_SCORE"
  | "FIRST_GOAL_SCORER"
  | "HALF_TIME_RESULT";

export interface Sport {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface Competition {
  id: string;
  sportId: string;
  name: string;
  slug: string;
  country?: string;
  logo?: string;
}

export interface OddDTO {
  id: string;
  label: string;
  value: number;
  isActive: boolean;
}

export interface MarketDTO {
  id: string;
  name: string;
  type: MarketType;
  isActive: boolean;
  isSuspended: boolean;
  odds: OddDTO[];
}

export interface EventDTO {
  id: string;
  competitionId: string;
  competition: Pick<Competition, "id" | "name" | "slug" | "country">;
  sport: Pick<Sport, "id" | "name" | "slug" | "icon">;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  startTime: string;
  status: EventStatus;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  markets: MarketDTO[];
}
