// Browser-side API client for authenticated customer actions (account, checkout, orders).
// Tokens live in localStorage; a 401 triggers a single refresh-and-retry.
import type {
  Address,
  AddressInput,
  CartLine,
  CheckoutResponse,
  CustomerAccount,
  Order,
  ReturnRequest,
  SupportConversation,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ACCESS_KEY = "aloravie-customer-access";
const REFRESH_KEY = "aloravie-customer-refresh";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, body: { error?: ApiError }) {
    super(body.error?.message ?? "Request failed");
    this.status = status;
    this.code = body.error?.code ?? "ERROR";
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function getAccessToken(): string | null {
  return read(ACCESS_KEY);
}
export function setTokens(accessToken: string, refreshToken: string) {
  write(ACCESS_KEY, accessToken);
  write(REFRESH_KEY, refreshToken);
}
export function clearTokens() {
  write(ACCESS_KEY, null);
  write(REFRESH_KEY, null);
}

async function parse(res: Response) {
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiRequestError(res.status, body);
  return body;
}

async function rawFetch(path: string, init: RequestInit = {}, withAuth = false): Promise<unknown> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (withAuth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401 && withAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retryHeaders = new Headers(init.headers);
      if (init.body) retryHeaders.set("Content-Type", "application/json");
      retryHeaders.set("Authorization", `Bearer ${getAccessToken()}`);
      return parse(await fetch(`${API_URL}${path}`, { ...init, headers: retryHeaders }));
    }
  }
  return parse(res);
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = read(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/api/customers/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const body = (await res.json()) as { accessToken: string; refreshToken: string };
    setTokens(body.accessToken, body.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// --- Auth ---

interface AuthPayload {
  customer: CustomerAccount;
  accessToken: string;
  refreshToken: string;
}

export async function registerCustomer(input: {
  email: string;
  password: string;
  name: string;
  phone?: string;
}): Promise<CustomerAccount> {
  const body = (await rawFetch("/api/customers/register", {
    method: "POST",
    body: JSON.stringify(input),
  })) as AuthPayload;
  setTokens(body.accessToken, body.refreshToken);
  return body.customer;
}

export async function loginCustomer(input: { email: string; password: string }): Promise<CustomerAccount> {
  const body = (await rawFetch("/api/customers/login", {
    method: "POST",
    body: JSON.stringify(input),
  })) as AuthPayload;
  setTokens(body.accessToken, body.refreshToken);
  return body.customer;
}

export async function fetchMe(): Promise<CustomerAccount | null> {
  if (!getAccessToken()) return null;
  try {
    const body = (await rawFetch("/api/customers/me", {}, true)) as { customer: CustomerAccount | null };
    return body.customer;
  } catch {
    return null;
  }
}

export async function logoutCustomer(): Promise<void> {
  const refreshToken = read(REFRESH_KEY);
  if (refreshToken) {
    try {
      await rawFetch("/api/customers/logout", { method: "POST", body: JSON.stringify({ refreshToken }) });
    } catch {
      /* ignore */
    }
  }
  clearTokens();
}

// --- Checkout & orders ---

export async function createCheckout(
  lines: CartLine[],
  opts: { shippingAddressId?: string; shippingAddress?: AddressInput; email?: string; couponCode?: string },
): Promise<CheckoutResponse> {
  const items = lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }));
  return (await rawFetch(
    "/api/checkout",
    { method: "POST", body: JSON.stringify({ items, ...opts }) },
    true,
  )) as CheckoutResponse;
}

export async function confirmMockPayment(orderId: string): Promise<Order> {
  const body = (await rawFetch(
    "/api/payments/mock/confirm",
    { method: "POST", body: JSON.stringify({ orderId }) },
    true,
  )) as { order: Order };
  return body.order;
}

export async function verifyRazorpayPayment(input: {
  orderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<Order> {
  const body = (await rawFetch(
    "/api/payments/razorpay/verify",
    { method: "POST", body: JSON.stringify(input) },
    true,
  )) as { order: Order };
  return body.order;
}

export async function listOrders(): Promise<Order[]> {
  const body = (await rawFetch("/api/orders", {}, true)) as { orders: Order[] };
  return body.orders;
}

export async function getOrder(orderNumber: string): Promise<Order> {
  const body = (await rawFetch(`/api/orders/${encodeURIComponent(orderNumber)}`, {}, true)) as {
    order: Order;
  };
  return body.order;
}

// --- Support chat ---

export async function listConversations(): Promise<SupportConversation[]> {
  const body = (await rawFetch("/api/support/conversations", {}, true)) as {
    conversations: SupportConversation[];
  };
  return body.conversations;
}

export async function getConversation(id: string): Promise<SupportConversation> {
  const body = (await rawFetch(`/api/support/conversations/${id}`, {}, true)) as {
    conversation: SupportConversation;
  };
  return body.conversation;
}

export async function startConversation(subject: string, message: string): Promise<SupportConversation> {
  const body = (await rawFetch("/api/support/conversations", {
    method: "POST",
    body: JSON.stringify({ subject, body: message }),
  }, true)) as { conversation: SupportConversation };
  return body.conversation;
}

export function assetUrl(p: string): string {
  return p.startsWith("http") ? p : `${API_URL}${p}`;
}

export async function getReviews(slug: string): Promise<import("./types").ReviewSummary> {
  return (await rawFetch(`/api/products/${encodeURIComponent(slug)}/reviews`)) as import("./types").ReviewSummary;
}

export async function postReview(
  slug: string,
  input: { rating: number; title?: string; body?: string },
): Promise<void> {
  await rawFetch(`/api/products/${encodeURIComponent(slug)}/reviews`, {
    method: "POST",
    body: JSON.stringify(input),
  }, true);
}

export async function validateCoupon(
  code: string,
  subtotalMinor: number,
): Promise<{ code: string; description: string | null; discountMinor: number }> {
  const body = (await rawFetch("/api/coupons/validate", {
    method: "POST",
    body: JSON.stringify({ code, subtotalMinor }),
  })) as { coupon: { code: string; description: string | null; discountMinor: number } };
  return body.coupon;
}

export async function sendVoice(id: string, blob: Blob): Promise<SupportConversation> {
  const form = new FormData();
  form.append("audio", blob, "voice.webm");
  async function attempt(): Promise<Response> {
    const headers = new Headers();
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_URL}/api/support/conversations/${id}/voice`, { method: "POST", headers, body: form });
  }
  let res = await attempt();
  if (res.status === 401 && (await tryRefresh())) res = await attempt();
  return (await parse(res) as { conversation: SupportConversation }).conversation;
}

export async function sendMessage(id: string, message: string): Promise<SupportConversation> {
  const body = (await rawFetch(`/api/support/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: message }),
  }, true)) as { conversation: SupportConversation };
  return body.conversation;
}

// --- Saved addresses ---

export async function listAddresses(): Promise<Address[]> {
  const body = (await rawFetch("/api/customers/me/addresses", {}, true)) as { addresses: Address[] };
  return body.addresses;
}

export async function createAddress(input: AddressInput & { isDefault?: boolean }): Promise<Address> {
  const body = (await rawFetch("/api/customers/me/addresses", {
    method: "POST",
    body: JSON.stringify(input),
  }, true)) as { address: Address };
  return body.address;
}

export async function deleteAddress(id: string): Promise<void> {
  await rawFetch(`/api/customers/me/addresses/${id}`, { method: "DELETE" }, true);
}

// --- Returns ---

export async function listReturns(): Promise<ReturnRequest[]> {
  const body = (await rawFetch("/api/returns", {}, true)) as { returns: ReturnRequest[] };
  return body.returns;
}

// Multipart create (photos upload in the same request). Handles one refresh retry.
export async function createReturn(form: FormData): Promise<ReturnRequest> {
  async function attempt(): Promise<Response> {
    const headers = new Headers();
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_URL}/api/returns`, { method: "POST", headers, body: form });
  }
  let res = await attempt();
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await attempt();
  }
  return (await parse(res) as { return: ReturnRequest }).return;
}
