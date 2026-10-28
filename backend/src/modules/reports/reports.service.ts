import type { OrderStatus } from "@prisma/client";
import { prisma } from "../../prisma.js";

const REVENUE_STATUSES: OrderStatus[] = ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"];
const LOW_STOCK_THRESHOLD = 5;

export async function getReports(days?: number) {
  const since = days && days > 0 ? new Date(Date.now() - days * 86400_000) : null;
  const orderWhere = {
    status: { in: REVENUE_STATUSES },
    ...(since ? { placedAt: { gte: since } } : {}),
  };

  const [agg, byChannelRaw, channels, bestRaw, customersCount, dailyOrders, lowStockRaw] = await Promise.all([
    prisma.order.aggregate({
      where: orderWhere,
      _sum: { subtotalMinor: true, taxMinor: true, shippingMinor: true, discountMinor: true, totalMinor: true },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["channelId"],
      where: orderWhere,
      _sum: { totalMinor: true },
      _count: { _all: true },
    }),
    prisma.salesChannel.findMany({ select: { id: true, type: true, name: true } }),
    prisma.orderItem.groupBy({
      by: ["titleSnapshot"],
      where: { order: orderWhere },
      _sum: { quantity: true, totalMinor: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
    prisma.customer.count(),
    prisma.order.findMany({
      where: {
        status: { in: REVENUE_STATUSES },
        placedAt: { gte: new Date(Date.now() - 14 * 86400_000) },
      },
      select: { placedAt: true, totalMinor: true },
    }),
    prisma.inventoryItem.findMany({
      where: { onHand: { lte: LOW_STOCK_THRESHOLD } },
      include: { variant: { include: { product: true } }, location: true },
      orderBy: { onHand: "asc" },
      take: 12,
    }),
  ]);

  const channelName = new Map(channels.map((c) => [c.id, c.name]));
  const orderCount = agg._count._all;
  const revenueMinor = agg._sum.totalMinor ?? 0;

  // Daily revenue over the last 14 days, zero-filled.
  const buckets = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const o of dailyOrders) {
    const key = new Date(o.placedAt).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + o.totalMinor);
  }

  return {
    days: days ?? null,
    kpis: {
      revenueMinor,
      orderCount,
      aovMinor: orderCount ? Math.round(revenueMinor / orderCount) : 0,
      customersCount,
    },
    byChannel: byChannelRaw
      .map((r) => ({
        name: channelName.get(r.channelId) ?? "—",
        revenueMinor: r._sum.totalMinor ?? 0,
        orderCount: r._count._all,
      }))
      .sort((a, b) => b.revenueMinor - a.revenueMinor),
    bestSellers: bestRaw.map((r) => ({
      title: r.titleSnapshot,
      units: r._sum.quantity ?? 0,
      revenueMinor: r._sum.totalMinor ?? 0,
    })),
    gst: {
      taxableMinor: agg._sum.subtotalMinor ?? 0,
      gstMinor: agg._sum.taxMinor ?? 0,
      shippingMinor: agg._sum.shippingMinor ?? 0,
      discountMinor: agg._sum.discountMinor ?? 0,
      totalMinor: revenueMinor,
    },
    dailyRevenue: [...buckets.entries()].map(([date, revenueMinor]) => ({ date, revenueMinor })),
    lowStock: lowStockRaw.map((i) => ({
      product: i.variant.product.title,
      variantName: i.variant.name,
      sku: i.variant.sku,
      location: i.location.code,
      available: i.onHand - i.reserved,
    })),
  };
}
