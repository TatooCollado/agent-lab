import { Router, type RequestHandler, type Response } from "express";
import type { SessionUser } from "../auth/contracts.js";
import {
  attendanceInputSchema,
  departmentInputSchema,
  employeeInputSchema,
  resourceIdSchema,
} from "./contracts.js";
import type { DataExplorerService } from "./service.js";

function databaseError(error: unknown, res: Response): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : null;
  if (code === "23505") {
    res.status(409).json({ error: "resource_already_exists" });
    return true;
  }
  if (code === "23503") {
    res.status(409).json({ error: "resource_in_use_or_reference_invalid" });
    return true;
  }
  if (code === "23514" || code === "22P02") {
    res.status(400).json({ error: "database_constraint_rejected" });
    return true;
  }
  return false;
}

export function createDataExplorerRouter(
  requireSession: RequestHandler,
  requireAdmin: RequestHandler,
  getService: () => DataExplorerService,
) {
  const router = Router();
  router.use(requireSession);

  router.get("/snapshot", async (_req, res) => {
    res.json(await getService().snapshot());
  });

  const resources = [
    {
      path: "departments",
      schema: departmentInputSchema,
      create: "createDepartment",
      update: "updateDepartment",
      remove: "deleteDepartment",
      responseKey: "department",
    },
    {
      path: "employees",
      schema: employeeInputSchema,
      create: "createEmployee",
      update: "updateEmployee",
      remove: "deleteEmployee",
      responseKey: "employee",
    },
    {
      path: "attendance",
      schema: attendanceInputSchema,
      create: "createAttendance",
      update: "updateAttendance",
      remove: "deleteAttendance",
      responseKey: "attendanceRecord",
    },
  ] as const;

  for (const resource of resources) {
    router.post(`/${resource.path}`, requireAdmin, async (req, res, next) => {
      const parsed = resource.schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_resource", details: parsed.error.issues });
        return;
      }
      try {
        const service = getService() as any;
        const item = await service[resource.create](parsed.data, res.locals.user as SessionUser);
        res.status(201).json({ [resource.responseKey]: item });
      } catch (error) {
        if (!databaseError(error, res)) next(error);
      }
    });

    router.put(`/${resource.path}/:id`, requireAdmin, async (req, res, next) => {
      const id = resourceIdSchema.safeParse(req.params.id);
      const body = resource.schema.safeParse(req.body);
      if (!id.success || !body.success) {
        res.status(400).json({ error: "invalid_resource" });
        return;
      }
      try {
        const service = getService() as any;
        const item = await service[resource.update](id.data, body.data, res.locals.user as SessionUser);
        if (!item) {
          res.status(404).json({ error: "resource_not_found" });
          return;
        }
        res.json({ [resource.responseKey]: item });
      } catch (error) {
        if (!databaseError(error, res)) next(error);
      }
    });

    router.delete(`/${resource.path}/:id`, requireAdmin, async (req, res, next) => {
      const id = resourceIdSchema.safeParse(req.params.id);
      if (!id.success) {
        res.status(400).json({ error: "invalid_resource_id" });
        return;
      }
      try {
        const service = getService() as any;
        const deleted = await service[resource.remove](id.data, res.locals.user as SessionUser);
        if (!deleted) {
          res.status(404).json({ error: "resource_not_found" });
          return;
        }
        res.status(204).end();
      } catch (error) {
        if (!databaseError(error, res)) next(error);
      }
    });
  }

  return router;
}
