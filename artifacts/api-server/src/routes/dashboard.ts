import { Router, type IRouter } from "express";
import {
  GetDashboardResponse,
  ListMovementsResponse,
} from "@workspace/api-zod";
import {
  ensureDefaultWarehouses,
  getMonthlyMovements,
  listActiveProjects,
  listInventoryItems,
  listInventoryMovements,
} from "../lib/namri-inventory";

const router: IRouter = Router();

router.get("/dashboard", async (_req, res): Promise<void> => {
  const now = new Date();
  const firstMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
  );
  const firstMonthKey = firstMonth.toISOString().slice(0, 10);
  const currentMonthKey = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 7);

  const [items, warehouses, projects, monthlyRecords, recentMovements] =
    await Promise.all([
      listInventoryItems(),
      ensureDefaultWarehouses(),
      listActiveProjects(),
      getMonthlyMovements(firstMonthKey),
      listInventoryMovements({ limit: 8 }),
    ]);

  const monthlyMap = new Map<
    string,
    { month: string; inbound: number; outbound: number }
  >();
  for (let offset = 0; offset < 6; offset += 1) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + offset, 1),
    );
    const key = date.toISOString().slice(0, 7);
    monthlyMap.set(key, {
      month: new Intl.DateTimeFormat("ar-JO", { month: "short" }).format(date),
      inbound: 0,
      outbound: 0,
    });
  }

  let monthlyInbound = 0;
  let monthlyOutbound = 0;
  for (const movement of monthlyRecords) {
    const monthKey = movement.occurredOn.slice(0, 7);
    const bucket = monthlyMap.get(monthKey);
    if (!bucket) continue;
    if (movement.type === "in") {
      bucket.inbound += movement.quantity;
      if (monthKey === currentMonthKey) monthlyInbound += movement.quantity;
    }
    if (movement.type === "out") {
      bucket.outbound += movement.quantity;
      if (monthKey === currentMonthKey) monthlyOutbound += movement.quantity;
    }
  }

  const warehouseSummaries = warehouses.map((warehouse) => {
    const warehouseStocks = items.map(
      (item) =>
        item.warehouseStocks.find(
          (stock) => stock.warehouseId === warehouse.id,
        )?.quantity ?? 0,
    );
    return {
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      itemCount: items.length,
      totalUnits: warehouseStocks.reduce((sum, quantity) => sum + quantity, 0),
    };
  });

  const lowStockItems = items
    .filter((item) => item.totalStock <= item.minStock)
    .sort((left, right) => {
      const leftRatio = left.minStock > 0 ? left.totalStock / left.minStock : 0;
      const rightRatio =
        right.minStock > 0 ? right.totalStock / right.minStock : 0;
      return leftRatio - rightRatio;
    })
    .slice(0, 6);

  res.json(
    GetDashboardResponse.parse({
      totalItems: items.length,
      monthlyInbound,
      monthlyOutbound,
      lowStockCount: items.filter((item) => item.totalStock <= item.minStock)
        .length,
      activeProjectCount: projects.length,
      monthlyMovements: Array.from(monthlyMap.values()),
      warehouseSummaries,
      lowStockItems,
      recentMovements: ListMovementsResponse.parse(recentMovements),
    }),
  );
});

export default router;
