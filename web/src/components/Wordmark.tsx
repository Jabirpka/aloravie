// The Aloravie wordmark: lowercase, the dot of the "i" drawn as a rising sun.
// A DOTLESS "i" (ı) is used so the sun is the only dot — the glyph's own tittle
// would otherwise sit under the sun and read as a second circle.
// Rendered type here is a stand-in; production uses the supplied logo files.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`wordmark ${className ?? ""}`} aria-label="Aloravie">
      alorav<span className="sun" aria-hidden="true">{"ı"}</span>e
    </span>
  );
}
