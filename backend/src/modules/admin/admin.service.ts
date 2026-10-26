import type { OrderStatus, ProductStatus } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { badRequest, notFound } from "../../lib/http.js";

const LOW_STOCK_THRESHOLD = 5;

// Order statuses considered "realised revenue".
const REVENUE_STATUSES: OrderStatus[] = ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"];

// --- Dashboard ---

export async function getSummary() {
  const [ordersByStatus, revenue, customersCount, productsCount, lowStock, recentOrders] =
    await Promise.all([
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.order.aggregate({
        _sum: { totalMinor: true },
        where: { status: { in: REVENUE_STATUSES } },
      }),
      prisma.customer.count(),
      prisma.product.count(),
      prisma.inventoryItem.findMany({
        where: { onHand: { lte: LOW_STOCK_THRESHOLD } },
        include: { variant: { include: { product: true } }, location: true },
        orderBy: { onHand: "asc" },
        take: 10,
      }),
      prisma.order.findMany({
        orderBy: { placedAt: "desc" },
        take: 6,
        include: { customer: { select: { name: true, email: true } }, payment: true },
      }),
    ]);

  const statusCounts: Record<string, number> = {};
  let totalOrders = 0;
  for (const row of ordersByStatus) {
    statusCounts[row.status] = row._count._all;
    totalOrders += row._count._all;
  }

  return {
    totalOrders,
    statusCounts,
    revenueMinor: revenue._sum.totalMinor ?? 0,
    customersCount,
    productsCount,
    lowStock: lowStock.map((i) => ({
      variantId: i.variantId,
      sku: i.variant.sku,
      product: i.variant.product.title,
      variantName: i.variant.name,
      location: i.location.code,
      onHand: i.onHand,
      reserved: i.reserved,
      available: i.onHand - i.reserved,
    })),
    recentOrders,
  };
}

// --- Orders ---

export function listOrders(opts: { status?: OrderStatus } = {}) {
  return prisma.order.findMany({
    where: opts.status ? { status: opts.status } : {},
    include: {
      customer: { select: { id: true, name: true, email: true } },
      channel: { select: { type: true, name: true } },
      payment: true,
      _count: { select: { items: true } },
    },
    orderBy: { placedAt: "desc" },
  });
}

export async function getOrder(orderNumber: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true, customer: true, channel: true, payment: true },
  });
  if (!order) throw notFound(`Order ${orderNumber} not found`);
  return order;
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

export async function updateOrderStatus(orderId: string, nextStatus: OrderStatus) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw notFound("Order not found");

    const prev = order.status;
    if (prev === nextStatus) {
      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true, customer: true, channel: true, payment: true },
      });
    }
    if (!ALLOWED_TRANSITIONS[prev].includes(nextStatus)) {
      throw badRequest(`Cannot move an order from ${prev} to ${nextStatus}`);
    }

    // Return stock to the pool when cancelling/returning.
    if (nextStatus === "CANCELLED" || nextStatus === "RETURNED") {
      let location = await tx.location.findFirst({ where: { isDefault: true } });
      if (!location) location = await tx.location.findFirst();
      if (location) {
        for (const item of order.items) {
          if (prev === "PENDING") {
            // Stock was reserved but never committed → release the reservation.
            await tx.inventoryItem.updateMany({
              where: { variantId: item.variantId, locationId: location.id },
              data: { reserved: { decrement: item.quantity } },
            });
          } else {
            // Stock was committed (onHand reduced) → put it back on hand.
            await tx.inventoryItem.updateMany({
              where: { variantId: item.variantId, locationId: location.id },
              data: { onHand: { increment: item.quantity } },
            });
          }
        }
      }
    }

    return tx.order.update({
      where: { id: orderId },
      data: { status: nextStatus },
      include: { items: true, customer: true, channel: true, payment: true },
    });
  });
}

// --- Inventory ---

export async function listInventory(opts: { lowStockOnly?: boolean; threshold?: number } = {}) {
  const items = await prisma.inventoryItem.findMany({
    include: { variant: { include: { product: true } }, location: true },
    orderBy: [{ location: { code: "asc" } }, { variant: { sku: "asc" } }],
  });
  const threshold = opts.threshold ?? LOW_STOCK_THRESHOLD;
  const mapped = items.map((i) => ({
    id: i.id,
    variantId: i.variantId,
    sku: i.variant.sku,
    product: i.variant.product.title,
    variantName: i.variant.name,
    location: i.location.code,
    locationId: i.locationId,
    onHand: i.onHand,
    reserved: i.reserved,
    available: i.onHand - i.reserved,
    low: i.onHand - i.reserved <= threshold,
  }));
  return opts.lowStockOnly ? mapped.filter((m) => m.low) : mapped;
}

export async function adjustInventory(input: {
  variantId: string;
  locationId?: string;
  setOnHand?: number;
  delta?: number;
}) {
  let locationId = input.locationId;
  if (!locationId) {
    let location = await prisma.location.findFirst({ where: { isDefault: true } });
    if (!location) location = await prisma.location.findFirst();
    if (!location) throw badRequest("No inventory location configured");
    locationId = location.id;
  }

  const variant = await prisma.productVariant.findUnique({ where: { id: input.variantId } });
  if (!variant) throw notFound("Variant not found");

  const existing = await prisma.inventoryItem.findUnique({
    where: { variantId_locationId: { variantId: input.variantId, locationId } },
  });
  const currentOnHand = existing?.onHand ?? 0;

  let nextOnHand: number;
  if (input.setOnHand != null) {
    nextOnHand = input.setOnHand;
  } else if (input.delta != null) {
    nextOnHand = currentOnHand + input.delta;
  } else {
    throw badRequest("Provide either setOnHand or delta");
  }
  if (nextOnHand < 0) throw badRequest("Stock on hand cannot be negative");

  return prisma.inventoryItem.upsert({
    where: { variantId_locationId: { variantId: input.variantId, locationId } },
    update: { onHand: nextOnHand },
    create: { variantId: input.variantId, locationId, onHand: nextOnHand, reserved: 0 },
    include: { variant: { include: { product: true } }, location: true },
  });
}

// --- Products (admin: all statuses) ---

export function listProducts() {
  return prisma.product.findMany({
    include: { category: true, variants: true, _count: { select: { images: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function updateProduct(
  id: string,
  data: { title?: string; description?: string; status?: ProductStatus; categoryId?: string | null },
) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw notFound("Product not found");
  return prisma.product.update({
    where: { id },
    data,
    include: { category: true, variants: true },
  });
}

// --- Customers (CRM) ---

export async function listCustomers(query?: string) {
  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
          { phone: { contains: query } },
        ],
      }
    : {};
  const customers = await prisma.customer.findMany({
    where,
    include: { _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Attach lifetime spend per customer.
  const spends = await prisma.order.groupBy({
    by: ["customerId"],
    where: { status: { in: REVENUE_STATUSES }, customerId: { not: null } },
    _sum: { totalMinor: true },
  });
  const spendById = new Map(spends.map((s) => [s.customerId, s._sum.totalMinor ?? 0]));

  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    createdAt: c.createdAt,
    orderCount: c._count.orders,
    lifetimeSpendMinor: spendById.get(c.id) ?? 0,
  }));
}

export async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      addresses: true,
      orders: {
        orderBy: { placedAt: "desc" },
        include: { payment: true, _count: { select: { items: true } } },
      },
    },
  });
  if (!customer) throw notFound("Customer not found");
  return customer;
}
