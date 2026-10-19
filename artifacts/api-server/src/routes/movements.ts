import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  CreateMovementBody,
  CreateMovementResponse,
  ListMovementsQueryParams,
  ListMovementsResponse,
  RecordStockCountBody,
  RecordStockCountResponse,
} from "@workspace/api-zod";
import {
  db,
  inventoryBalancesTable,
  inventoryMovementsTable,
  itemsTable,
  projectsTable,
  warehousesTable,
} from "@workspace/db";
import { getAppUser } from "../lib/app-users";
import {
  listInventoryMovements,
  roundMoney,
  roundUnitCost,
} from "../lib/namri-inventory";
import { requireRole } from "../middlewares/auth";

const router: IRouter = Router();

class InsufficientStockError extends Error {}

function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function toSqlDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function lockBalance(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  itemId: number,
  warehouseId: number,
) {
  await tx
    .insert(inventoryBalancesTable)
    .values({ itemId, warehouseId, quantity: 0 })
    .onConflictDoNothing();
  const [balance] = await tx
    .select()
    .from(inventoryBalancesTable)
    .where(
      and(
        eq(inventoryBalancesTable.itemId, itemId),
        eq(inventoryBalancesTable.warehouseId, warehouseId),
      ),
    )
    .limit(1)
    .for("update");
  return balance;
}

router.get("/movements", async (req, res): Promise<void> => {
  const query = ListMovementsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const movements = await listInventoryMovements(query.data);
  res.json(ListMovementsResponse.parse(movements));
});

router.post(
  "/movements",
  requireRole("warehouse_manager"),
  async (req, res): Promise<void> => {
    const parsed = CreateMovementBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const input = parsed.data;
    const quantity = roundQuantity(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      res.status(400).json({ error: "أدخل كمية أكبر من صفر وبحد أقصى 3 منازل عشرية" });
      return;
    }

    if (input.type === "out" && !input.projectId) {
      res.status(400).json({ error: "حدد المشروع المستلم قبل تسجيل الصرف" });
      return;
    }

    const [item] = await db
      .select()
      .from(itemsTable)
      .where(eq(itemsTable.id, input.itemId))
      .limit(1);
    const [warehouse] = await db
      .select()
      .from(warehousesTable)
      .where(eq(warehousesTable.id, input.warehouseId))
      .limit(1);
    const [project] = input.projectId
      ? await db
          .select()
          .from(projectsTable)
          .where(
            and(
              eq(projectsTable.id, input.projectId),
              eq(projectsTable.status, "active"),
            ),
          )
          .limit(1)
      : [undefined];

    if (!item || !warehouse || (input.type === "out" && !project)) {
      res.status(400).json({
        error: "تحقق من المادة والمستودع والمشروع النشط المحدد",
      });
      return;
    }

    const user = getAppUser(req);
    let savedMovement;
    try {
      savedMovement = await db.transaction(async (tx) => {
        const balance = await lockBalance(tx, item.id, warehouse.id);
        if (!balance) throw new Error("تعذر قراءة رصيد المادة");

        if (input.type === "out" && quantity > balance.quantity) {
          throw new InsufficientStockError("الكمية المطلوبة أكبر من الرصيد المتاح");
        }

        const nextQuantity =
          input.type === "in"
            ? roundQuantity(balance.quantity + quantity)
            : roundQuantity(balance.quantity - quantity);
        const unitCost =
          input.type === "in"
            ? roundUnitCost(input.unitCost ?? balance.averageUnitCost)
            : balance.averageUnitCost;
        const nextAverageUnitCost =
          input.type === "in" && nextQuantity > 0
            ? roundUnitCost(
                (balance.quantity * balance.averageUnitCost +
                  quantity * unitCost) /
                  nextQuantity,
              )
            : balance.averageUnitCost;
        const totalValue = roundMoney(quantity * unitCost);
        await tx
          .update(inventoryBalancesTable)
          .set({
            quantity: nextQuantity,
            averageUnitCost: nextAverageUnitCost,
            updatedAt: new Date(),
          })
          .where(eq(inventoryBalancesTable.id, balance.id));

        const [movement] = await tx
          .insert(inventoryMovementsTable)
          .values({
            itemId: item.id,
            warehouseId: warehouse.id,
            type: input.type,
            quantity,
            unitCost,
            totalValue,
            supplier: input.supplier?.trim() || null,
            invoiceNumber: input.invoiceNumber?.trim() || null,
            projectId: project?.id ?? null,
            recipient: input.recipient?.trim() || null,
            notes: input.notes?.trim() || null,
            occurredOn: toSqlDate(input.occurredOn),
            actorId: user.id,
          })
          .returning();

        return {
          id: movement.id,
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          type: movement.type,
          quantity: movement.quantity,
          unitCost: movement.unitCost,
          totalValue: movement.totalValue,
          supplier: movement.supplier,
          invoiceNumber: movement.invoiceNumber,
          projectId: project?.id ?? null,
          projectName: project?.name ?? null,
          recipient: movement.recipient,
          notes: movement.notes,
          occurredOn: movement.occurredOn,
          actorName: user.name,
          createdAt: movement.createdAt,
        };
      });
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }

    res.status(201).json(CreateMovementResponse.parse(savedMovement));
  },
);

router.post(
  "/inventory/counts",
  requireRole("warehouse_manager"),
  async (req, res): Promise<void> => {
    const parsed = RecordStockCountBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const input = parsed.data;
    const countedStock = roundQuantity(input.countedStock);
    if (!Number.isFinite(countedStock) || countedStock < 0) {
      res.status(400).json({ error: "أدخل رصيدًا صحيحًا للجرد" });
      return;
    }

    const [item] = await db
      .select()
      .from(itemsTable)
      .where(eq(itemsTable.id, input.itemId))
      .limit(1);
    const [warehouse] = await db
      .select()
      .from(warehousesTable)
      .where(eq(warehousesTable.id, input.warehouseId))
      .limit(1);
    if (!item || !warehouse) {
      res.status(404).json({ error: "المادة أو المستودع غير موجود" });
      return;
    }

    const user = getAppUser(req);
    const movement = await db.transaction(async (tx) => {
      const balance = await lockBalance(tx, item.id, warehouse.id);
      if (!balance) throw new Error("تعذر قراءة رصيد المادة");
      const adjustment = roundQuantity(countedStock - balance.quantity);
      const totalValue = roundMoney(adjustment * balance.averageUnitCost);
      await tx
        .update(inventoryBalancesTable)
        .set({ quantity: countedStock, updatedAt: new Date() })
        .where(eq(inventoryBalancesTable.id, balance.id));

      const [created] = await tx
        .insert(inventoryMovementsTable)
        .values({
          itemId: item.id,
          warehouseId: warehouse.id,
          type: "adjustment",
          quantity: adjustment,
          unitCost: balance.averageUnitCost,
          totalValue,
          notes: input.notes?.trim() || "تسوية جرد فعلي",
          occurredOn: toSqlDate(input.occurredOn),
          actorId: user.id,
        })
        .returning();

      return {
        id: created.id,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        type: created.type,
        quantity: created.quantity,
        unitCost: created.unitCost,
        totalValue: created.totalValue,
        supplier: null,
        invoiceNumber: null,
        projectId: null,
        projectName: null,
        recipient: null,
        notes: created.notes,
        occurredOn: created.occurredOn,
        actorName: user.name,
        createdAt: created.createdAt,
      };
    });

    res.status(201).json(RecordStockCountResponse.parse(movement));
  },
);

export default router;
