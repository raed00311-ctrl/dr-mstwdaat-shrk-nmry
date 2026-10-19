import { Router, type IRouter } from "express";
import { GetBackupExportResponse } from "@workspace/api-zod";
import {
  appUsersTable,
  db,
  inventoryBalancesTable,
  inventoryMovementsTable,
  itemsTable,
  projectsTable,
  warehousesTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.get(
  "/backup/export",
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const [
      warehouses,
      items,
      balances,
      projects,
      users,
      movements,
    ] = await Promise.all([
      db.select().from(warehousesTable),
      db.select().from(itemsTable),
      db.select().from(inventoryBalancesTable),
      db.select().from(projectsTable),
      db.select().from(appUsersTable),
      db.select().from(inventoryMovementsTable),
    ]);

    const exportedAt = new Date().toISOString();
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="namri-inventory-backup-${exportedAt.slice(0, 10)}.json"`,
    );
    res.json(
      GetBackupExportResponse.parse({
        schemaVersion: 1,
        exportedAt,
        data: { warehouses, items, balances, projects, users, movements },
      }),
    );
  },
);

export default router;
