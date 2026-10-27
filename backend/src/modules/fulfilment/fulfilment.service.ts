import { prisma } from "../../prisma.js";
import { AppError, badRequest, conflict, notFound } from "../../lib/http.js";
import {
  bookMockShipment,
  bookShiprocketShipment,
  courierMode,
  nextMockUpdate,
  type BookingInput,
} from "./courier.service.js";
import type { DocAddress } from "./documents.js";
import { notifyOrderEvent } from "../notifications/notifications.service.js";

const shipmentInclude = { events: { orderBy: { occurredAt: "asc" } } } as const;

export async function getShipmentByOrder(orderId: string) {
  return prisma.shipment.findUnique({ where: { orderId }, include: shipmentInclude });
}

// Book a courier shipment for an order, then move the order to SHIPPED.
export async function createShipment(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } });
  if (!order) throw notFound("Order not found");
  if (order.shipment) throw conflict("A shipment already exists for this order");
  if (order.status !== "CONFIRMED" && order.status !== "PACKED") {
    throw badRequest(`Order must be confirmed or packed before shipping (currently ${order.status})`);
  }
  const addr = order.shippingAddress as unknown as DocAddress | null;
  if (!addr) throw badRequest("Order has no shipping address");

  const booking: BookingInput = { orderNumber: order.orderNumber, shipTo: addr };
  const result =
    courierMode() === "shiprocket" ? await bookShiprocketShipment(booking) : bookMockShipment(booking);

  const shipment = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        orderId,
        provider: result.provider,
        courierName: result.courierName,
        awb: result.awb || null,
        trackingUrl: result.trackingUrl || null,
        providerShipmentId: result.providerShipmentId || null,
        status: "LABEL_READY",
        events: { create: { status: "Label generated", occurredAt: new Date() } },
      },
      include: shipmentInclude,
    });
    await tx.order.update({ where: { id: orderId }, data: { status: "SHIPPED" } });
    return created;
  });

  await notifyOrderEvent(orderId, "ORDER_SHIPPED");
  return shipment;
}

// Advance tracking. Mock mode steps the timeline one stage per call; when the
// shipment reaches DELIVERED the order is marked DELIVERED too.
export async function syncTracking(shipmentId: string) {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw notFound("Shipment not found");

  if (courierMode() === "shiprocket") {
    throw new AppError(
      501,
      "NOT_IMPLEMENTED",
      "Live Shiprocket tracking sync is not implemented in this build — tracking arrives via Shiprocket's webhook. Mock mode advances the timeline.",
    );
  }

  const update = nextMockUpdate(shipment.status);
  if (!update) return prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId }, include: shipmentInclude });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.trackingEvent.create({
      data: {
        shipmentId,
        status: update.label,
        location: update.location ?? null,
        occurredAt: update.occurredAt,
      },
    });
    const shp = await tx.shipment.update({
      where: { id: shipmentId },
      data: { status: update.status },
      include: shipmentInclude,
    });
    if (update.status === "DELIVERED") {
      await tx.order.update({ where: { id: shipment.orderId }, data: { status: "DELIVERED" } });
    }
    return shp;
  });

  if (update.status === "DELIVERED") await notifyOrderEvent(shipment.orderId, "ORDER_DELIVERED");
  return updated;
}
