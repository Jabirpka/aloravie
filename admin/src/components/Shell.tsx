"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./AdminAuthProvider";
import { canAccess, type Feature } from "@/lib/access";
import { MoonIcon, SunIcon } from "./icons";

const NAV: { href: string; label: string; feature: Feature }[] = [
  { href: "/", label: "Dashboard", feature: "dashboard" },
  { href: "/reports", label: "Reports", feature: "reports" },
  { href: "/orders", label: "Orders", feature: "orders.view" },
  { href: "/returns", label: "Returns", feature: "returns" },
  { href: "/inventory", label: "Inventory", feature: "inventory" },
  { href: "/products", label: "Products", feature: "catalog" },
  { href: "/categories", label: "Categories", feature: "catalog" },
  { href: "/reviews", label: "Reviews", feature: "catalog" },
  { href: "/coupons", label: "Coupons", feature: "coupons" },
  { href: "/channels", label: "Channels", feature: "channels" },
  { href: "/customers", label: "Customers", feature: "customers" },
  { href: "/support", label: "Support", feature: "support" },
  { href: "/notifications", label: "Notifications", feature: "notifications" },
  { href: "/audit", label: "Audit log", feature: "employees" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close the mobile drawer and the user menu whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // Close the user menu on an outside click.
  useEffect(() => {
    if (!userMenuOpen) return;
    function onDown(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [userMenuOpen]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("aloravie-admin-theme");
      if (saved === "light" || saved === "dark") {
        document.documentElement.setAttribute("data-theme", saved);
        setTheme(saved);
        return;
      }
    } catch {
      /* ignore */
    }
    setTheme(window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const toggleTheme = useCallback(() => {
    const next = (document.documentElement.getAttribute("data-theme") ?? theme) === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
    try {
      localStorage.setItem("aloravie-admin-theme", next);
    } catch {
      /* ignore */
    }
  }, [theme]);

  if (loading) return <div className="empty">Loading…</div>;
  if (!user) return <div className="empty">Redirecting to sign in…</div>;

  return (
    <div className="admin-shell">
      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}
      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <span className="wordmark sidebar-brand">alorav<span className="sun">{"ı"}</span>e</span>
        <nav className="nav">
          {NAV.filter((item) => canAccess(user, item.feature)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(pathname, item.href) ? "active" : ""}
              onClick={() => setNavOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">Back office · {user.role.toLowerCase()}</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="nav-burger" aria-label="Open menu" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>☰</button>
            <h1 className="topbar-title">{title}</h1>
          </div>
          <div className="topbar-user">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to daylight mode" : "Switch to evening mode"}
              title={theme === "dark" ? "Daylight" : "Evening"}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <div className="user-menu" ref={userMenuRef}>
              <button
                className="user-trigger"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                onClick={() => setUserMenuOpen((o) => !o)}
              >
                <span className="user-avatar">{user.name.charAt(0).toUpperCase()}</span>
                <span className="user-trigger-name">{user.name}</span>
                <span aria-hidden="true">▾</span>
              </button>
              {userMenuOpen && (
                <div className="user-dropdown" role="menu">
                  <div className="user-dropdown-head">
                    <div className="strong">{user.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{user.email}</div>
                  </div>
                  <div className="user-dropdown-sep" />
                  <Link href="/profile" onClick={() => setUserMenuOpen(false)}>My profile</Link>
                  <Link href="/team" onClick={() => setUserMenuOpen(false)}>Team board</Link>
                  {canAccess(user, "employees") && (
                    <Link href="/settings" onClick={() => setUserMenuOpen(false)}>Account settings</Link>
                  )}
                  <div className="user-dropdown-sep" />
                  <button type="button" onClick={() => logout()}>Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
