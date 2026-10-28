import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This Privacy Policy explains how {LEGAL.legalName} (&ldquo;{LEGAL.brand}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
        collects, uses, and protects your personal information when you shop with us at this website.
        By using the site you agree to this policy.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account &amp; contact details</strong> — your name, email, phone number, and password (stored only as a secure hash).</li>
        <li><strong>Order &amp; delivery details</strong> — shipping and billing addresses, items ordered, and order history.</li>
        <li><strong>Payment information</strong> — processed by our payment partner, Razorpay. We do not receive or store your full card, UPI, or bank details.</li>
        <li><strong>Support &amp; returns</strong> — messages, voice notes, and photos you send us for support or return requests.</li>
        <li><strong>Usage data</strong> — basic technical information your browser sends (e.g. device and pages viewed) to keep the site working and secure.</li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>To process and deliver your orders, and issue invoices.</li>
        <li>To handle returns, refunds, and customer support.</li>
        <li>To send you order and delivery updates.</li>
        <li>To prevent fraud and keep your account secure.</li>
        <li>To comply with tax and legal obligations.</li>
      </ul>

      <h2>Sharing your information</h2>
      <p>
        We share data only with the partners needed to run the store: our payment gateway (Razorpay),
        courier and logistics providers (to deliver your order), and communication providers (to send
        order updates). We do not sell your personal information. We may disclose information where
        required by law.
      </p>

      <h2>Data retention &amp; security</h2>
      <p>
        We keep your information for as long as your account is active or as needed to provide services
        and meet legal and tax requirements. We use industry-standard measures — including encrypted
        connections and hashed passwords — to protect your data, though no method of transmission is
        perfectly secure.
      </p>

      <h2>Your rights</h2>
      <p>
        You may request access to, correction of, or deletion of your personal information, and you may
        unsubscribe from marketing messages at any time. To make a request, contact us at{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>

      <h2>Cookies</h2>
      <p>
        We use only the storage necessary for the site to function (for example, to keep you signed in
        and remember your cart). We do not use non-essential advertising cookies without your consent.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Email <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
        {LEGAL.phone ? ` or call ${LEGAL.phone}` : ""}. {LEGAL.legalName}, {LEGAL.address}.
      </p>
    </LegalPage>
  );
}
