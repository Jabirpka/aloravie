import { Router } from "express";
import { z } from "zod";
import { asyncHandler, unauthorized } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";

// Internal staff message board. Any signed-in staff member can read and post.
// Mounted at /api/team (outside /api/admin so posts don't fill the audit log).
export const teamRouter: Router = Router();

teamRouter.use(authenticate);

teamRouter.get(
  "/messages",
  asyncHandler(async (_req, res) => {
    const messages = await prisma.staffMessage.findMany({ orderBy: { createdAt: "desc" }, take: 60 });
    res.json({ messages });
  }),
);

teamRouter.post(
  "/messages",
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    const { body } = z.object({ body: z.string().min(1).max(2000) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    const message = await prisma.staffMessage.create({
      data: { authorId: req.user.sub, authorName: user?.name ?? "Staff", body: body.trim() },
    });
    res.status(201).json({ message });
  }),
);
