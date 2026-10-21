import { Router, type IRouter } from "express";
import {
  GetMovementReportQueryParams,
  GetMovementReportResponse,
} from "@workspace/api-zod";
import { listInventoryMovements } from "../lib/namri-inventory";

const router: IRouter = Router();

router.get("/reports/movements", async (req, res): Promise<void> => {
  const query = GetMovementReportQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const movements = await listInventoryMovements({
    warehouseId: query.data.warehouseId,
    limit: null,
  });
  res.json(GetMovementReportResponse.parse(movements));
});

export default router;
