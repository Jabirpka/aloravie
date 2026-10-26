"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Wordmark } from "./Wordmark";
import { useCart } from "./CartProvider";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?category=kurtas", label: "Kurtas" },
  { href: "/shop?category=dresses", label: "Dresses" },
  { href: "/shop?category=sarees", label: "Sarees" },
  { href: "/shop?category=accessories", label: "Accessories" },
];

export function Header() {
  const { count } = useCart();
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("aloravie-theme");
      if (saved === "light" || saved === "dark") {
        document.documentElement.setAttribute("data-theme", saved);
        setTheme(saved);
        return;
      }
    } catch {
      /* ignore */
    }
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }, []);

  const toggleTheme = useCallback(() => {
    const next = (document.documentElement.getAttribute("data-theme") ?? theme) === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
    try {
      localStorage.setItem("aloravie-theme", next);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link href="/" className="brand-link" aria-label="Aloravie home">
          <Wordmark />
        </Link>
        <nav className="site-nav" aria-label="Primary">
          {NAV.map((item) => (
            <Link key={item.label} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="site-actions">
          <button className="link-btn" onClick={toggleTheme} aria-label="Toggle evening mode">
            {theme === "dark" ? "Daylight" : "Evening"}
          </button>
          <Link href="/account" className="link-btn">Account</Link>
          <Link href="/cart" className="link-btn bag-link">
            Bag
            {count > 0 && <span className="bag-count" aria-label={`${count} items in bag`}>{count}</span>}
          </Link>
        </div>
      </div>
    </header>
  );
}
