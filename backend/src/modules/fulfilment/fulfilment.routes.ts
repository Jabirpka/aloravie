import { Router } from "express";
import { z } from "zod";
import { asyncHandler, notFound } from "../../lib/http.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";
import { createShipment, syncTracking } from "./fulfilment.service.js";
import {
  renderDeliveryNote,
  renderInvoice,
  renderLabel,
  type DocAddress,
  type DocOrder,
  type DocShipment,
} from "./documents.js";

export const fulfilmentRouter: Router = Router();

fulfilmentRouter.use(authenticate, requireRole("OWNER", "ADMIN", "STAFF"));

const idParam = z.object({ id: z.string().min(1) });
const numberParam = z.object({ orderNumber: z.string().min(1) });

// Book a shipment for an order.
fulfilmentRouter.post(
  "/orders/:id/shipment",
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.status(201).json({ shipment: await createShipment(id) });
  }),
);

// Advance tracking for a shipment.
fulfilmentRouter.post(
  "/shipments/:id/sync",
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json({ shipment: await syncTracking(id) });
  }),
);

// --- Documents (returned as printable HTML) ---

async function loadDocOrder(orderNumber: string): Promise<{ order: DocOrder; shipment: DocShipment | null }> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true, payment: true, shipment: true },
  });
  if (!order) throw notFound(`Order ${orderNumber} not found`);

  const doc: DocOrder = {
    orderNumber: order.orderNumber,
    placedAt: order.placedAt,
    currency: order.currency,
    subtotalMinor: order.subtotalMinor,
    shippingMinor: order.shippingMinor,
    taxMinor: order.taxMinor,
    totalMinor: order.totalMinor,
    email: order.email,
    phone: order.phone,
    shippingAddress: (order.shippingAddress as unknown as DocAddress | null) ?? null,
    items: order.items.map((it) => ({
      titleSnapshot: it.titleSnapshot,
      skuSnapshot: it.skuSnapshot,
      unitPriceMinor: it.unitPriceMinor,
      quantity: it.quantity,
      totalMinor: it.totalMinor,
    })),
    payment: order.payment ? { provider: order.payment.provider, status: order.payment.status } : null,
  };
  const shipment: DocShipment | null = order.shipment
    ? { courierName: order.shipment.courierName, awb: order.shipment.awb, status: order.shipment.status }
    : null;
  return { order: doc, shipment };
}

fulfilmentRouter.get(
  "/orders/:orderNumber/invoice",
  asyncHandler(async (req, res) => {
    const { orderNumber } = numberParam.parse(req.params);
    const { order } = await loadDocOrder(orderNumber);
    res.type("html").send(renderInvoice(order));
  }),
);

fulfilmentRouter.get(
  "/orders/:orderNumber/delivery-note",
  asyncHandler(async (req, res) => {
    const { orderNumber } = numberParam.parse(req.params);
    const { order } = await loadDocOrder(orderNumber);
    res.type("html").send(renderDeliveryNote(order));
  }),
);

fulfilmentRouter.get(
  "/orders/:orderNumber/label",
  asyncHandler(async (req, res) => {
    const { orderNumber } = numberParam.parse(req.params);
    const { order, shipment } = await loadDocOrder(orderNumber);
    res.type("html").send(renderLabel(order, shipment));
  }),
);
