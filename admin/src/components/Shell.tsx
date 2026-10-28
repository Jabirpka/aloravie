"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AdminAuthProvider";
import { canAccess, type Feature } from "@/lib/access";

const NAV: { href: string; label: string; feature: Feature }[] = [
  { href: "/", label: "Dashboard", feature: "dashboard" },
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
  { href: "/settings", label: "Settings", feature: "employees" },
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
      <aside className="sidebar">
        <span className="wordmark sidebar-brand">alorav<span className="sun">{"ı"}</span>e</span>
        <nav className="nav">
          {NAV.filter((item) => canAccess(user, item.feature)).map((item) => (
            <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? "active" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">Back office · {user.role.toLowerCase()}</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1 className="topbar-title">{title}</h1>
          <div className="topbar-user">
            <button className="link-btn" onClick={toggleTheme}>{theme === "dark" ? "Daylight" : "Evening"}</button>
            <span>{user.name}</span>
            <button className="btn sm" onClick={() => logout()}>Sign out</button>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
