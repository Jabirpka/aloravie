import type { NotificationChannel, NotificationEvent, NotificationStatus } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { env } from "../../env.js";
import { logger } from "../../logger.js";
import { formatMoney } from "../../lib/money.js";

interface TemplateData {
  name: string;
  orderNumber?: string;
  amount?: string;
}

function template(event: NotificationEvent, d: TemplateData): { subject: string; body: string } {
  switch (event) {
    case "ORDER_CONFIRMED":
      return {
        subject: `Your Aloravie order ${d.orderNumber} is confirmed`,
        body: `Hi ${d.name}, thank you for your order ${d.orderNumber}${d.amount ? ` (${d.amount})` : ""}. We'll let you know as soon as it ships. — Aloravie`,
      };
    case "ORDER_SHIPPED":
      return {
        subject: `Your order ${d.orderNumber} is on its way`,
        body: `Good news, ${d.name}! Order ${d.orderNumber} has shipped. Track it any time in your account. — Aloravie`,
      };
    case "ORDER_DELIVERED":
      return {
        subject: `Your order ${d.orderNumber} has been delivered`,
        body: `${d.name}, your order ${d.orderNumber} has been delivered. We hope you love it — dressed up in first light. — Aloravie`,
      };
    case "SUPPORT_REPLY":
      return {
        subject: `New reply from Aloravie support`,
        body: `Hi ${d.name}, our team has replied to your message. Open the app or site to continue the conversation. — Aloravie`,
      };
  }
}

// --- Provider calls (live mode) ---

async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  if (!env.SENDGRID_API_KEY) return false;
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: env.SELLER_EMAIL, name: env.SELLER_NAME },
      subject,
      content: [{ type: "text/plain", value: body }],
    }),
  });
  return res.ok;
}

async function sendTwilio(from: string, to: string, body: string): Promise<boolean> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return false;
  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
  });
  return res.ok;
}

async function deliver(
  channel: NotificationChannel,
  recipient: string,
  subject: string,
  body: string,
): Promise<NotificationStatus> {
  if (env.NOTIFY_MODE === "mock") {
    logger.info({ channel, recipient, subject }, "notification (mock)");
    return "SENT";
  }
  try {
    let ok = false;
    if (channel === "EMAIL") {
      ok = await sendEmail(recipient, subject, body);
    } else if (channel === "SMS") {
      if (!env.TWILIO_SMS_FROM) return "SKIPPED";
      ok = await sendTwilio(env.TWILIO_SMS_FROM, recipient, body);
    } else {
      if (!env.TWILIO_WHATSAPP_FROM) return "SKIPPED";
      ok = await sendTwilio(`whatsapp:${env.TWILIO_WHATSAPP_FROM}`, `whatsapp:${recipient}`, body);
    }
    return ok ? "SENT" : "SKIPPED";
  } catch (err) {
    logger.error({ err, channel, recipient }, "notification failed");
    return "FAILED";
  }
}

/** Notify a customer about an order event across every channel we can reach. Never throws. */
export async function notifyOrderEvent(orderId: string, event: NotificationEvent): Promise<void> {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
    if (!order) return;
    const name = (order.customer?.name ?? "there").split(" ")[0] ?? "there";
    const email = order.email ?? order.customer?.email ?? null;
    const phone = order.phone ?? order.customer?.phone ?? null;
    const msg = template(event, {
      name,
      orderNumber: order.orderNumber,
      amount: formatMoney(order.totalMinor, order.currency),
    });

    const targets: [NotificationChannel, string][] = [];
    if (email) targets.push(["EMAIL", email]);
    if (phone) {
      targets.push(["WHATSAPP", phone]);
      targets.push(["SMS", phone]);
    }

    for (const [channel, recipient] of targets) {
      const status = await deliver(channel, recipient, msg.subject, msg.body);
      await prisma.notificationLog.create({
        data: { channel, event, recipient, subject: msg.subject, body: msg.body, status, orderId: order.id },
      });
    }
  } catch (err) {
    logger.error({ err, orderId, event }, "notifyOrderEvent failed");
  }
}

/** Notify a customer that support replied. Never throws. */
export async function notifySupportReply(customer: {
  name: string | null;
  email: string | null;
  phone: string | null;
}): Promise<void> {
  try {
    const name = (customer.name ?? "there").split(" ")[0] ?? "there";
    const msg = template("SUPPORT_REPLY", { name });
    const targets: [NotificationChannel, string][] = [];
    if (customer.email) targets.push(["EMAIL", customer.email]);
    if (customer.phone) {
      targets.push(["WHATSAPP", customer.phone]);
      targets.push(["SMS", customer.phone]);
    }
    for (const [channel, recipient] of targets) {
      const status = await deliver(channel, recipient, msg.subject, msg.body);
      await prisma.notificationLog.create({
        data: { channel, event: "SUPPORT_REPLY", recipient, subject: msg.subject, body: msg.body, status },
      });
    }
  } catch (err) {
    logger.error({ err }, "notifySupportReply failed");
  }
}

export function listNotifications(limit = 100) {
  return prisma.notificationLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}
