import { Router } from "express";
import { z } from "zod";
import { asyncHandler, unauthorized } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { requireAccess } from "../../middleware/access.js";
import * as employees from "./employees.service.js";

// Administration: staff accounts, roles and department access. OWNER/ADMIN only.
export const employeeRouter: Router = Router();

// Per-route guard (shares the /api/admin mount with other routers).
employeeRouter.use(authenticate);
const admin = requireAccess("employees");

const role = z.enum(["OWNER", "ADMIN", "STAFF"]);
const departments = z.array(z.enum(["RETURNS", "PACKING", "CUSTOMER_CARE", "OFFERS", "CRM"]));

employeeRouter.get(
  "/employees",
  admin,
  asyncHandler(async (_req, res) => {
    res.json({ employees: await employees.listEmployees() });
  }),
);

employeeRouter.post(
  "/employees",
  admin,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        role: role.default("STAFF"),
        departments: departments.default([]),
      })
      .parse(req.body);
    res.status(201).json({ employee: await employees.createEmployee(input) });
  }),
);

employeeRouter.patch(
  "/employees/:id",
  admin,
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const input = z
      .object({
        name: z.string().min(1).optional(),
        role: role.optional(),
        departments: departments.optional(),
        isActive: z.boolean().optional(),
        password: z.string().min(8).optional(),
      })
      .parse(req.body);
    res.json({ employee: await employees.updateEmployee(id, req.user.sub, input) });
  }),
);
