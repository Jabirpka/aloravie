import { prisma } from "../../prisma.js";
import { env } from "../../env.js";
import { AppError, badRequest, conflict, notFound } from "../../lib/http.js";
import { computeTaxMinor } from "../../lib/tax.js";
import { formatOrderNumber } from "../../lib/order-number.js";
import { createRazorpayOrder } from "../payments/payments.service.js";

export interface AddressSnapshot {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export interface CheckoutInput {
  items: { variantId: string; quantity: number }[];
  shippingAddressId?: string;
  shippingAddress?: AddressSnapshot;
  email?: string;
  phone?: string;
}

export async function createCheckout(customerId: string, input: CheckoutInput) {
  if (!input.items.length) throw badRequest("Your bag is empty");

  const channel = await prisma.salesChannel.findUnique({ where: { type: "WEB" } });
  if (!channel) throw new AppError(500, "CONFIG", "WEB sales channel not configured — run the seed");

  let location = await prisma.location.findFirst({ where: { isDefault: true } });
  if (!location) location = await prisma.location.findFirst();
  if (!location) throw new AppError(500, "CONFIG", "No inventory location configured — run the seed");
  const loc = location;

  // Load variants referenced by the cart.
  const variantIds = [...new Set(input.items.map((i) => i.variantId))];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: true },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  // Build priced lines and validate availability of each referenced product.
  const lines = input.items.map((i) => {
    const variant = byId.get(i.variantId);
    if (!variant) throw badRequest(`Unknown item in bag: ${i.variantId}`);
    if (variant.product.status !== "ACTIVE") throw conflict(`"${variant.product.title}" is not available`);
    if (i.quantity < 1) throw badRequest("Quantity must be at least 1");
    return { variant, quantity: i.quantity, lineTotalMinor: variant.priceMinor * i.quantity };
  });

  const currency = lines[0]!.variant.currency;
  const subtotalMinor = lines.reduce((s, l) => s + l.lineTotalMinor, 0);
  const taxMinor = computeTaxMinor(
    lines.map((l) => ({ unitPriceMinor: l.variant.priceMinor, quantity: l.quantity })),
  );
  const shippingMinor = subtotalMinor >= env.FREE_SHIP_THRESHOLD_MINOR ? 0 : env.SHIPPING_FLAT_MINOR;
  const totalMinor = subtotalMinor + taxMinor + shippingMinor;

  // Resolve the shipping address snapshot.
  let shippingAddress: AddressSnapshot;
  let phone = input.phone;
  if (input.shippingAddressId) {
    const addr = await prisma.address.findFirst({
      where: { id: input.shippingAddressId, customerId },
    });
    if (!addr) throw notFound("Shipping address not found");
    shippingAddress = {
      name: addr.name,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2 ?? undefined,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      country: addr.country,
    };
    phone = phone ?? addr.phone;
  } else if (input.shippingAddress) {
    shippingAddress = input.shippingAddress;
    phone = phone ?? input.shippingAddress.phone;
  } else {
    throw badRequest("A shipping address is required");
  }

  const provider: "RAZORPAY" | "MOCK" = env.PAYMENT_MODE === "razorpay" ? "RAZORPAY" : "MOCK";

  // Reserve stock + create the order and its payment atomically.
  const created = await prisma.$transaction(async (tx) => {
    for (const l of lines) {
      const inv = await tx.inventoryItem.findUnique({
        where: { variantId_locationId: { variantId: l.variant.id, locationId: loc.id } },
      });
      if (!inv || inv.onHand - inv.reserved < l.quantity) {
        throw conflict(`Not enough stock for ${l.variant.product.title} (${l.variant.name})`);
      }
      await tx.inventoryItem.update({
        where: { variantId_locationId: { variantId: l.variant.id, locationId: loc.id } },
        data: { reserved: { increment: l.quantity } },
      });
    }

    const seq = (await tx.order.count()) + 1;
    const order = await tx.order.create({
      data: {
        orderNumber: formatOrderNumber(seq),
        channelId: channel.id,
        customerId,
        status: "PENDING",
        email: input.email,
        phone,
        shippingAddress: shippingAddress as unknown as object,
        currency,
        subtotalMinor,
        shippingMinor,
        taxMinor,
        totalMinor,
        items: {
          create: lines.map((l) => ({
            variantId: l.variant.id,
            titleSnapshot: l.variant.product.title,
            skuSnapshot: l.variant.sku,
            unitPriceMinor: l.variant.priceMinor,
            quantity: l.quantity,
            totalMinor: l.lineTotalMinor,
          })),
        },
      },
      include: { items: true },
    });

    const payment = await tx.payment.create({
      data: { orderId: order.id, provider, amountMinor: totalMinor, currency, status: "CREATED" },
    });

    return { order, payment };
  });

  // Create the Razorpay order outside the DB transaction (it's a network call).
  let providerOrderId: string | null = null;
  if (provider === "RAZORPAY") {
    providerOrderId = await createRazorpayOrder(totalMinor, currency, created.order.orderNumber);
    await prisma.payment.update({
      where: { orderId: created.order.id },
      data: { providerOrderId },
    });
  }

  return {
    order: created.order,
    payment: {
      provider,
      amountMinor: totalMinor,
      currency,
      providerOrderId,
      ...(provider === "RAZORPAY" ? { razorpayKeyId: env.RAZORPAY_KEY_ID } : {}),
    },
  };
}
