import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions">
      <p>
        These Terms &amp; Conditions govern your use of this website and your purchases from{" "}
        {LEGAL.legalName} (&ldquo;{LEGAL.brand}&rdquo;). By placing an order you accept these terms.
      </p>

      <h2>Eligibility &amp; accounts</h2>
      <p>
        You must be at least 18 years old, or use the site under the supervision of a parent or guardian.
        You are responsible for keeping your account credentials confidential and for all activity under
        your account.
      </p>

      <h2>Products &amp; pricing</h2>
      <ul>
        <li>All prices are listed in Indian Rupees (INR) and are inclusive of applicable GST unless stated otherwise.</li>
        <li>We make every effort to display colours and details accurately, but actual products may vary slightly.</li>
        <li>We may correct errors, change prices, or update product information at any time before you order.</li>
        <li>All orders are subject to acceptance and product availability.</li>
      </ul>

      <h2>Orders &amp; payment</h2>
      <p>
        Payments are processed securely through Razorpay (UPI, cards, net-banking, and wallets). Your
        order is confirmed once payment is successfully received. We reserve the right to cancel any order
        in cases of suspected fraud, pricing errors, or stock unavailability, in which case any amount paid
        is refunded in full.
      </p>

      <h2>Shipping, returns &amp; refunds</h2>
      <p>
        Delivery timelines are described in our <Link href="/shipping">Shipping Policy</Link>, and returns,
        cancellations, and refunds are governed by our{" "}
        <Link href="/refunds">Returns &amp; Refunds Policy</Link>.
      </p>

      <h2>Intellectual property</h2>
      <p>
        All content on this site — including the {LEGAL.brand} name, logo, designs, images, and text — is
        our property or licensed to us and may not be copied or used without written permission.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by law, {LEGAL.brand} is not liable for any indirect or consequential loss
        arising from your use of the site or products. Our total liability for any order is limited to the
        amount you paid for that order.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India, and any disputes are subject to the exclusive
        jurisdiction of the courts of {LEGAL.address.includes("Bengaluru") ? "Bengaluru, Karnataka" : "our registered location"}.
      </p>

      <h2>Contact</h2>
      <p>
        Email <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
        {LEGAL.phone ? ` or call ${LEGAL.phone}` : ""}.
      </p>
    </LegalPage>
  );
}
