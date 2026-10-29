import type { Prisma, ReturnReason, ReturnStatus } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { badRequest, forbidden, notFound } from "../../lib/http.js";
import { refundOrderPayment } from "../payments/payments.service.js";
import { bookReturnPickup as courierBookReturnPickup, courierMode, nextReturnMockUpdate } from "../fulfilment/courier.service.js";

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
  returnEvents: { orderBy: { occurredAt: "asc" } },
} as const;

interface PickupAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

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

// Restock the returned units to the default location (used after a passed inspection).
async function restockItems(tx: Prisma.TransactionClient, items: ReturnItemSnapshot[]) {
  let location = await tx.location.findFirst({ where: { isDefault: true } });
  if (!location) location = await tx.location.findFirst();
  if (!location) return;
  for (const it of items) {
    await tx.inventoryItem.updateMany({
      where: { variantId: it.variantId, locationId: location.id },
      data: { onHand: { increment: it.quantity } },
    });
  }
}

// Approve the request. Stock is NOT returned yet — that happens only once the
// item is physically back and passes inspection.
export async function approveReturn(id: string, note?: string) {
  const r = await prisma.returnRequest.findUnique({ where: { id } });
  if (!r) throw notFound("Return not found");
  if (r.status !== "REQUESTED") throw badRequest(`Return is already ${r.status.toLowerCase()}`);
  return prisma.returnRequest.update({ where: { id }, data: { status: "APPROVED", staffNote: note }, include });
}

export async function rejectReturn(id: string, note?: string) {
  const r = await prisma.returnRequest.findUnique({ where: { id } });
  if (!r) throw notFound("Return not found");
  if (r.status !== "REQUESTED" && r.status !== "RECEIVED") {
    throw badRequest(`A ${r.status.toLowerCase()} return can't be rejected`);
  }
  return prisma.returnRequest.update({ where: { id }, data: { status: "REJECTED", staffNote: note }, include });
}

// Book a reverse pickup: a courier collects the item from the customer's address.
export async function bookPickup(id: string) {
  const r = await prisma.returnRequest.findUnique({ where: { id } });
  if (!r) throw notFound("Return not found");
  if (r.status !== "APPROVED") throw badRequest("Approve the return before booking a pickup");

  const order = await prisma.order.findUnique({ where: { id: r.orderId } });
  const addr = order?.shippingAddress as unknown as PickupAddress | null;
  if (!addr) throw badRequest("The order has no address to collect from");

  const booking = await courierBookReturnPickup({ orderNumber: order!.orderNumber, shipTo: addr });

  return prisma.$transaction(async (tx) => {
    await tx.returnTrackingEvent.create({
      data: { returnId: id, status: `Pickup booked (${booking.courierName})`, occurredAt: new Date() },
    });
    return tx.returnRequest.update({
      where: { id },
      data: {
        status: "PICKUP_BOOKED",
        pickupProvider: booking.provider,
        pickupCourier: booking.courierName,
        pickupAwb: booking.awb || null,
        pickupTrackingUrl: booking.trackingUrl || null,
        pickupStatus: "LABEL_READY",
        pickupBookedAt: new Date(),
      },
      include,
    });
  });
}

// Advance the return's tracking. Mock steps one stage per call; reaching the
// warehouse flips the return to RECEIVED.
export async function syncReturnTracking(id: string) {
  const r = await prisma.returnRequest.findUnique({ where: { id } });
  if (!r) throw notFound("Return not found");
  if (r.status !== "PICKUP_BOOKED" && r.status !== "IN_TRANSIT") {
    throw badRequest("This return isn't out for pickup");
  }
  if (courierMode() === "shiprocket") {
    throw badRequest("Live Shiprocket tracking arrives via webhook — use “Mark received” when the item arrives.");
  }

  const update = nextReturnMockUpdate(r.pickupStatus);
  if (!update) return prisma.returnRequest.findUniqueOrThrow({ where: { id }, include });
  const received = update.status === "DELIVERED";

  return prisma.$transaction(async (tx) => {
    await tx.returnTrackingEvent.create({
      data: { returnId: id, status: update.label, location: update.location ?? null, occurredAt: update.occurredAt },
    });
    return tx.returnRequest.update({
      where: { id },
      data: {
        pickupStatus: update.status,
        status: received ? "RECEIVED" : "IN_TRANSIT",
        ...(received ? { receivedAt: new Date() } : {}),
      },
      include,
    });
  });
}

// Mark the item physically received (manual alternative to tracking, or for a
// customer who ships it back themselves).
export async function markReceived(id: string) {
  const r = await prisma.returnRequest.findUnique({ where: { id } });
  if (!r) throw notFound("Return not found");
  if (!["APPROVED", "PICKUP_BOOKED", "IN_TRANSIT"].includes(r.status)) {
    throw badRequest(`A ${r.status.toLowerCase()} return can't be marked received`);
  }
  return prisma.$transaction(async (tx) => {
    await tx.returnTrackingEvent.create({
      data: { returnId: id, status: "Received at warehouse", occurredAt: new Date() },
    });
    return tx.returnRequest.update({
      where: { id },
      data: { status: "RECEIVED", receivedAt: new Date(), ...(r.pickupStatus ? { pickupStatus: "DELIVERED" } : {}) },
      include,
    });
  });
}

// Physical check after receipt. Pass → restock + refund + order RETURNED.
// Fail → reject with no refund and no restock.
export async function inspectReturn(id: string, passed: boolean, note?: string) {
  const r = await prisma.returnRequest.findUnique({ where: { id } });
  if (!r) throw notFound("Return not found");
  if (r.status !== "RECEIVED") throw badRequest("Mark the return received before inspecting it");
  const items = snapshotItems(r.items);

  if (!passed) {
    return prisma.returnRequest.update({
      where: { id },
      data: { status: "REJECTED", inspectedAt: new Date(), inspectionPassed: false, inspectionNote: note },
      include,
    });
  }

  const refundAmountMinor = items.reduce((s, it) => s + it.unitPriceMinor * it.quantity, 0);
  // External refund call happens before the transaction (never hold a DB tx open
  // across a network call); if it throws, the return stays RECEIVED to retry.
  const { refundId } = await refundOrderPayment(r.orderId, refundAmountMinor, { returnId: id });

  return prisma.$transaction(async (tx) => {
    await restockItems(tx, items);
    await tx.order.update({ where: { id: r.orderId }, data: { status: "RETURNED" } });
    return tx.returnRequest.update({
      where: { id },
      data: {
        status: "REFUNDED",
        refundAmountMinor,
        refundId,
        inspectedAt: new Date(),
        inspectionPassed: true,
        inspectionNote: note,
      },
      include,
    });
  });
}
