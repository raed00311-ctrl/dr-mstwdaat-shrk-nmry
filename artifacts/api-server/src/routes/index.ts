import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { requireSignedInUser } from "../middlewares/auth";
import dashboardRouter from "./dashboard";
import inventoryRouter from "./inventory";
import projectsRouter from "./projects";
import movementsRouter from "./movements";
import usersRouter from "./users";
import backupRouter from "./backup";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireSignedInUser);
router.use(dashboardRouter);
router.use(inventoryRouter);
router.use(projectsRouter);
router.use(movementsRouter);
router.use(usersRouter);
router.use(backupRouter);

export default router;
