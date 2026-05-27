export type Role = "PLAYER" | "TRADER" | "FINANCE" | "ADMIN" | "SUPER_ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";
export type KycStatus = "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  role: Role;
  status: UserStatus;
  kycStatus: KycStatus;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}
