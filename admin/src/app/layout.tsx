import type { Metadata } from "next";
import { Jost } from "next/font/google";
import "./globals.css";
import { AdminAuthProvider } from "@/components/AdminAuthProvider";

const jost = Jost({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-jost", display: "swap" });

export const metadata: Metadata = {
  title: "Aloravie Back Office",
  description: "Staff admin for the Aloravie commerce platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jost.variable}>
      <body>
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
