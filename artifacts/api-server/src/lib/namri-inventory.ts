import {
  and,
  desc,
  eq,
  gte,
  ilike,
  or,
  type SQL,
} from "drizzle-orm";
import {
  db,
  appUsersTable,
  inventoryBalancesTable,
  inventoryMovementsTable,
  itemsTable,
  projectsTable,
  warehousesTable,
} from "@workspace/db";

export async function ensureDefaultWarehouses() {
  await db
    .insert(warehousesTable)
    .values([
      {
        name: "المستودع الرئيسي في المفرق",
        location: "المفرق",
        isDefault: true,
      },
      {
        name: "مستودع الموقع / عمان",
        location: "عمان",
        isDefault: false,
      },
    ])
    .onConflictDoNothing();

  return db.select().from(warehousesTable).orderBy(warehousesTable.id);
}

export function roundUnitCost(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function listInventoryItems(filters: {
  q?: string;
  warehouseId?: number;
  category?: string;
} = {}) {
  const items = await db
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.active, true))
    .orderBy(itemsTable.name);
  const warehouses = await ensureDefaultWarehouses();
  const balances = await db
    .select({
      itemId: inventoryBalancesTable.itemId,
      warehouseId: inventoryBalancesTable.warehouseId,
      quantity: inventoryBalancesTable.quantity,
      averageUnitCost: inventoryBalancesTable.averageUnitCost,
    })
    .from(inventoryBalancesTable);

  const balancesByItem = new Map<
    number,
    Map<number, { quantity: number; averageUnitCost: number }>
  >();
  for (const balance of balances) {
    const warehouseBalances =
      balancesByItem.get(balance.itemId) ??
      new Map<number, { quantity: number; averageUnitCost: number }>();
    warehouseBalances.set(balance.warehouseId, {
      quantity: balance.quantity,
      averageUnitCost: balance.averageUnitCost,
    });
    balancesByItem.set(balance.itemId, warehouseBalances);
  }

  const needle = filters.q?.trim().toLocaleLowerCase();
  return items
    .map((item) => {
      const itemBalances = balancesByItem.get(item.id);
      const warehouseStocks = warehouses.map((warehouse) => ({
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        quantity: itemBalances?.get(warehouse.id)?.quantity ?? 0,
        averageUnitCost:
          itemBalances?.get(warehouse.id)?.averageUnitCost ?? 0,
        stockValue: roundMoney(
          (itemBalances?.get(warehouse.id)?.quantity ?? 0) *
            (itemBalances?.get(warehouse.id)?.averageUnitCost ?? 0),
        ),
      }));
      return {
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        minStock: item.minStock,
        totalStock: warehouseStocks.reduce(
          (total, stock) => total + stock.quantity,
          0,
        ),
        totalValue: roundMoney(
          warehouseStocks.reduce((total, stock) => total + stock.stockValue, 0),
        ),
        warehouseStocks,
      };
    })
    .filter((item) => {
      if (needle && !`${item.code} ${item.name}`.toLocaleLowerCase().includes(needle)) {
        return false;
      }
      if (filters.category && item.category !== filters.category) return false;
      if (
        filters.warehouseId &&
        !item.warehouseStocks.some(
          (stock) => stock.warehouseId === filters.warehouseId,
        )
      ) {
        return false;
      }
      return true;
    });
}

export type MovementFilters = {
  q?: string;
  type?: "in" | "out" | "adjustment";
  warehouseId?: number;
  projectId?: number;
  limit?: number;
};

export async function listInventoryMovements(filters: MovementFilters = {}) {
  const conditions: SQL[] = [];
  if (filters.type) {
    conditions.push(eq(inventoryMovementsTable.type, filters.type));
  }
  if (filters.warehouseId) {
    conditions.push(eq(inventoryMovementsTable.warehouseId, filters.warehouseId));
  }
  if (filters.projectId) {
    conditions.push(eq(inventoryMovementsTable.projectId, filters.projectId));
  }
  if (filters.q?.trim()) {
    const query = `%${filters.q.trim()}%`;
    conditions.push(
      or(
        ilike(itemsTable.code, query),
        ilike(itemsTable.name, query),
        ilike(inventoryMovementsTable.invoiceNumber, query),
        ilike(inventoryMovementsTable.supplier, query),
        ilike(projectsTable.name, query),
        ilike(inventoryMovementsTable.recipient, query),
      )!,
    );
  }

  return db
    .select({
      id: inventoryMovementsTable.id,
      itemId: inventoryMovementsTable.itemId,
      itemCode: itemsTable.code,
      itemName: itemsTable.name,
      warehouseId: inventoryMovementsTable.warehouseId,
      warehouseName: warehousesTable.name,
      type: inventoryMovementsTable.type,
      quantity: inventoryMovementsTable.quantity,
      unitCost: inventoryMovementsTable.unitCost,
      totalValue: inventoryMovementsTable.totalValue,
      supplier: inventoryMovementsTable.supplier,
      invoiceNumber: inventoryMovementsTable.invoiceNumber,
      projectId: inventoryMovementsTable.projectId,
      projectName: projectsTable.name,
      recipient: inventoryMovementsTable.recipient,
      notes: inventoryMovementsTable.notes,
      occurredOn: inventoryMovementsTable.occurredOn,
      actorName: appUsersTable.name,
      createdAt: inventoryMovementsTable.createdAt,
    })
    .from(inventoryMovementsTable)
    .innerJoin(itemsTable, eq(itemsTable.id, inventoryMovementsTable.itemId))
    .innerJoin(
      warehousesTable,
      eq(warehousesTable.id, inventoryMovementsTable.warehouseId),
    )
    .leftJoin(
      projectsTable,
      eq(projectsTable.id, inventoryMovementsTable.projectId),
    )
    .innerJoin(appUsersTable, eq(appUsersTable.id, inventoryMovementsTable.actorId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(inventoryMovementsTable.occurredOn), desc(inventoryMovementsTable.id))
    .limit(filters.limit ?? 100);
}

export async function listActiveProjects() {
  return db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.status, "active"))
    .orderBy(desc(projectsTable.createdAt));
}

export async function listAllProjects(status?: "active" | "completed") {
  return db
    .select()
    .from(projectsTable)
    .where(status ? eq(projectsTable.status, status) : undefined)
    .orderBy(desc(projectsTable.createdAt));
}

export async function getMonthlyMovements(since: string) {
  return db
    .select({
      type: inventoryMovementsTable.type,
      quantity: inventoryMovementsTable.quantity,
      occurredOn: inventoryMovementsTable.occurredOn,
    })
    .from(inventoryMovementsTable)
    .where(gte(inventoryMovementsTable.occurredOn, since));
}
