import { clerkClient } from "@clerk/express";
import { db, appUsersTable, type AppUser } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const FIRST_ADMIN_LOCK_ID = 77190412;

export async function getOrCreateAppUser(userId: string): Promise<AppUser> {
  const [existingUser] = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.id, userId))
    .limit(1);

  if (existingUser) {
    if (existingUser.name && existingUser.email) return existingUser;

    const clerkUser = await clerkClient.users.getUser(userId);
    const [updatedUser] = await db
      .update(appUsersTable)
      .set({
        name: existingUser.name || clerkUser.fullName || clerkUser.username || "",
        email:
          existingUser.email ||
          clerkUser.primaryEmailAddress?.emailAddress ||
          "",
      })
      .where(eq(appUsersTable.id, userId))
      .returning();
    return updatedUser ?? existingUser;
  }

  const clerkUser = await clerkClient.users.getUser(userId);
  const name = clerkUser.fullName || clerkUser.username || "";
  const email = clerkUser.primaryEmailAddress?.emailAddress || "";

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${FIRST_ADMIN_LOCK_ID})`);

    const [racedUser] = await tx
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.id, userId))
      .limit(1);
    if (racedUser) return racedUser;

    const [admin] = await tx
      .select({ id: appUsersTable.id })
      .from(appUsersTable)
      .where(eq(appUsersTable.role, "admin"))
      .limit(1);

    const [createdUser] = await tx
      .insert(appUsersTable)
      .values({
        id: userId,
        name,
        email,
        role: admin ? "viewer" : "admin",
      })
      .returning();

    return createdUser;
  });
}

export function getAppUser(req: Express.Request): AppUser {
  if (!req.appUser) {
    throw new Error("Authenticated application profile was not initialized");
  }
  return req.appUser;
}
