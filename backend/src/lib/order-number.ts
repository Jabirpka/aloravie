// Human-facing order number, e.g. ALV-2026-00042.
// `seq` is the count of existing orders + 1, computed inside the checkout transaction.
// Note: for high concurrency this should move to a dedicated DB sequence.
export function formatOrderNumber(seq: number, date = new Date()): string {
  return `ALV-${date.getFullYear()}-${String(seq).padStart(5, "0")}`;
}
