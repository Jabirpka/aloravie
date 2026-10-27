import type { Department, UserRole } from "@prisma/client";

// Features the back office exposes. Each maps to the departments that grant it;
// OWNER/ADMIN bypass the map entirely, and "dashboard" is open to any staff.
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
  | "employees";

export const ALL_DEPARTMENTS: Department[] = ["RETURNS", "PACKING", "CUSTOMER_CARE", "OFFERS", "CRM"];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  RETURNS: "Returns approval",
  PACKING: "Packing / Fulfilment",
  CUSTOMER_CARE: "Customer care",
  OFFERS: "Offers / Merchandising",
  CRM: "Customer relationship",
};

// Departments that grant each feature. [] = OWNER/ADMIN only.
const FEATURE_DEPARTMENTS: Record<Feature, Department[]> = {
  dashboard: [], // special-cased: any signed-in staff
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
  employees: [], // OWNER/ADMIN only
};

export interface AccessUser {
  role: UserRole;
  departments: Department[];
}

export function hasAccess(user: AccessUser, feature: Feature): boolean {
  if (user.role === "OWNER" || user.role === "ADMIN") return true;
  if (feature === "dashboard") return true;
  return FEATURE_DEPARTMENTS[feature].some((d) => user.departments.includes(d));
}

// The features a user can reach — handy for the client to filter navigation.
export function allowedFeatures(user: AccessUser): Feature[] {
  return (Object.keys(FEATURE_DEPARTMENTS) as Feature[]).filter((f) => hasAccess(user, f));
}
