import { Router, type IRouter } from "express";
import { and, eq, ne, sql } from "drizzle-orm";
import {
  GetCurrentUserResponse,
  ListUsersResponse,
  UpdateUserRoleBody,
  UpdateUserRoleParams,
  UpdateUserRoleResponse,
} from "@workspace/api-zod";
import { db, appUsersTable } from "@workspace/db";
import { getAppUser } from "../lib/app-users";
import { requireRole } from "../middlewares/auth";

const router: IRouter = Router();
const USER_ROLE_LOCK_ID = 77190413;

router.get("/users/me", (req, res): void => {
  res.json(GetCurrentUserResponse.parse(getAppUser(req)));
});

router.get(
  "/users",
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const users = await db
      .select()
      .from(appUsersTable)
      .orderBy(appUsersTable.createdAt);
    res.json(ListUsersResponse.parse(users));
  },
);

router.patch(
  "/users/:id/role",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const params = UpdateUserRoleParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateUserRoleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${USER_ROLE_LOCK_ID})`);
      const [target] = await tx
        .select()
        .from(appUsersTable)
        .where(eq(appUsersTable.id, params.data.id))
        .limit(1);
      if (!target) return { kind: "missing" as const };

      if (target.role === "admin" && parsed.data.role !== "admin") {
        const [anotherAdmin] = await tx
          .select({ id: appUsersTable.id })
          .from(appUsersTable)
          .where(
            and(
              eq(appUsersTable.role, "admin"),
              ne(appUsersTable.id, target.id),
            ),
          )
          .limit(1);
        if (!anotherAdmin) return { kind: "last-admin" as const };
      }

      const [updated] = await tx
        .update(appUsersTable)
        .set({ role: parsed.data.role })
        .where(eq(appUsersTable.id, params.data.id))
        .returning();
      return { kind: "updated" as const, user: updated };
    });

    if (result.kind === "missing") {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }
    if (result.kind === "last-admin") {
      res.status(400).json({
        error: "لا يمكن سحب صلاحية المدير الوحيد في النظام",
      });
      return;
    }
    res.json(UpdateUserRoleResponse.parse(result.user));
  },
);

export default router;
