// Shapes returned by the Aloravie backend API (subset used by the storefront).

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  position: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  priceMinor: number;
  currency: string;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  model3dUrl?: string | null;
  category: Category | null;
  images: ProductImage[];
  variants: ProductVariant[];
}

export interface SupportMessage {
  id: string;
  sender: "CUSTOMER" | "STAFF" | "SYSTEM";
  body: string;
  audioUrl?: string | null;
  createdAt: string;
}

export interface SupportConversation {
  id: string;
  subject: string;
  status: "OPEN" | "CLOSED";
  lastMessageAt: string;
  messages: SupportMessage[];
}

// A line in the shopping bag (client-side).
export interface CartLine {
  variantId: string;
  productSlug: string;
  productTitle: string;
  variantName: string;
  priceMinor: number;
  currency: string;
  quantity: number;
}

// --- Account & orders (returned by the backend) ---

export interface CustomerAccount {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
}

export interface AddressInput {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export interface Address extends AddressInput {
  id: string;
  type: "SHIPPING" | "BILLING";
  isDefault: boolean;
  createdAt: string;
}

export interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  verifiedPurchase: boolean;
  authorName: string;
  createdAt: string;
}

export interface ReviewSummary {
  average: number;
  count: number;
  reviews: ReviewItem[];
}

export type ReturnReason = "WRONG_SIZE" | "DAMAGED" | "NOT_AS_DESCRIBED" | "CHANGED_MIND" | "OTHER";
export type ReturnStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "REFUNDED";

export interface ReturnRequest {
  id: string;
  status: ReturnStatus;
  reason: ReturnReason;
  comment: string | null;
  staffNote: string | null;
  photoUrls: string[];
  items: { orderItemId: string; titleSnapshot: string; skuSnapshot: string; quantity: number; unitPriceMinor: number }[];
  refundAmountMinor: number | null;
  createdAt: string;
  order?: { orderNumber: string; currency: string } | null;
}

export interface OrderItem {
  id: string;
  titleSnapshot: string;
  skuSnapshot: string;
  unitPriceMinor: number;
  quantity: number;
  totalMinor: number;
}

export interface OrderPayment {
  provider: "RAZORPAY" | "MOCK" | "COD";
  status: "CREATED" | "PAID" | "FAILED" | "REFUNDED";
  amountMinor: number;
  currency: string;
}

export interface TrackingEvent {
  id: string;
  status: string;
  location: string | null;
  occurredAt: string;
}

export interface Shipment {
  id: string;
  courierName: string;
  awb: string | null;
  status: string;
  trackingUrl: string | null;
  events: TrackingEvent[];
}

export interface Order {
  id: string;
  orderNumber: string;
  status: "PENDING" | "CONFIRMED" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED";
  currency: string;
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  discountMinor: number;
  totalMinor: number;
  placedAt: string;
  items: OrderItem[];
  payment?: OrderPayment | null;
  shipment?: Shipment | null;
}

// Response from POST /api/checkout
export interface CheckoutResponse {
  order: Order;
  payment: {
    provider: "RAZORPAY" | "MOCK";
    amountMinor: number;
    currency: string;
    providerOrderId: string | null;
    razorpayKeyId?: string;
  };
}
