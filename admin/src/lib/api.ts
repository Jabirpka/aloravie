// Admin API client (staff). Tokens live in localStorage; a 401 triggers one refresh-and-retry.
import type {
  AdminProduct,
  AuditEntry,
  CustomerDetail,
  CustomerRow,
  InventoryRow,
  ChannelDetail,
  ChannelRow,
  Department,
  Employee,
  CategoryRow,
  Coupon,
  NotificationLogRow,
  OrderDetail,
  Report,
  ReturnRecord,
  ReviewRecord,
  SupportConversationDetail,
  SupportConversationRow,
  OrderRow,
  OrderStatus,
  ProductStatus,
  Shipment,
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
  // FormData (file uploads) must keep the browser's multipart boundary — only
  // set a JSON content-type for plain-string bodies.
  const isJson = init.body != null && !(init.body instanceof FormData);
  const headers = new Headers(init.headers);
  if (isJson) headers.set("Content-Type", "application/json");
  if (withAuth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (res.status === 401 && withAuth && (await tryRefresh())) {
    const retry = new Headers(init.headers);
    if (isJson) retry.set("Content-Type", "application/json");
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

export interface CreateProductInput {
  title: string;
  slug: string;
  description?: string;
  status?: ProductStatus;
  categoryId?: string;
  images?: { url: string; alt?: string }[];
  variants: { sku: string; name: string; priceMinor: number; stock?: number }[];
}

export async function createProduct(input: CreateProductInput): Promise<AdminProduct> {
  return ((await apiFetch("/api/admin/products", { method: "POST", body: JSON.stringify(input) })) as {
    product: AdminProduct;
  }).product;
}

// Upload product photos; returns the stored URLs to attach on create.
export async function uploadProductImages(files: File[]): Promise<string[]> {
  const form = new FormData();
  for (const f of files) form.append("images", f);
  return ((await apiFetch("/api/admin/uploads", { method: "POST", body: form })) as { urls: string[] }).urls;
}

export async function listCustomers(q?: string): Promise<CustomerRow[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return ((await apiFetch(`/api/admin/customers${qs}`)) as { customers: CustomerRow[] }).customers;
}

export async function getCustomer(id: string): Promise<CustomerDetail> {
  return ((await apiFetch(`/api/admin/customers/${id}`)) as { customer: CustomerDetail }).customer;
}

// Customer-care password reset: issues a temporary password (returned once).
export async function resetCustomerPassword(id: string): Promise<{ tempPassword: string; email: string | null }> {
  return (await apiFetch(`/api/admin/customers/${id}/reset-password`, { method: "POST" })) as {
    tempPassword: string;
    email: string | null;
  };
}

// --- Fulfilment ---

export async function createShipment(orderId: string): Promise<Shipment> {
  return (
    (await apiFetch(`/api/admin/orders/${orderId}/shipment`, { method: "POST" })) as { shipment: Shipment }
  ).shipment;
}

export async function syncTracking(shipmentId: string): Promise<Shipment> {
  return (
    (await apiFetch(`/api/admin/shipments/${shipmentId}/sync`, { method: "POST" })) as { shipment: Shipment }
  ).shipment;
}

// --- Marketplace channels ---

export async function listChannels(): Promise<ChannelRow[]> {
  return ((await apiFetch("/api/admin/channels")) as { channels: ChannelRow[] }).channels;
}

export async function getChannel(id: string): Promise<ChannelDetail> {
  return ((await apiFetch(`/api/admin/channels/${id}`)) as { channel: ChannelDetail }).channel;
}

export async function connectChannel(id: string): Promise<ChannelDetail> {
  return ((await apiFetch(`/api/admin/channels/${id}/connect`, { method: "POST" })) as { channel: ChannelDetail })
    .channel;
}

export async function pushChannelInventory(id: string): Promise<{ pushed: number }> {
  return (await apiFetch(`/api/admin/channels/${id}/push-inventory`, { method: "POST" })) as { pushed: number };
}

export async function pullChannelOrders(id: string): Promise<{ created: number; skipped: number }> {
  return (await apiFetch(`/api/admin/channels/${id}/pull-orders`, { method: "POST" })) as {
    created: number;
    skipped: number;
  };
}

// --- Support & notifications ---

export async function listSupport(status?: "OPEN" | "CLOSED"): Promise<SupportConversationRow[]> {
  const qs = status ? `?status=${status}` : "";
  return ((await apiFetch(`/api/admin/support${qs}`)) as { conversations: SupportConversationRow[] }).conversations;
}

export async function getSupport(id: string): Promise<SupportConversationDetail> {
  return ((await apiFetch(`/api/admin/support/${id}`)) as { conversation: SupportConversationDetail }).conversation;
}

export async function replySupport(id: string, body: string): Promise<SupportConversationDetail> {
  return (
    (await apiFetch(`/api/admin/support/${id}/reply`, { method: "POST", body: JSON.stringify({ body }) })) as {
      conversation: SupportConversationDetail;
    }
  ).conversation;
}

export async function closeSupport(id: string): Promise<SupportConversationDetail> {
  return (
    (await apiFetch(`/api/admin/support/${id}/close`, { method: "POST" })) as {
      conversation: SupportConversationDetail;
    }
  ).conversation;
}

export async function listNotifications(): Promise<NotificationLogRow[]> {
  return ((await apiFetch("/api/admin/notifications")) as { notifications: NotificationLogRow[] }).notifications;
}

// --- Employees / administration ---

export async function listEmployees(): Promise<Employee[]> {
  return ((await apiFetch("/api/admin/employees")) as { employees: Employee[] }).employees;
}

export async function createEmployee(input: {
  name: string;
  email: string;
  password: string;
  role: "OWNER" | "ADMIN" | "STAFF";
  departments: Department[];
}): Promise<Employee> {
  return ((await apiFetch("/api/admin/employees", { method: "POST", body: JSON.stringify(input) })) as {
    employee: Employee;
  }).employee;
}

export async function updateEmployee(
  id: string,
  input: Partial<{
    name: string;
    role: "OWNER" | "ADMIN" | "STAFF";
    departments: Department[];
    isActive: boolean;
    password: string;
  }>,
): Promise<Employee> {
  return ((await apiFetch(`/api/admin/employees/${id}`, { method: "PATCH", body: JSON.stringify(input) })) as {
    employee: Employee;
  }).employee;
}

// --- Returns ---

export function assetUrl(p: string): string {
  return p.startsWith("http") ? p : `${API_URL}${p}`;
}

export async function listReturns(status?: ReturnRecord["status"]): Promise<ReturnRecord[]> {
  const qs = status ? `?status=${status}` : "";
  return ((await apiFetch(`/api/admin/returns${qs}`)) as { returns: ReturnRecord[] }).returns;
}

export async function getReturn(id: string): Promise<ReturnRecord> {
  return ((await apiFetch(`/api/admin/returns/${id}`)) as { return: ReturnRecord }).return;
}

export async function decideReturn(
  id: string,
  action: "approve" | "reject" | "refund",
  note?: string,
): Promise<ReturnRecord> {
  return ((await apiFetch(`/api/admin/returns/${id}/${action}`, {
    method: "POST",
    body: note ? JSON.stringify({ note }) : undefined,
  })) as { return: ReturnRecord }).return;
}

// --- Coupons ---

export async function listCoupons(): Promise<Coupon[]> {
  return ((await apiFetch("/api/admin/coupons")) as { coupons: Coupon[] }).coupons;
}

export interface CouponInput {
  code: string;
  description?: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minSpendMinor?: number;
  maxDiscountMinor?: number | null;
  active?: boolean;
  usageLimit?: number | null;
  endsAt?: string | null;
}

export async function createCoupon(input: CouponInput): Promise<Coupon> {
  return ((await apiFetch("/api/admin/coupons", { method: "POST", body: JSON.stringify(input) })) as { coupon: Coupon }).coupon;
}

export async function updateCoupon(id: string, input: Partial<CouponInput>): Promise<Coupon> {
  return ((await apiFetch(`/api/admin/coupons/${id}`, { method: "PATCH", body: JSON.stringify(input) })) as { coupon: Coupon }).coupon;
}

// --- Categories ---

export async function listCategories(): Promise<CategoryRow[]> {
  return ((await apiFetch("/api/admin/categories")) as { categories: CategoryRow[] }).categories;
}

export async function createCategory(input: { name: string; slug: string; parentId?: string | null }): Promise<CategoryRow> {
  return ((await apiFetch("/api/admin/categories", { method: "POST", body: JSON.stringify(input) })) as { category: CategoryRow }).category;
}

export async function updateCategory(id: string, input: { name?: string; slug?: string; parentId?: string | null }): Promise<CategoryRow> {
  return ((await apiFetch(`/api/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify(input) })) as { category: CategoryRow }).category;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiFetch(`/api/admin/categories/${id}`, { method: "DELETE" });
}

// --- Reports ---

export async function getReports(days?: number): Promise<Report> {
  const qs = days ? `?days=${days}` : "";
  return (await apiFetch(`/api/admin/reports${qs}`)) as Report;
}

// --- Reviews ---

export async function listReviews(status?: "PUBLISHED" | "HIDDEN"): Promise<ReviewRecord[]> {
  const qs = status ? `?status=${status}` : "";
  return ((await apiFetch(`/api/admin/reviews${qs}`)) as { reviews: ReviewRecord[] }).reviews;
}

export async function setReviewStatus(id: string, status: "PUBLISHED" | "HIDDEN"): Promise<ReviewRecord> {
  return ((await apiFetch(`/api/admin/reviews/${id}`, { method: "PATCH", body: JSON.stringify({ status }) })) as {
    review: ReviewRecord;
  }).review;
}

// --- Audit log ---

export async function listAudit(): Promise<AuditEntry[]> {
  return ((await apiFetch(`/api/admin/audit`)) as { entries: AuditEntry[] }).entries;
}

export type DocumentKind = "invoice" | "delivery-note" | "label";

// Fetch a printable document (HTML) with auth, so navigation doesn't drop the token.
export async function fetchDocumentHtml(orderNumber: string, kind: DocumentKind): Promise<string> {
  const path = `/api/admin/orders/${encodeURIComponent(orderNumber)}/${kind}`;
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res = await fetch(`${API_URL}${path}`, { headers });
  if (res.status === 401 && (await tryRefresh())) {
    const retry = new Headers();
    retry.set("Authorization", `Bearer ${getAccessToken()}`);
    res = await fetch(`${API_URL}${path}`, { headers: retry });
  }
  if (!res.ok) throw new ApiRequestError(res.status, await res.json().catch(() => ({})));
  return res.text();
}
