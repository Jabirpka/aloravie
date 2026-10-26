// Deterministic on-brand gradient placeholder for a product with no image yet.
// Keyed by slug so a product always gets the same tone.

const GRADIENTS = [
  "linear-gradient(160deg,#f1e4d2,#cf8a63)",
  "linear-gradient(160deg,#efe6d8,#d3a07e)",
  "linear-gradient(160deg,#e7d6c0,#b9754f)",
  "linear-gradient(160deg,#f0e7d7,#c79a76)",
  "linear-gradient(160deg,#e4d3bb,#9c6749)",
  "linear-gradient(160deg,#efe4d2,#c28a66)",
  "linear-gradient(160deg,#eaddc9,#a86a4a)",
  "linear-gradient(160deg,#f3e7d6,#d98363)",
];

export function toneForSlug(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length]!;
}
