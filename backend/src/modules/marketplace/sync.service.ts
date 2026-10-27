import type { ChannelType } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { badRequest, notFound } from "../../lib/http.js";
import { computeTaxMinor } from "../../lib/tax.js";
import { formatOrderNumber } from "../../lib/order-number.js";
import { getConnector, marketplaceMode, type IncomingOrder } from "./connector.service.js";

async function defaultLocationId(): Promise<string> {
  let location = await prisma.location.findFirst({ where: { isDefault: true } });
  if (!location) location = await prisma.location.findFirst();
  if (!location) throw badRequest("No inventory location configured — run the seed");
  return location.id;
}

// --- Overview ---

export async function listChannels() {
  const channels = await prisma.salesChannel.findMany({
    orderBy: { type: "asc" },
    include: { _count: { select: { listings: true, orders: true } } },
  });
  return channels.map((c) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    isActive: c.isActive,
    connected: c.connected,
    listingCount: c._count.listings,
    orderCount: c._count.orders,
    lastOrderSyncAt: c.lastOrderSyncAt,
  }));
}

export async function getChannel(channelId: string) {
  const channel = await prisma.salesChannel.findUnique({
    where: { id: channelId },
    include: {
      listings: {
        include: { variant: { include: { product: true } } },
        orderBy: { createdAt: "asc" },
      },
      syncLogs: { orderBy: { createdAt: "desc" }, take: 12 },
      _count: { select: { orders: true } },
    },
  });
  if (!channel) throw notFound("Channel not found");
  return channel;
}

// --- Connect: link the seller account and list the active catalogue ---

export async function connectChannel(channelId: string) {
  const channel = await prisma.salesChannel.findUnique({ where: { id: channelId } });
  if (!channel) throw notFound("Channel not found");
  if (channel.type === "WEB") throw badRequest("The web store is always connected");

  // Create a listing for every active variant not already listed on this channel.
  const variants = await prisma.productVariant.findMany({
    where: { product: { status: "ACTIVE" } },
    select: { id: true, sku: true },
  });
  const existing = await prisma.channelListing.findMany({
    where: { channelId },
    select: { variantId: true },
  });
  const have = new Set(existing.map((l) => l.variantId));
  const toCreate = variants.filter((v) => !have.has(v.id));

  await prisma.$transaction([
    prisma.salesChannel.update({ where: { id: channelId }, data: { connected: true } }),
    ...(toCreate.length
      ? [
          prisma.channelListing.createMany({
            data: toCreate.map((v) => ({ channelId, variantId: v.id, externalSku: v.sku })),
          }),
        ]
      : []),
  ]);
  return getChannel(channelId);
}

// --- Inventory push ---

export async function pushInventory(channelId: string) {
  const channel = await prisma.salesChannel.findUnique({ where: { id: channelId } });
  if (!channel) throw notFound("Channel not found");
  if (!channel.connected) throw badRequest("Connect this channel before pushing inventory");

  const locationId = await defaultLocationId();
  const listings = await prisma.channelListing.findMany({
    where: { channelId, isActive: true },
    include: { variant: { include: { inventory: { where: { locationId } } } } },
  });

  const items = listings.map((l) => {
    const inv = l.variant.inventory[0];
    const available = inv ? Math.max(0, inv.onHand - inv.reserved) : 0;
    return { listingId: l.id, externalSku: l.externalSku, available };
  });

  const connector = getConnector(channel.type);
  const result = await connector.pushInventory(items.map((i) => ({ externalSku: i.externalSku, available: i.available })));

  const now = new Date();
  await prisma.$transaction([
    ...items.map((i) =>
      prisma.channelListing.update({
        where: { id: i.listingId },
        data: { lastPushedQty: i.available, lastSyncedAt: now },
      }),
    ),
    prisma.syncLog.create({
      data: {
        channelId,
        type: "INVENTORY_PUSH",
        status: "OK",
        count: result.pushed,
        message: `Pushed stock for ${result.pushed} listing${result.pushed === 1 ? "" : "s"} (${marketplaceMode()} mode)`,
      },
    }),
  ]);
  return { pushed: result.pushed };
}

// --- Order ingestion ---

export async function pullOrders(channelId: string) {
  const channel = await prisma.salesChannel.findUnique({ where: { id: channelId } });
  if (!channel) throw notFound("Channel not found");
  if (!channel.connected) throw badRequest("Connect this channel before pulling orders");

  const locationId = await defaultLocationId();
  const listings = await prisma.channelListing.findMany({
    where: { channelId, isActive: true },
    include: { variant: { include: { product: true } } },
  });
  const bySku = new Map(listings.map((l) => [l.externalSku, l.variant]));

  const connector = getConnector(channel.type);
  const incoming = await connector.fetchNewOrders(listings.map((l) => ({ externalSku: l.externalSku })));

  let created = 0;
  let skipped = 0;
  for (const ext of incoming) {
    const made = await ingestOne(channel.id, channel.type, ext, bySku, locationId);
    if (made) created++;
    else skipped++;
  }

  await prisma.salesChannel.update({ where: { id: channelId }, data: { lastOrderSyncAt: new Date() } });
  await prisma.syncLog.create({
    data: {
      channelId,
      type: "ORDER_PULL",
      status: "OK",
      count: created,
      message: `Imported ${created} order${created === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} (duplicate/unknown SKU)` : ""}`,
    },
  });
  return { created, skipped };
}

type ListedVariant = { id: string; sku: string; priceMinor: number; currency: string; product: { title: string } };

async function ingestOne(
  channelId: string,
  channelType: ChannelType,
  ext: IncomingOrder,
  bySku: Map<string, ListedVariant>,
  locationId: string,
): Promise<boolean> {
  // De-duplicate on the marketplace order id.
  const already = await prisma.order.findFirst({ where: { externalId: ext.externalId } });
  if (already) return false;

  const lines = ext.items
    .map((it) => {
      const variant = bySku.get(it.externalSku);
      return variant ? { variant, quantity: it.quantity } : null;
    })
    .filter((l): l is { variant: ListedVariant; quantity: number } => l !== null);
  if (lines.length === 0) return false; // unknown SKUs only

  const subtotalMinor = lines.reduce((s, l) => s + l.variant.priceMinor * l.quantity, 0);
  const currency = lines[0]!.variant.currency;
  const taxMinor = computeTaxMinor(lines.map((l) => ({ unitPriceMinor: l.variant.priceMinor, quantity: l.quantity })));
  const totalMinor = subtotalMinor + taxMinor; // marketplace handles shipping

  // Find or create the marketplace customer.
  let customerId: string | undefined;
  if (ext.buyerEmail) {
    const existing = await prisma.customer.findUnique({ where: { email: ext.buyerEmail } });
    customerId = existing
      ? existing.id
      : (await prisma.customer.create({ data: { email: ext.buyerEmail, name: ext.buyerName, phone: ext.buyerPhone } })).id;
  } else {
    customerId = (await prisma.customer.create({ data: { name: ext.buyerName, phone: ext.buyerPhone } })).id;
  }

  await prisma.$transaction(async (tx) => {
    const seq = (await tx.order.count()) + 1;
    await tx.order.create({
      data: {
        orderNumber: formatOrderNumber(seq),
        channelId,
        customerId,
        status: "CONFIRMED", // marketplaces collect payment before handing over the order
        externalId: ext.externalId,
        email: ext.buyerEmail ?? null,
        phone: ext.buyerPhone ?? null,
        shippingAddress: ext.shipTo as unknown as object,
        currency,
        subtotalMinor,
        shippingMinor: 0,
        taxMinor,
        totalMinor,
        items: {
          create: lines.map((l) => ({
            variantId: l.variant.id,
            titleSnapshot: l.variant.product.title,
            skuSnapshot: l.variant.sku,
            unitPriceMinor: l.variant.priceMinor,
            quantity: l.quantity,
            totalMinor: l.variant.priceMinor * l.quantity,
          })),
        },
        payment: {
          create: {
            provider: "MARKETPLACE",
            status: "PAID",
            amountMinor: totalMinor,
            currency,
            providerPaymentId: `${channelType}_${ext.externalId}`,
          },
        },
      },
    });

    // The marketplace already sold these units — reduce on-hand stock.
    for (const l of lines) {
      await tx.inventoryItem.updateMany({
        where: { variantId: l.variant.id, locationId },
        data: { onHand: { decrement: l.quantity } },
      });
    }
  });
  return true;
}
