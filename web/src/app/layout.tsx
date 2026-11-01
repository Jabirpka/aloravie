import type { Metadata } from "next";
import { Jost } from "next/font/google";
import "./globals.css";
import "./components.css";
import { CartProvider } from "@/components/CartProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { WishlistProvider } from "@/components/WishlistProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatWidget } from "@/components/ChatWidget";

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-jost",
  display: "swap",
});

// Base URL for resolving relative Open Graph image / page links. The storefront
// origin; falls back to the API origin (same host on the IP preview).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Aloravie — Dressed up in first light",
    template: "%s · Aloravie",
  },
  description:
    "Aloravie — women's clothing and accessories, made for slow mornings and first light. Midrange, made in India.",
  openGraph: {
    type: "website",
    siteName: "Aloravie",
    title: "Aloravie — Dressed up in first light",
    description: "Women's clothing and accessories, made for slow mornings and first light.",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jost.variable}>
      <body>
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>
              <Header />
              <main>{children}</main>
              <Footer />
              <ChatWidget />
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
