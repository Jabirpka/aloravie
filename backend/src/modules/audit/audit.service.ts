import { prisma } from "../../prisma.js";
import { logger } from "../../logger.js";

// Human summaries for the common admin mutations (keyed by normalized route).
const SUMMARIES: Record<string, string> = {
  "PATCH /orders/:id/status": "Changed an order's status",
  "POST /orders/:id/shipment": "Booked a shipment",
  "POST /shipments/:id/sync": "Synced shipment tracking",
  "POST /returns/:id/approve": "Approved a return",
  "POST /returns/:id/reject": "Rejected a return",
  "POST /returns/:id/refund": "Refunded a return",
  "POST /coupons": "Created a coupon",
  "PATCH /coupons/:id": "Updated a coupon",
  "POST /categories": "Created a category",
  "PATCH /categories/:id": "Renamed a category",
  "DELETE /categories/:id": "Deleted a category",
  "POST /employees": "Added an employee",
  "PATCH /employees/:id": "Updated an employee",
  "POST /inventory/adjust": "Adjusted stock",
  "PATCH /products/:id": "Updated a product",
  "POST /channels/:id/connect": "Connected a channel",
  "POST /channels/:id/push-inventory": "Pushed inventory to a channel",
  "POST /channels/:id/pull-orders": "Pulled marketplace orders",
  "PATCH /reviews/:id": "Moderated a review",
  "POST /support/:id/reply": "Replied to a support message",
  "POST /support/:id/close": "Closed a support conversation",
};

function normalize(path: string): { norm: string; entityId?: string } {
  const parts = path.split("/").filter(Boolean);
  let entityId: string | undefined;
  const norm = parts.map((p) => {
    if (/^c[a-z0-9]{20,}$/i.test(p) || /^[a-z0-9]{24,}$/i.test(p)) {
      entityId = entityId ?? p;
      return ":id";
    }
    return p;
  });
  return { norm: "/" + norm.join("/"), entityId };
}

export function describeAction(method: string, path: string) {
  const { norm, entityId } = normalize(path);
  const key = `${method} ${norm}`;
  const entity = norm.split("/").filter(Boolean)[0] ?? "admin";
  return { action: key, summary: SUMMARIES[key] ?? `${method} ${entity}`, entity, entityId };
}

export async function recordAudit(entry: {
  actorId: string | null;
  actorName: string;
  actorEmail: string;
  action: string;
  summary: string;
  entity?: string;
  entityId?: string;
  method: string;
  path: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({ data: entry });
  } catch (err) {
    logger.error({ err }, "audit write failed");
  }
}

export function listAudit(limit = 150) {
  return prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}
