import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { getOrCreateAppUser } from "../lib/app-users";
import type { AppUserRole } from "@workspace/db";

export const requireSignedInUser: RequestHandler = async (
  req,
  res,
  next,
): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "يجب تسجيل الدخول للمتابعة" });
    return;
  }

  req.appUser = await getOrCreateAppUser(userId);
  next();
};

export function requireRole(...roles: AppUserRole[]): RequestHandler {
  return (req, res, next): void => {
    if (!req.appUser || !roles.includes(req.appUser.role)) {
      res.status(403).json({ error: "ليس لديك صلاحية لتنفيذ هذا الإجراء" });
      return;
    }
    next();
  };
}
