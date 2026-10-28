import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";

// Shared shell for the legal / policy pages.
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="container section legal">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true"> / </span>
        <span className="muted">{title}</span>
      </nav>
      <h1 className="legal-title">{title}</h1>
      <p className="muted legal-updated">Last updated: {LEGAL.lastUpdated}</p>
      <div className="legal-body">{children}</div>
    </section>
  );
}
