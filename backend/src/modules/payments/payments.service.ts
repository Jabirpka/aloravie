import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../../prisma.js";
import { env } from "../../env.js";
import { AppError, badRequest, forbidden, notFound, unauthorized } from "../../lib/http.js";

const RZP_API = "https://api.razorpay.com/v1";

export function paymentMode(): "mock" | "razorpay" {
  return env.PAYMENT_MODE;
}

/** Create a Razorpay order for the given amount. Returns the provider order id. */
export async function createRazorpayOrder(
  amountMinor: number,
  currency: string,
  receipt: string,
): Promise<string> {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError(500, "PAYMENT_CONFIG", "Razorpay keys are not configured");
  }
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`${RZP_API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({ amount: amountMinor, currency, receipt, payment_capture: 1 }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AppError(502, "PAYMENT_PROVIDER", `Razorpay order creation failed (${res.status}) ${text}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Mark an order paid: commit reserved stock, set payment PAID and order CONFIRMED.
// Idempotent: a non-PENDING order is returned unchanged.
async function markOrderPaid(orderId: string, providerPaymentId: string | null) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true, payment: true } });
    if (!order) throw notFound("Order not found");
    if (order.status !== "PENDING") return order;

    let location = await tx.location.findFirst({ where: { isDefault: true } });
    if (!location) location = await tx.location.findFirst();
    if (location) {
      for (const it of order.items) {
        await tx.inventoryItem.updateMany({
          where: { variantId: it.variantId, locationId: location.id },
          data: { onHand: { decrement: it.quantity }, reserved: { decrement: it.quantity } },
        });
      }
    }
    await tx.payment.update({ where: { orderId }, data: { status: "PAID", providerPaymentId } });
    return tx.order.update({
      where: { id: orderId },
      data: { status: "CONFIRMED" },
      include: { items: true, payment: true },
    });
  });
}

async function loadOwnedOrder(customerId: string, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
  if (!order) throw notFound("Order not found");
  if (order.customerId !== customerId) throw forbidden("This order belongs to another account");
  return order;
}

/** Razorpay callback: verify signature then confirm. */
export async function verifyRazorpayAndConfirm(
  customerId: string,
  input: { orderId: string; razorpayPaymentId: string; razorpaySignature: string },
) {
  const order = await loadOwnedOrder(customerId, input.orderId);
  const providerOrderId = order.payment?.providerOrderId;
  if (!order.payment || order.payment.provider !== "RAZORPAY" || !providerOrderId) {
    throw badRequest("This order has no Razorpay payment to verify");
  }
  const ok = verifyRazorpaySignature(providerOrderId, input.razorpayPaymentId, input.razorpaySignature);
  if (!ok) {
    await prisma.payment.update({ where: { orderId: order.id }, data: { status: "FAILED" } });
    throw unauthorized("Payment signature verification failed");
  }
  return markOrderPaid(order.id, input.razorpayPaymentId);
}

/** Dev-only mock confirmation (enabled when PAYMENT_MODE=mock). */
export async function confirmMockPayment(customerId: string, orderId: string) {
  if (env.PAYMENT_MODE !== "mock") {
    throw forbidden("Mock payments are disabled; use the Razorpay flow");
  }
  const order = await loadOwnedOrder(customerId, orderId);
  if (!order.payment || order.payment.provider !== "MOCK") {
    throw badRequest("This order is not a mock payment");
  }
  return markOrderPaid(order.id, `mock_${Date.now()}`);
}
