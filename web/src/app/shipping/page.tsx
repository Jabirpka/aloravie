import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Shipping Policy" };

export default function ShippingPage() {
  return (
    <LegalPage title="Shipping Policy">
      <p>We ship across India. Here&rsquo;s what to expect once you place an order.</p>

      <h2>Charges</h2>
      <ul>
        <li>Free shipping on orders over {LEGAL.freeShipThreshold}.</li>
        <li>A flat shipping fee of {LEGAL.flatShip} applies to orders below that amount.</li>
        <li>Any shipping charge is shown clearly at checkout before you pay.</li>
      </ul>

      <h2>Dispatch &amp; delivery times</h2>
      <ul>
        <li>Orders are dispatched within {LEGAL.dispatchDays} of payment confirmation.</li>
        <li>Delivery typically takes {LEGAL.deliveryDays} after dispatch, depending on your location.</li>
        <li>You&rsquo;ll receive tracking details once your order ships.</li>
      </ul>
      <p>
        These are estimates; actual times may vary due to courier delays, weather, festivals, or other
        factors beyond our control.
      </p>

      <h2>Tracking your order</h2>
      <p>
        Once dispatched, you can track your order from the tracking link we send and from your account&rsquo;s
        order history.
      </p>

      <h2>Delivery issues</h2>
      <p>
        Please ensure your shipping address and phone number are accurate. If a delivery fails due to an
        incorrect address or repeated unavailability, the parcel may be returned to us; re-shipping may
        incur an additional charge. If your order is delayed or lost, contact us and we&rsquo;ll help resolve it.
      </p>

      <h2>Contact</h2>
      <p>
        For shipping questions, email <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
        {LEGAL.phone ? ` or call ${LEGAL.phone}` : ""} ({LEGAL.hours}).
      </p>
    </LegalPage>
  );
}
