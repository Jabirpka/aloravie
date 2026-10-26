import { prisma } from "../../prisma.js";
import { notFound } from "../../lib/http.js";

const orderInclude = {
  items: true,
  payment: true,
  channel: { select: { type: true, name: true } },
} as const;

export function listOrdersForCustomer(customerId: string) {
  return prisma.order.findMany({
    where: { customerId },
    include: orderInclude,
    orderBy: { placedAt: "desc" },
  });
}

export async function getOrderForCustomer(customerId: string, orderNumber: string) {
  const order = await prisma.order.findFirst({
    where: { orderNumber, customerId },
    include: orderInclude,
  });
  if (!order) throw notFound(`Order ${orderNumber} not found`);
  return order;
}
