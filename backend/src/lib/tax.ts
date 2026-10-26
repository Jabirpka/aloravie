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

/** Total GST across lines, in minor units. Tax is GST-inclusive-free (added on top of price). */
export function computeTaxMinor(lines: TaxableLine[]): number {
  return lines.reduce(
    (sum, l) => sum + Math.round(l.unitPriceMinor * l.quantity * gstRateForUnitPrice(l.unitPriceMinor)),
    0,
  );
}
