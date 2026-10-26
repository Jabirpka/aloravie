// Admin API client (staff). Tokens live in localStorage; a 401 triggers one refresh-and-retry.
import type {
  AdminProduct,
  CustomerDetail,
  CustomerRow,
  InventoryRow,
  OrderDetail,
  OrderRow,
  OrderStatus,
  ProductStatus,
  StaffUser,
  Summary,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const ACCESS_KEY = "aloravie-staff-access";
const REFRESH_KEY = "aloravie-staff-refresh";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, body: { error?: { code?: string; message?: string } }) {
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

async function tryRefresh(): Promise<boolean> {
  const refreshToken = read(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const body = (await res.json()) as { accessToken: string; refreshToken: string };
    write(ACCESS_KEY, body.accessToken);
    write(REFRESH_KEY, body.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function apiFetch(path: string, init: RequestInit = {}, withAuth = true): Promise<unknown> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (withAuth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (res.status === 401 && withAuth && (await tryRefresh())) {
    const retry = new Headers(init.headers);
    if (init.body) retry.set("Content-Type", "application/json");
    retry.set("Authorization", `Bearer ${getAccessToken()}`);
    return parse(await fetch(`${API_URL}${path}`, { ...init, headers: retry }));
  }
  return parse(res);
}

// --- Auth ---

export async function login(email: string, password: string): Promise<StaffUser> {
  const body = (await apiFetch(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    false,
  )) as { user: StaffUser; accessToken: string; refreshToken: string };
  write(ACCESS_KEY, body.accessToken);
  write(REFRESH_KEY, body.refreshToken);
  return body.user;
}

export async function fetchMe(): Promise<StaffUser | null> {
  if (!getAccessToken()) return null;
  try {
    const body = (await apiFetch("/api/auth/me")) as { user: StaffUser | null };
    return body.user;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  const refreshToken = read(REFRESH_KEY);
  if (refreshToken) {
    try {
      await apiFetch("/api/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }, false);
    } catch {
      /* ignore */
    }
  }
  clearTokens();
}

// --- Admin data ---

export async function getSummary(): Promise<Summary> {
  return (await apiFetch("/api/admin/summary")) as Summary;
}

export async function listOrders(status?: OrderStatus): Promise<OrderRow[]> {
  const qs = status ? `?status=${status}` : "";
  return ((await apiFetch(`/api/admin/orders${qs}`)) as { orders: OrderRow[] }).orders;
}

export async function getOrder(orderNumber: string): Promise<OrderDetail> {
  return ((await apiFetch(`/api/admin/orders/${encodeURIComponent(orderNumber)}`)) as { order: OrderDetail })
    .order;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<OrderDetail> {
  return (
    (await apiFetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    })) as { order: OrderDetail }
  ).order;
}

export async function listInventory(lowStockOnly = false): Promise<InventoryRow[]> {
  const qs = lowStockOnly ? "?lowStock=true" : "";
  return ((await apiFetch(`/api/admin/inventory${qs}`)) as { inventory: InventoryRow[] }).inventory;
}

export async function adjustInventory(input: {
  variantId: string;
  locationId?: string;
  setOnHand?: number;
  delta?: number;
}): Promise<InventoryRow> {
  const body = (await apiFetch("/api/admin/inventory/adjust", {
    method: "POST",
    body: JSON.stringify(input),
  })) as { inventory: { id: string; onHand: number; reserved: number } };
  // The adjust endpoint returns the raw item; callers refetch the list for the mapped shape.
  return body.inventory as unknown as InventoryRow;
}

export async function listProducts(): Promise<AdminProduct[]> {
  return ((await apiFetch("/api/admin/products")) as { products: AdminProduct[] }).products;
}

export async function updateProductStatus(id: string, status: ProductStatus): Promise<void> {
  await apiFetch(`/api/admin/products/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export async function listCustomers(q?: string): Promise<CustomerRow[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return ((await apiFetch(`/api/admin/customers${qs}`)) as { customers: CustomerRow[] }).customers;
}

export async function getCustomer(id: string): Promise<CustomerDetail> {
  return ((await apiFetch(`/api/admin/customers/${id}`)) as { customer: CustomerDetail }).customer;
}
