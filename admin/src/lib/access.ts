import type { Department, StaffUser } from "./types";

// Mirrors backend/src/lib/access.ts — keep the two in step.
export type Feature =
  | "dashboard"
  | "orders.view"
  | "orders.fulfil"
  | "inventory"
  | "catalog"
  | "channels"
  | "customers"
  | "support"
  | "returns"
  | "coupons"
  | "notifications"
  | "reports"
  | "employees";

export const ALL_DEPARTMENTS: Department[] = ["RETURNS", "PACKING", "CUSTOMER_CARE", "OFFERS", "CRM"];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  RETURNS: "Returns approval",
  PACKING: "Packing / Fulfilment",
  CUSTOMER_CARE: "Customer care",
  OFFERS: "Offers / Merchandising",
  CRM: "Customer relationship",
};

const FEATURE_DEPARTMENTS: Record<Feature, Department[]> = {
  dashboard: [],
  "orders.view": ["PACKING", "CUSTOMER_CARE", "RETURNS"],
  "orders.fulfil": ["PACKING"],
  inventory: ["OFFERS"],
  catalog: ["OFFERS"],
  channels: ["OFFERS"],
  customers: ["CRM"],
  support: ["CUSTOMER_CARE"],
  returns: ["RETURNS"],
  coupons: ["OFFERS"],
  notifications: ["CUSTOMER_CARE"],
  reports: [],
  employees: [],
};

export function canAccess(user: Pick<StaffUser, "role" | "departments">, feature: Feature): boolean {
  if (user.role === "OWNER" || user.role === "ADMIN") return true;
  if (feature === "dashboard") return true;
  return FEATURE_DEPARTMENTS[feature].some((d) => user.departments.includes(d));
}
