// Business + contact details shown on the legal / policy pages.
// ⚠️ Before launch: replace every TODO placeholder with your registered details,
// and have the pages reviewed by a lawyer / CA for your state.
export const LEGAL = {
  brand: "Aloravie",
  legalName: "Aloravie", // TODO: your registered business / legal entity name
  gstin: "", // TODO: your GSTIN (leave blank until GST registration is granted)
  address: "Bengaluru, Karnataka, India", // TODO: full registered business address
  email: "care@aloravie.in", // TODO: your monitored support email
  phone: "", // TODO: support phone with country code, e.g. +91 98XXXXXXXX
  hours: "Monday–Saturday, 10am–6pm IST",
  lastUpdated: "29 October 2026",

  // Shipping — keep in sync with the store's pricing rules
  freeShipThreshold: "₹1,499",
  flatShip: "₹99",
  dispatchDays: "1–2 business days",
  deliveryDays: "3–7 business days",

  // Returns
  returnWindowDays: 7,
} as const;
