import type { Metadata } from "next";
import { Jost } from "next/font/google";
import "./globals.css";
import "./components.css";
import Link from "next/link";
import { CartProvider } from "@/components/CartProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Aloravie — Dressed up in first light",
    template: "%s · Aloravie",
  },
  description:
    "Aloravie — women's clothing and accessories, made for slow mornings and first light. Midrange, made in India.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jost.variable}>
      <body>
        <AuthProvider>
          <CartProvider>
            <Header />
            <main>{children}</main>
            <Footer />
            <Link href="/support" className="support-fab" aria-label="Chat with support">Chat with us</Link>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
