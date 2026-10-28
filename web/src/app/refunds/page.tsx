import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Returns, Refunds & Cancellations" };

export default function RefundsPage() {
  return (
    <LegalPage title="Returns, Refunds & Cancellations">
      <p>
        We want you to love what you ordered. If something isn&rsquo;t right, here&rsquo;s how returns, refunds, and
        cancellations work.
      </p>

      <h2>Returns</h2>
      <ul>
        <li>You can request a return within {LEGAL.returnWindowDays} days of delivery.</li>
        <li>Items must be unused, unworn, and unwashed, with original tags and packaging intact.</li>
        <li>To start a return, open the order in your account and choose <em>Request a return</em>, selecting a reason and adding a photo where relevant.</li>
        <li>Certain items may be non-returnable for hygiene reasons (e.g. innerwear); this is noted on the product where it applies.</li>
      </ul>

      <h2>Cancellations</h2>
      <p>
        You can cancel an order before it has been dispatched by contacting us as soon as possible. Once
        an order has shipped, it can no longer be cancelled, but you may request a return after delivery.
      </p>

      <h2>Refunds</h2>
      <ul>
        <li>Once your return is approved (and the item received and inspected where applicable), we process the refund to your original payment method via Razorpay.</li>
        <li>Refunds are typically credited within 5–7 business days after approval, depending on your bank or payment provider.</li>
        <li>Shipping charges, if any, are non-refundable unless the return is due to our error (wrong or damaged item).</li>
        <li>For cancelled or undelivered orders, the full amount paid is refunded.</li>
      </ul>

      <h2>Damaged or wrong items</h2>
      <p>
        If you receive a damaged, defective, or incorrect item, contact us within 48 hours of delivery with
        a photo. We&rsquo;ll arrange a replacement or a full refund, including any shipping charge, at no cost to you.
      </p>

      <h2>Contact</h2>
      <p>
        For returns and refunds, email <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
        {LEGAL.phone ? ` or call ${LEGAL.phone}` : ""} ({LEGAL.hours}).
      </p>
    </LegalPage>
  );
}
