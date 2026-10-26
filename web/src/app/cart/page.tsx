import type { Metadata } from "next";
import { CartView } from "@/components/CartView";

export const metadata: Metadata = { title: "Your bag" };

export default function CartPage() {
  return (
    <section className="container section">
      <CartView />
    </section>
  );
}
