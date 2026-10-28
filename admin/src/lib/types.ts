export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type Department = "RETURNS" | "PACKING" | "CUSTOMER_CARE" | "OFFERS" | "CRM";

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "ADMIN" | "STAFF";
  departments: Department[];
}

export interface Employee {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "ADMIN" | "STAFF";
  departments: Department[];
  isActive: boolean;
  createdAt: string;
}

export interface Summary {
  totalOrders: number;
  statusCounts: Record<string, number>;
  revenueMinor: number;
  customersCount: number;
  productsCount: number;
  lowStock: {
    variantId: string;
    sku: string;
    product: string;
    variantName: string;
    location: string;
    onHand: number;
    reserved: number;
    available: number;
  }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalMinor: number;
    currency: string;
    placedAt: string;
    customer: { name: string | null; email: string | null } | null;
    payment: { status: string } | null;
  }[];
}

export interface OrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalMinor: number;
  currency: string;
  placedAt: string;
  customer: { id: string; name: string | null; email: string | null } | null;
  channel: { type: string; name: string } | null;
  payment: { status: string; provider: string } | null;
  _count: { items: number };
}

export interface OrderItem {
  id: string;
  titleSnapshot: string;
  skuSnapshot: string;
  unitPriceMinor: number;
  quantity: number;
  totalMinor: number;
}

export type ShipmentStatus =
  | "CREATED"
  | "LABEL_READY"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "RTO"
  | "CANCELLED";

export interface TrackingEvent {
  id: string;
  status: string;
  location: string | null;
  occurredAt: string;
}

export interface Shipment {
  id: string;
  provider: string;
  courierName: string;
  awb: string | null;
  status: ShipmentStatus;
  trackingUrl: string | null;
  events: TrackingEvent[];
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  email: string | null;
  phone: string | null;
  shippingAddress: Record<string, string> | null;
  currency: string;
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  placedAt: string;
  items: OrderItem[];
  customer: { id: string; name: string | null; email: string | null } | null;
  channel: { type: string; name: string } | null;
  payment: { status: string; provider: string; amountMinor: number } | null;
  shipment: Shipment | null;
}

export interface InventoryRow {
  id: string;
  variantId: string;
  sku: string;
  product: string;
  variantName: string;
  location: string;
  locationId: string;
  onHand: number;
  reserved: number;
  available: number;
  low: boolean;
}

export interface CustomerRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  orderCount: number;
  lifetimeSpendMinor: number;
}

export interface CustomerDetail {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  addresses: {
    id: string;
    name: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
  }[];
  orders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalMinor: number;
    currency: string;
    placedAt: string;
    payment: { status: string } | null;
    _count: { items: number };
  }[];
}

export interface ChannelRow {
  id: string;
  type: string;
  name: string;
  isActive: boolean;
  connected: boolean;
  listingCount: number;
  orderCount: number;
  lastOrderSyncAt: string | null;
}

export interface ChannelListingRow {
  id: string;
  externalSku: string;
  isActive: boolean;
  lastPushedQty: number | null;
  lastSyncedAt: string | null;
  variant: { sku: string; name: string; product: { title: string } };
}

export interface SyncLogRow {
  id: string;
  type: "INVENTORY_PUSH" | "ORDER_PULL";
  status: "OK" | "PARTIAL" | "FAILED";
  count: number;
  message: string | null;
  createdAt: string;
}

export interface ChannelDetail {
  id: string;
  type: string;
  name: string;
  isActive: boolean;
  connected: boolean;
  lastOrderSyncAt: string | null;
  listings: ChannelListingRow[];
  syncLogs: SyncLogRow[];
  _count: { orders: number };
}

export interface SupportMessage {
  id: string;
  sender: "CUSTOMER" | "STAFF" | "SYSTEM";
  body: string;
  audioUrl?: string | null;
  createdAt: string;
}

export interface SupportConversationRow {
  id: string;
  subject: string;
  status: "OPEN" | "CLOSED";
  lastMessageAt: string;
  customer: { id: string; name: string | null; email: string | null } | null;
  _count: { messages: number };
}

export interface SupportConversationDetail {
  id: string;
  subject: string;
  status: "OPEN" | "CLOSED";
  lastMessageAt: string;
  customer: { id: string; name: string | null; email: string | null; phone: string | null } | null;
  messages: SupportMessage[];
}

export interface NotificationLogRow {
  id: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP";
  event: string;
  recipient: string;
  subject: string | null;
  body: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  orderId: string | null;
  createdAt: string;
}

export interface ReturnItemSnapshot {
  orderItemId: string;
  titleSnapshot: string;
  skuSnapshot: string;
  variantId: string;
  unitPriceMinor: number;
  quantity: number;
}

export interface ReturnRecord {
  id: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "REFUNDED";
  reason: "WRONG_SIZE" | "DAMAGED" | "NOT_AS_DESCRIBED" | "CHANGED_MIND" | "OTHER";
  comment: string | null;
  staffNote: string | null;
  photoUrls: string[];
  items: ReturnItemSnapshot[];
  refundAmountMinor: number | null;
  refundId: string | null;
  createdAt: string;
  order: { orderNumber: string; currency: string; placedAt: string } | null;
  customer: { id: string; name: string | null; email: string | null } | null;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: "PERCENT" | "FIXED";
  value: number;
  minSpendMinor: number;
  maxDiscountMinor: number | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  currency: string;
  createdAt: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  _count: { products: number; children: number };
}

export interface ReviewRecord {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  verifiedPurchase: boolean;
  status: "PUBLISHED" | "HIDDEN";
  createdAt: string;
  product: { title: string; slug: string };
  customer: { name: string | null; email: string | null };
}

export interface Report {
  days: number | null;
  kpis: { revenueMinor: number; orderCount: number; aovMinor: number; customersCount: number };
  byChannel: { name: string; revenueMinor: number; orderCount: number }[];
  bestSellers: { title: string; units: number; revenueMinor: number }[];
  gst: { taxableMinor: number; gstMinor: number; shippingMinor: number; discountMinor: number; totalMinor: number };
  dailyRevenue: { date: string; revenueMinor: number }[];
  lowStock: { product: string; variantName: string; sku: string; location: string; available: number }[];
}

export interface AdminProduct {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  category: { id: string; name: string } | null;
  variants: { id: string; sku: string; name: string; priceMinor: number; currency: string }[];
  _count: { images: number };
}

export interface AuditEntry {
  id: string;
  actorName: string;
  actorEmail: string;
  action: string;
  summary: string;
  entity: string | null;
  entityId: string | null;
  method: string;
  path: string;
  createdAt: string;
}
