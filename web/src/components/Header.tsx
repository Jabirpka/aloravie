"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Wordmark } from "./Wordmark";
import { useCart } from "./CartProvider";
import { useAuth } from "./AuthProvider";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?category=kurtas", label: "Kurtas" },
  { href: "/shop?category=dresses", label: "Dresses" },
  { href: "/shop?category=sarees", label: "Sarees" },
  { href: "/shop?category=accessories", label: "Accessories" },
];

// Shown in the dropdown under the customer's name (and in the mobile menu).
const ACCOUNT_LINKS = [
  { href: "/account", label: "My account" },
  { href: "/account/orders", label: "My orders" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/returns", label: "Returns" },
];

export function Header() {
  const { count } = useCart();
  const { customer, logout } = useAuth();
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const acctRef = useRef<HTMLDivElement>(null);

  // Close both menus whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
    setAcctOpen(false);
  }, [pathname]);

  // Close the account dropdown on an outside click.
  useEffect(() => {
    if (!acctOpen) return;
    function onDown(e: MouseEvent) {
      if (acctRef.current && !acctRef.current.contains(e.target as Node)) setAcctOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [acctOpen]);

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

  const firstName = customer?.name?.split(" ")[0] || null;
  const initial = (customer?.name || customer?.email || "A").charAt(0).toUpperCase();

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link href="/" className="brand-link" aria-label="Aloravie home" onClick={() => setMenuOpen(false)}>
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
          <button className="link-btn theme-toggle" onClick={toggleTheme} aria-label="Toggle evening mode">
            {theme === "dark" ? "Daylight" : "Evening"}
          </button>

          {customer ? (
            <div className="acct-menu" ref={acctRef}>
              <button
                className="acct-trigger"
                aria-haspopup="menu"
                aria-expanded={acctOpen}
                onClick={() => setAcctOpen((o) => !o)}
              >
                <span className="acct-avatar">{initial}</span>
                <span className="acct-name">{firstName ?? "Account"}</span>
                <span aria-hidden="true">▾</span>
              </button>
              {acctOpen && (
                <div className="acct-dropdown" role="menu">
                  <div className="acct-head">
                    <div className="acct-head-name">{customer.name || "Your account"}</div>
                    {customer.email && <div className="acct-head-email">{customer.email}</div>}
                  </div>
                  <div className="acct-sep" />
                  {ACCOUNT_LINKS.map((l) => (
                    <Link key={l.href} href={l.href} onClick={() => setAcctOpen(false)}>
                      {l.label}
                    </Link>
                  ))}
                  <div className="acct-sep" />
                  <button type="button" onClick={() => { setAcctOpen(false); void logout(); }}>Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/account" className="link-btn" aria-label="Sign in">Sign in</Link>
          )}

          <Link href="/cart" className="link-btn bag-link">
            Bag
            {count > 0 && <span className="bag-count" aria-label={`${count} items in bag`}>{count}</span>}
          </Link>
          <button
            className="nav-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="container mobile-nav" aria-label="Menu">
          {NAV.map((item) => (
            <Link key={item.label} href={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
          <button className="link-btn" onClick={() => { toggleTheme(); setMenuOpen(false); }}>
            {theme === "dark" ? "Switch to daylight" : "Switch to evening"}
          </button>
        </nav>
      )}
    </header>
  );
}
