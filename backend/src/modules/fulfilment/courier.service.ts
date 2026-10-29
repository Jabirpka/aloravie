import type { CourierProvider, ShipmentStatus } from "@prisma/client";
import { randomInt } from "node:crypto";
import { env } from "../../env.js";
import { AppError } from "../../lib/http.js";

export interface BookingInput {
  orderNumber: string;
  weightKg?: number;
  shipTo: {
    name: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
  };
}

export interface BookingResult {
  provider: CourierProvider;
  courierName: string;
  awb: string;
  trackingUrl: string;
  providerShipmentId: string;
}

export interface TrackingUpdate {
  status: ShipmentStatus;
  label: string;
  location?: string;
  occurredAt: Date;
}

export function courierMode(): "mock" | "shiprocket" {
  return env.COURIER_MODE;
}

// --- Mock courier (works without any credentials) ---

function mockAwb(): string {
  return `ALV${Date.now().toString().slice(-8)}${randomInt(100, 999)}`;
}

export function bookMockShipment(input: BookingInput): BookingResult {
  const awb = mockAwb();
  return {
    provider: "MOCK",
    courierName: "Aloravie Express (mock)",
    awb,
    trackingUrl: `https://track.aloravie.example/${awb}`,
    providerShipmentId: `mock_${input.orderNumber}`,
  };
}

// The mock timeline advances one step per sync, so staff/demos can watch it move.
const MOCK_FLOW: { status: ShipmentStatus; label: string; location?: string }[] = [
  { status: "PICKED_UP", label: "Picked up from warehouse", location: "Bengaluru Hub" },
  { status: "IN_TRANSIT", label: "In transit", location: "Sorting Centre" },
  { status: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { status: "DELIVERED", label: "Delivered" },
];

export function nextMockUpdate(current: ShipmentStatus): TrackingUpdate | null {
  // From CREATED / LABEL_READY we start the flow; otherwise step to the next stage.
  const startIdx =
    current === "CREATED" || current === "LABEL_READY"
      ? 0
      : MOCK_FLOW.findIndex((s) => s.status === current) + 1;
  const next = MOCK_FLOW[startIdx];
  if (!next) return null;
  return { status: next.status, label: next.label, location: next.location, occurredAt: new Date() };
}

// --- Return pickups (reverse logistics: courier collects from the customer) ---

const RETURN_MOCK_FLOW: { status: ShipmentStatus; label: string; location?: string }[] = [
  { status: "PICKED_UP", label: "Picked up from customer" },
  { status: "IN_TRANSIT", label: "In transit to warehouse", location: "Sorting Centre" },
  { status: "DELIVERED", label: "Received at warehouse", location: "Bengaluru Hub" },
];

/** Next step of the mock return timeline, or null once it's been received. */
export function nextReturnMockUpdate(current: ShipmentStatus | null): TrackingUpdate | null {
  const startIdx =
    !current || current === "CREATED" || current === "LABEL_READY"
      ? 0
      : RETURN_MOCK_FLOW.findIndex((s) => s.status === current) + 1;
  const next = RETURN_MOCK_FLOW[startIdx];
  if (!next) return null;
  return { status: next.status, label: next.label, location: next.location, occurredAt: new Date() };
}

/** Book a reverse pickup. Mock issues an AWB; live Shiprocket returns aren't wired here. */
export async function bookReturnPickup(input: BookingInput): Promise<BookingResult> {
  if (courierMode() === "shiprocket") {
    throw new AppError(
      501,
      "NOT_IMPLEMENTED",
      "Live Shiprocket return pickups aren't implemented in this build. Arrange the pickup in the Shiprocket panel, then mark the return received here. Mock mode runs the full flow.",
    );
  }
  const awb = mockAwb();
  return {
    provider: "MOCK",
    courierName: "Aloravie Reverse (mock)",
    awb,
    trackingUrl: `https://track.aloravie.example/${awb}`,
    providerShipmentId: `mock_return_${input.orderNumber}`,
  };
}

// --- Shiprocket (real API; needs a configured account + pickup location) ---
// Implemented against Shiprocket's documented REST API. Untested against a live
// account here — enable with COURIER_MODE=shiprocket and the SHIPROCKET_* env vars.

const SR_API = "https://apiv2.shiprocket.in/v1/external";

async function shiprocketToken(): Promise<string> {
  if (!env.SHIPROCKET_EMAIL || !env.SHIPROCKET_PASSWORD) {
    throw new AppError(500, "COURIER_CONFIG", "Shiprocket credentials are not configured");
  }
  const res = await fetch(`${SR_API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }),
  });
  if (!res.ok) throw new AppError(502, "COURIER_PROVIDER", `Shiprocket auth failed (${res.status})`);
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new AppError(502, "COURIER_PROVIDER", "Shiprocket did not return a token");
  return data.token;
}

export async function bookShiprocketShipment(input: BookingInput): Promise<BookingResult> {
  if (!env.SHIPROCKET_PICKUP_LOCATION) {
    throw new AppError(500, "COURIER_CONFIG", "SHIPROCKET_PICKUP_LOCATION is not configured");
  }
  const token = await shiprocketToken();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  // Create an ad-hoc order. (Line items / dimensions would be mapped from the order
  // in a fuller integration; this creates the shipment and returns its identifiers.)
  const res = await fetch(`${SR_API}/orders/create/adhoc`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      order_id: input.orderNumber,
      order_date: new Date().toISOString().slice(0, 10),
      pickup_location: env.SHIPROCKET_PICKUP_LOCATION,
      billing_customer_name: input.shipTo.name,
      billing_address: [input.shipTo.line1, input.shipTo.line2].filter(Boolean).join(", "),
      billing_city: input.shipTo.city,
      billing_pincode: input.shipTo.pincode,
      billing_state: input.shipTo.state,
      billing_country: input.shipTo.country ?? "India",
      billing_phone: input.shipTo.phone,
      shipping_is_billing: true,
      weight: input.weightKg ?? 0.5,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AppError(502, "COURIER_PROVIDER", `Shiprocket order create failed (${res.status}) ${text}`);
  }
  const data = (await res.json()) as { shipment_id?: number | string; awb_code?: string };
  const providerShipmentId = String(data.shipment_id ?? "");
  const awb = data.awb_code ?? "";
  return {
    provider: "SHIPROCKET",
    courierName: "Shiprocket",
    awb,
    trackingUrl: awb ? `https://shiprocket.co/tracking/${awb}` : "",
    providerShipmentId,
  };
}
