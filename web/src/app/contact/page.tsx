import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Contact Us" };

export default function ContactPage() {
  return (
    <LegalPage title="Contact Us">
      <p>We&rsquo;re here to help. Reach us through any of the channels below.</p>

      <h2>Customer care</h2>
      <ul>
        <li><strong>Email:</strong> <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></li>
        {LEGAL.phone ? <li><strong>Phone:</strong> {LEGAL.phone}</li> : null}
        <li><strong>Hours:</strong> {LEGAL.hours}</li>
      </ul>

      <p>
        Already have an order? You can also message us from the{" "}
        <Link href="/support">support page</Link> in your account, and we&rsquo;ll reply there.
      </p>

      <h2>Business details</h2>
      <ul>
        <li><strong>{LEGAL.legalName}</strong></li>
        <li>{LEGAL.address}</li>
        {LEGAL.gstin ? <li>GSTIN: {LEGAL.gstin}</li> : null}
      </ul>

      <p>
        We aim to respond to all enquiries within one business day.
      </p>
    </LegalPage>
  );
}
