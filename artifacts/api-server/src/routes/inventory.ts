import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  CreateItemBody,
  CreateItemResponse,
  GetInventoryReportQueryParams,
  GetInventoryReportResponse,
  ListItemsQueryParams,
  ListItemsResponse,
  ListWarehousesResponse,
  UpdateItemBody,
  UpdateItemParams,
  UpdateItemResponse,
} from "@workspace/api-zod";
import {
  db,
  inventoryBalancesTable,
  inventoryMovementsTable,
  itemsTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/auth";
import { getAppUser } from "../lib/app-users";
import {
  ensureDefaultWarehouses,
  listInventoryItems,
  roundMoney,
  roundUnitCost,
} from "../lib/namri-inventory";

const router: IRouter = Router();

router.get("/warehouses", async (_req, res): Promise<void> => {
  const warehouses = await ensureDefaultWarehouses();
  res.json(ListWarehousesResponse.parse(warehouses));
});

router.get("/items", async (req, res): Promise<void> => {
  const query = ListItemsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const items = await listInventoryItems(query.data);
  res.json(ListItemsResponse.parse(items));
});

router.post(
  "/items",
  requireRole("warehouse_manager"),
  async (req, res): Promise<void> => {
    const parsed = CreateItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const warehouses = await ensureDefaultWarehouses();
    if (!warehouses.some((warehouse) => warehouse.id === parsed.data.warehouseId)) {
      res.status(400).json({ error: "المستودع المحدد غير موجود" });
      return;
    }

    const user = getAppUser(req);
    const initialUnitCost = roundUnitCost(parsed.data.initialUnitCost ?? 0);
    let createdId: number;
    try {
      createdId = await db.transaction(async (tx) => {
        const [item] = await tx
          .insert(itemsTable)
          .values({
            code: parsed.data.code.trim(),
            name: parsed.data.name.trim(),
            category: parsed.data.category.trim(),
            unit: parsed.data.unit.trim(),
            minStock: parsed.data.minStock,
          })
          .returning();

        await tx.insert(inventoryBalancesTable).values(
          warehouses.map((warehouse) => ({
            itemId: item.id,
            warehouseId: warehouse.id,
            quantity:
              warehouse.id === parsed.data.warehouseId
                ? parsed.data.initialStock
                : 0,
            averageUnitCost:
              warehouse.id === parsed.data.warehouseId
                ? initialUnitCost
                : 0,
          })),
        );

        if (parsed.data.initialStock > 0) {
          await tx.insert(inventoryMovementsTable).values({
            itemId: item.id,
            warehouseId: parsed.data.warehouseId,
            type: "in",
            quantity: parsed.data.initialStock,
            unitCost: initialUnitCost,
            totalValue: roundMoney(parsed.data.initialStock * initialUnitCost),
            supplier: "رصيد افتتاحي",
            notes: "رصيد افتتاحي عند إضافة المادة",
            occurredOn: new Date().toISOString().slice(0, 10),
            actorId: user.id,
          });
        }
        return item.id;
      });
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
        res.status(409).json({ error: "رمز المادة مستخدم مسبقًا" });
        return;
      }
      throw error;
    }

    const [createdItem] = (await listInventoryItems()).filter(
      (item) => item.id === createdId,
    );
    res.status(201).json(CreateItemResponse.parse(createdItem));
  },
);

router.patch(
  "/items/:id",
  requireRole("warehouse_manager"),
  async (req, res): Promise<void> => {
    const params = UpdateItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const values: Partial<typeof itemsTable.$inferInsert> = {};
    if (parsed.data.code !== undefined) values.code = parsed.data.code.trim();
    if (parsed.data.name !== undefined) values.name = parsed.data.name.trim();
    if (parsed.data.category !== undefined) {
      values.category = parsed.data.category.trim();
    }
    if (parsed.data.unit !== undefined) values.unit = parsed.data.unit.trim();
    if (parsed.data.minStock !== undefined) {
      values.minStock = parsed.data.minStock;
    }

    if (Object.keys(values).length > 0) {
      try {
        const updated = await db
          .update(itemsTable)
          .set(values)
          .where(eq(itemsTable.id, params.data.id))
          .returning({ id: itemsTable.id });
        if (updated.length === 0) {
          res.status(404).json({ error: "المادة غير موجودة" });
          return;
        }
      } catch (error) {
        if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
          res.status(409).json({ error: "رمز المادة مستخدم مسبقًا" });
          return;
        }
        throw error;
      }
    }

    const [item] = (await listInventoryItems()).filter(
      (candidate) => candidate.id === params.data.id,
    );
    if (!item) {
      res.status(404).json({ error: "المادة غير موجودة" });
      return;
    }
    res.json(UpdateItemResponse.parse(item));
  },
);

router.get("/reports/inventory", async (req, res): Promise<void> => {
  const query = GetInventoryReportQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const [items] = await Promise.all([listInventoryItems()]);
  const rows = items.flatMap((item) =>
    item.warehouseStocks
      .filter(
        (stock) =>
          !query.data.warehouseId ||
          stock.warehouseId === query.data.warehouseId,
      )
      .map((stock) => ({
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        warehouseName: stock.warehouseName,
        quantity: stock.quantity,
        minStock: item.minStock,
        averageUnitCost: stock.averageUnitCost,
        stockValue: stock.stockValue,
        lowStock: item.totalStock <= item.minStock,
      })),
  );
  res.json(GetInventoryReportResponse.parse(rows));
});

export default router;
