export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "ADMIN" | "STAFF";
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

export interface AdminProduct {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  category: { id: string; name: string } | null;
  variants: { id: string; sku: string; name: string; priceMinor: number; currency: string }[];
  _count: { images: number };
}
