import type { ChannelType } from "@prisma/client";
import { randomInt } from "node:crypto";
import { env } from "../../env.js";
import { AppError } from "../../lib/http.js";

export interface InventoryPushItem {
  externalSku: string;
  available: number;
}

export interface IncomingAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export interface IncomingOrder {
  externalId: string; // marketplace order id (used to de-duplicate)
  buyerName: string;
  buyerEmail?: string;
  buyerPhone?: string;
  shipTo: IncomingAddress;
  items: { externalSku: string; quantity: number }[];
}

export interface MarketplaceConnector {
  readonly channel: ChannelType;
  readonly mode: "mock" | "live";
  pushInventory(items: InventoryPushItem[]): Promise<{ pushed: number }>;
  // `catalog` is the set of our listed SKUs on this channel, so mock orders
  // only reference items that actually exist.
  fetchNewOrders(catalog: { externalSku: string }[]): Promise<IncomingOrder[]>;
}

export function marketplaceMode(): "mock" | "live" {
  return env.MARKETPLACE_MODE;
}

// --- Mock connector (works without any seller account) ---

const BUYERS = [
  { name: "Ananya Sharma", city: "Pune", state: "Maharashtra", pincode: "411001" },
  { name: "Isha Reddy", city: "Hyderabad", state: "Telangana", pincode: "500034" },
  { name: "Neha Gupta", city: "New Delhi", state: "Delhi", pincode: "110001" },
  { name: "Priya Menon", city: "Kochi", state: "Kerala", pincode: "682016" },
  { name: "Riya Singh", city: "Jaipur", state: "Rajasthan", pincode: "302001" },
];

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length)]!;
}

class MockConnector implements MarketplaceConnector {
  readonly mode = "mock" as const;
  constructor(readonly channel: ChannelType) {}

  async pushInventory(items: InventoryPushItem[]): Promise<{ pushed: number }> {
    // A real connector would call the marketplace's inventory API here.
    return { pushed: items.length };
  }

  async fetchNewOrders(catalog: { externalSku: string }[]): Promise<IncomingOrder[]> {
    if (catalog.length === 0) return [];
    // Simulate 0–2 new orders per pull so demos can run repeatedly.
    const orderCount = randomInt(1, 3);
    const orders: IncomingOrder[] = [];
    for (let i = 0; i < orderCount; i++) {
      const buyer = pick(BUYERS);
      const lineCount = Math.min(catalog.length, randomInt(1, 3));
      const chosen = new Set<string>();
      while (chosen.size < lineCount) chosen.add(pick(catalog).externalSku);
      const items = [...chosen].map((externalSku) => ({ externalSku, quantity: randomInt(1, 3) }));
      const handle = buyer.name.toLowerCase().split(" ")[0];
      orders.push({
        externalId: `${this.channel}-${Date.now()}-${randomInt(1000, 9999)}`,
        buyerName: buyer.name,
        buyerEmail: `${handle}.${randomInt(10, 99)}@marketplace.example`,
        buyerPhone: `+9198${randomInt(10000000, 99999999)}`,
        shipTo: {
          name: buyer.name,
          phone: `+9198${randomInt(10000000, 99999999)}`,
          line1: `${randomInt(1, 200)}, ${pick(["MG Road", "Residency Lane", "Park Street", "Lake View"])}`,
          city: buyer.city,
          state: buyer.state,
          pincode: buyer.pincode,
          country: "India",
        },
        items,
      });
    }
    return orders;
  }
}

// --- Live connector stub ---
// Each marketplace (Amazon SP-API, Flipkart, Myntra, Meesho) has its own auth
// and APIs. Those are wired per-channel once the brand has seller credentials;
// until then live mode fails loudly rather than silently doing nothing.
class LiveStubConnector implements MarketplaceConnector {
  readonly mode = "live" as const;
  constructor(readonly channel: ChannelType) {}

  private notReady(): never {
    throw new AppError(
      501,
      "CONNECTOR_NOT_IMPLEMENTED",
      `The live ${this.channel} connector is not configured yet. Add this channel's seller credentials and implement its API, or use MARKETPLACE_MODE=mock.`,
    );
  }

  async pushInventory(): Promise<{ pushed: number }> {
    this.notReady();
  }
  async fetchNewOrders(): Promise<IncomingOrder[]> {
    this.notReady();
  }
}

export function getConnector(channel: ChannelType): MarketplaceConnector {
  return marketplaceMode() === "mock" ? new MockConnector(channel) : new LiveStubConnector(channel);
}
