import { prisma } from "../../prisma.js";
import { env } from "../../env.js";
import { AppError, badRequest, conflict, notFound } from "../../lib/http.js";
import { computeTaxMinor } from "../../lib/tax.js";
import { formatOrderNumber } from "../../lib/order-number.js";
import { createRazorpayOrder } from "../payments/payments.service.js";
import { validateCoupon } from "../coupons/coupons.service.js";

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
  couponCode?: string;
}

// Save a checkout address to the customer's address book, unless an identical one
// is already there. The first address a customer saves becomes their default.
async function saveAddressToBook(customerId: string, a: AddressSnapshot) {
  const existing = await prisma.address.findMany({ where: { customerId } });
  const duplicate = existing.some(
    (e) =>
      e.line1.trim().toLowerCase() === a.line1.trim().toLowerCase() &&
      e.pincode.trim() === a.pincode.trim() &&
      e.name.trim().toLowerCase() === a.name.trim().toLowerCase(),
  );
  if (duplicate) return;
  await prisma.address.create({
    data: {
      customerId,
      type: "SHIPPING",
      name: a.name,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      country: a.country ?? "IN",
      isDefault: existing.length === 0,
    },
  });
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

  // Apply a coupon if one was entered (validateCoupon throws a readable reason).
  let discountMinor = 0;
  let appliedCouponId: string | null = null;
  let appliedCouponCode: string | null = null;
  if (input.couponCode?.trim()) {
    const applied = await validateCoupon(input.couponCode, subtotalMinor);
    discountMinor = applied.discountMinor;
    appliedCouponId = applied.coupon.id;
    appliedCouponCode = applied.coupon.code;
  }

  const totalMinor = Math.max(0, subtotalMinor + taxMinor + shippingMinor - discountMinor);

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
        discountMinor,
        totalMinor,
        couponCode: appliedCouponCode,
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

    if (appliedCouponId) {
      await tx.coupon.update({ where: { id: appliedCouponId }, data: { usedCount: { increment: 1 } } });
    }

    return { order, payment };
  });

  // If the shopper typed a fresh address (rather than picking a saved one), keep
  // it in their address book so they don't retype it next time. Best-effort: a
  // failure here must never fail a paid order, and we skip exact duplicates.
  if (input.shippingAddress) {
    void saveAddressToBook(customerId, input.shippingAddress).catch(() => {
      /* non-critical */
    });
  }

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
