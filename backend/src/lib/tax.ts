// GST for apparel sold in India.
// Garments are taxed at 5% up to ₹1,000 per piece and 12% above that.
// (Simplified; a production setup drives rates from an HSN/tax table per product.)

const GST_THRESHOLD_MINOR = 100000; // ₹1,000
const GST_LOW = 0.05;
const GST_HIGH = 0.12;

export function gstRateForUnitPrice(unitPriceMinor: number): number {
  return unitPriceMinor <= GST_THRESHOLD_MINOR ? GST_LOW : GST_HIGH;
}

export interface TaxableLine {
  unitPriceMinor: number;
  quantity: number;
}

/**
 * Prices are GST-INCLUSIVE: the listed price already contains GST. These helpers
 * extract the GST portion that sits inside an inclusive amount, for the invoice
 * breakdown. base = inclusive / (1 + rate); gst = inclusive − base.
 */
export function extractGstMinor(inclusiveMinor: number, rate: number): number {
  return inclusiveMinor - Math.round(inclusiveMinor / (1 + rate));
}

/** Total GST contained within GST-inclusive line totals, in minor units. */
export function extractTaxMinor(lines: TaxableLine[]): number {
  return lines.reduce(
    (sum, l) => sum + extractGstMinor(l.unitPriceMinor * l.quantity, gstRateForUnitPrice(l.unitPriceMinor)),
    0,
  );
}
