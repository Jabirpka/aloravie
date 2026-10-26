// The Aloravie wordmark: lowercase, the dot of the "i" drawn as a rising sun.
// Rendered type here is a stand-in; production uses the supplied logo files.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`wordmark ${className ?? ""}`} aria-label="Aloravie">
      alorav<span className="sun" aria-hidden="true">i</span>e
    </span>
  );
}
