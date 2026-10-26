// Money helpers. Amounts are ALWAYS integer minor units (paise for INR),
// paired with a currency code. Formatting to a display string happens here only.

export interface Money {
  amountMinor: number;
  currency: string;
}

const MINOR_PER_MAJOR = 100; // paise per rupee; cents per dollar — all ISO currencies we use are 2-decimal.

export function toMajor(amountMinor: number): number {
  return amountMinor / MINOR_PER_MAJOR;
}

export function fromMajor(amountMajor: number): number {
  return Math.round(amountMajor * MINOR_PER_MAJOR);
}

/** Format minor units for display, e.g. 189000 -> "₹1,890.00" (INR). */
export function formatMoney(amountMinor: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(toMajor(amountMinor));
}

/** Sum a list of minor-unit amounts, guarding against float drift. */
export function sumMinor(amounts: number[]): number {
  return amounts.reduce((acc, n) => acc + Math.round(n), 0);
}
