import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AccessTokenPayload {
  userId: string;
  employeeId: string | null;
  roleId: string;
  roleName: string;
  privileges: string[]; // resolved from Role → Duties → Privileges
  mustChangePassword: boolean;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

const BASE_OPTIONS = {
  issuer: "hr-platform",
  audience: "hr-platform-client",
} as const;

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    ...BASE_OPTIONS,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    ...BASE_OPTIONS,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(
    token,
    env.JWT_ACCESS_SECRET,
    BASE_OPTIONS,
  ) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(
    token,
    env.JWT_REFRESH_SECRET,
    BASE_OPTIONS,
  ) as RefreshTokenPayload;
}
