import type { SupportStatus } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { badRequest, forbidden, notFound } from "../../lib/http.js";
import { notifySupportReply } from "../notifications/notifications.service.js";

const withMessages = { messages: { orderBy: { createdAt: "asc" } } } as const;

// --- Customer side ---

export async function createConversation(customerId: string, subject: string, body: string) {
  if (!body.trim()) throw badRequest("Message cannot be empty");
  return prisma.supportConversation.create({
    data: {
      customerId,
      subject: subject.trim() || "Support request",
      messages: { create: { sender: "CUSTOMER", body: body.trim() } },
    },
    include: withMessages,
  });
}

export function listForCustomer(customerId: string) {
  return prisma.supportConversation.findMany({
    where: { customerId },
    orderBy: { lastMessageAt: "desc" },
    include: withMessages,
  });
}

export async function getForCustomer(customerId: string, id: string) {
  const convo = await prisma.supportConversation.findUnique({ where: { id }, include: withMessages });
  if (!convo) throw notFound("Conversation not found");
  if (convo.customerId !== customerId) throw forbidden("This conversation belongs to another account");
  return convo;
}

export async function addCustomerMessage(customerId: string, id: string, body: string) {
  if (!body.trim()) throw badRequest("Message cannot be empty");
  await getForCustomer(customerId, id); // ownership check
  await prisma.supportMessage.create({ data: { conversationId: id, sender: "CUSTOMER", body: body.trim() } });
  await prisma.supportConversation.update({
    where: { id },
    data: { lastMessageAt: new Date(), status: "OPEN" },
  });
  return prisma.supportConversation.findUnique({ where: { id }, include: withMessages });
}

// --- Staff side ---

export function adminList(status?: SupportStatus) {
  return prisma.supportConversation.findMany({
    where: status ? { status } : {},
    orderBy: { lastMessageAt: "desc" },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      _count: { select: { messages: true } },
    },
  });
}

export async function adminGet(id: string) {
  const convo = await prisma.supportConversation.findUnique({
    where: { id },
    include: { ...withMessages, customer: { select: { id: true, name: true, email: true, phone: true } } },
  });
  if (!convo) throw notFound("Conversation not found");
  return convo;
}

export async function adminReply(id: string, body: string) {
  if (!body.trim()) throw badRequest("Reply cannot be empty");
  const convo = await prisma.supportConversation.findUnique({ where: { id }, include: { customer: true } });
  if (!convo) throw notFound("Conversation not found");

  await prisma.supportMessage.create({ data: { conversationId: id, sender: "STAFF", body: body.trim() } });
  await prisma.supportConversation.update({ where: { id }, data: { lastMessageAt: new Date(), status: "OPEN" } });

  if (convo.customer) {
    await notifySupportReply({
      name: convo.customer.name,
      email: convo.customer.email,
      phone: convo.customer.phone,
    });
  }
  return adminGet(id);
}

export async function adminClose(id: string) {
  const convo = await prisma.supportConversation.findUnique({ where: { id } });
  if (!convo) throw notFound("Conversation not found");
  await prisma.supportConversation.update({ where: { id }, data: { status: "CLOSED" } });
  return adminGet(id);
}
