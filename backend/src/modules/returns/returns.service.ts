import type { ReturnReason, ReturnStatus } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { badRequest, forbidden, notFound } from "../../lib/http.js";

export interface ReturnItemInput {
  orderItemId: string;
  quantity: number;
}

interface ReturnItemSnapshot {
  orderItemId: string;
  titleSnapshot: string;
  skuSnapshot: string;
  variantId: string;
  unitPriceMinor: number;
  quantity: number;
}

// Order statuses from which a customer may open a return.
const RETURNABLE_ORDER = ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"];

const include = {
  order: { select: { orderNumber: true, currency: true, placedAt: true } },
  customer: { select: { id: true, name: true, email: true } },
} as const;

// --- Customer ---

export async function createReturn(
  customerId: string,
  input: { orderId: string; reason: ReturnReason; comment?: string; items: ReturnItemInput[]; photoUrls: string[] },
) {
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { items: true } });
  if (!order) throw notFound("Order not found");
  if (order.customerId !== customerId) throw forbidden("This order belongs to another account");
  if (!RETURNABLE_ORDER.includes(order.status)) {
    throw badRequest(`This order can't be returned (status ${order.status})`);
  }
  if (!input.items.length) throw badRequest("Select at least one item to return");

  const byId = new Map(order.items.map((i) => [i.id, i]));
  const items: ReturnItemSnapshot[] = input.items.map((it) => {
    const oi = byId.get(it.orderItemId);
    if (!oi) throw badRequest("An item in the request is not part of this order");
    if (it.quantity < 1 || it.quantity > oi.quantity) throw badRequest("Invalid return quantity");
    return {
      orderItemId: oi.id,
      titleSnapshot: oi.titleSnapshot,
      skuSnapshot: oi.skuSnapshot,
      variantId: oi.variantId,
      unitPriceMinor: oi.unitPriceMinor,
      quantity: it.quantity,
    };
  });

  return prisma.returnRequest.create({
    data: {
      orderId: order.id,
      customerId,
      reason: input.reason,
      comment: input.comment,
      photoUrls: input.photoUrls,
      items: items as unknown as object,
    },
    include,
  });
}

export function listForCustomer(customerId: string) {
  return prisma.returnRequest.findMany({ where: { customerId }, include, orderBy: { createdAt: "desc" } });
}

export async function getForCustomer(customerId: string, id: string) {
  const r = await prisma.returnRequest.findUnique({ where: { id }, include });
  if (!r) throw notFound("Return not found");
  if (r.customerId !== customerId) throw forbidden("This return belongs to another account");
  return r;
}

// --- Admin (RETURNS department) ---

export function adminList(status?: ReturnStatus) {
  return prisma.returnRequest.findMany({
    where: status ? { status } : {},
    include,
    orderBy: { createdAt: "desc" },
  });
}

export async function adminGet(id: string) {
  const r = await prisma.returnRequest.findUnique({ where: { id }, include });
  if (!r) throw notFound("Return not found");
  return r;
}

function snapshotItems(items: unknown): ReturnItemSnapshot[] {
  return (items as ReturnItemSnapshot[]) ?? [];
}

// Approve: restock the returned units to the default location.
export async function approveReturn(id: string, note?: string) {
  const r = await prisma.returnRequest.findUnique({ where: { id } });
  if (!r) throw notFound("Return not found");
  if (r.status !== "REQUESTED") throw badRequest(`Return is already ${r.status.toLowerCase()}`);

  let location = await prisma.location.findFirst({ where: { isDefault: true } });
  if (!location) location = await prisma.location.findFirst();
  const loc = location;
  const items = snapshotItems(r.items);

  return prisma.$transaction(async (tx) => {
    if (loc) {
      for (const it of items) {
        await tx.inventoryItem.updateMany({
          where: { variantId: it.variantId, locationId: loc.id },
          data: { onHand: { increment: it.quantity } },
        });
      }
    }
    return tx.returnRequest.update({ where: { id }, data: { status: "APPROVED", staffNote: note }, include });
  });
}

export async function rejectReturn(id: string, note?: string) {
  const r = await prisma.returnRequest.findUnique({ where: { id } });
  if (!r) throw notFound("Return not found");
  if (r.status !== "REQUESTED") throw badRequest(`Return is already ${r.status.toLowerCase()}`);
  return prisma.returnRequest.update({ where: { id }, data: { status: "REJECTED", staffNote: note }, include });
}

// Refund: compute the amount from the returned items, mark REFUNDED and the order RETURNED.
// (Mock: records the refund; a live Razorpay refund call plugs in here.)
export async function refundReturn(id: string) {
  const r = await prisma.returnRequest.findUnique({ where: { id } });
  if (!r) throw notFound("Return not found");
  if (r.status !== "APPROVED") throw badRequest("Approve the return before refunding");
  const items = snapshotItems(r.items);
  const refundAmountMinor = items.reduce((s, it) => s + it.unitPriceMinor * it.quantity, 0);

  return prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: r.orderId }, data: { status: "RETURNED" } });
    return tx.returnRequest.update({
      where: { id },
      data: { status: "REFUNDED", refundAmountMinor },
      include,
    });
  });
}
