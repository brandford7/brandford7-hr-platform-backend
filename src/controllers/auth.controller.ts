import type { Request, Response } from "express";
import {
  loginUser,
  refreshUserTokens,
  logoutUser,
  changeUserPassword,
  forceChangePassword,
} from "../services/auth.service";
import { sendSuccess } from "../utils/response.util";
import { env } from "../config/env";

const REFRESH_COOKIE = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/api/auth/refresh",
};

// POST /api/auth/login
export async function login(req: Request, res: Response): Promise<void> {
  const result = await loginUser(req.body, req);
  res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE);
  sendSuccess(
    res,
    {
      accessToken: result.accessToken,
      user: result.user,
      mustChangePassword: result.mustChangePassword,
    },
    "Login successful",
  );
}

// POST /api/auth/refresh
export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refreshToken as string | undefined;
  if (!token) {
    res
      .status(401)
      .json({ success: false, message: "No refresh token provided" });
    return;
  }
  const tokens = await refreshUserTokens(token);
  res.cookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE);
  sendSuccess(res, { accessToken: tokens.accessToken }, "Token refreshed");
}

// POST /api/auth/logout
export async function logout(req: Request, res: Response): Promise<void> {
  await logoutUser(req.user!.userId);
  res.clearCookie("refreshToken", { path: "/api/auth/refresh" });
  sendSuccess(res, null, "Logged out successfully");
}

// GET /api/auth/me
export async function getMe(req: Request, res: Response): Promise<void> {
  sendSuccess(res, req.user);
}

// PATCH /api/auth/change-password  — voluntary change by any logged-in user
export async function changePassword(
  req: Request,
  res: Response,
): Promise<void> {
  await changeUserPassword(req.user!.userId, req.body);
  res.clearCookie("refreshToken", { path: "/api/auth/refresh" });
  sendSuccess(res, null, "Password changed successfully. Please log in again.");
}

// POST /api/auth/set-password  — forced first-login password set
export async function setInitialPassword(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await forceChangePassword(req.user!.userId, req.body);
  res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE);
  sendSuccess(
    res,
    { accessToken: result.accessToken, user: result.user },
    "Password set. Welcome!",
  );
}
