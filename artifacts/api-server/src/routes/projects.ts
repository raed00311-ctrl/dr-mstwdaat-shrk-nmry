import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  CreateProjectBody,
  CreateProjectResponse,
  ListProjectsQueryParams,
  ListProjectsResponse,
  UpdateProjectBody,
  UpdateProjectParams,
  UpdateProjectResponse,
} from "@workspace/api-zod";
import { db, projectsTable } from "@workspace/db";
import { requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/projects", async (req, res): Promise<void> => {
  const query = ListProjectsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const projects = await db
    .select()
    .from(projectsTable)
    .where(
      query.data.status
        ? eq(projectsTable.status, query.data.status)
        : undefined,
    )
    .orderBy(desc(projectsTable.createdAt));
  res.json(ListProjectsResponse.parse(projects));
});

router.post(
  "/projects",
  requireRole("admin", "warehouse_manager"),
  async (req, res): Promise<void> => {
    const parsed = CreateProjectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [project] = await db
      .insert(projectsTable)
      .values({
        name: parsed.data.name.trim(),
        location: parsed.data.location?.trim() || null,
      })
      .returning();
    res.status(201).json(CreateProjectResponse.parse(project));
  },
);

router.patch(
  "/projects/:id",
  requireRole("admin", "warehouse_manager"),
  async (req, res): Promise<void> => {
    const params = UpdateProjectParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateProjectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (Object.keys(parsed.data).length === 0) {
      res.status(400).json({ error: "أدخل تعديلاً واحدًا على الأقل للمشروع" });
      return;
    }

    const updated = await db
      .update(projectsTable)
      .set({
        ...(parsed.data.name !== undefined
          ? { name: parsed.data.name.trim() }
          : {}),
        ...(parsed.data.location !== undefined
          ? { location: parsed.data.location.trim() || null }
          : {}),
        ...(parsed.data.status !== undefined
          ? { status: parsed.data.status }
          : {}),
      })
      .where(eq(projectsTable.id, params.data.id))
      .returning();
    const project = updated[0];
    if (!project) {
      res.status(404).json({ error: "المشروع غير موجود" });
      return;
    }
    res.json(UpdateProjectResponse.parse(project));
  },
);

export default router;
