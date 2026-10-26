"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/components/AdminAuthProvider";
import { listCustomers } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { CustomerRow } from "@/lib/types";

export default function CustomersPage() {
  const { user, loading } = useAuth();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async (q: string) => {
    setState("loading");
    try {
      setCustomers(await listCustomers(q || undefined));
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    void load("");
  }, [user, loading, load]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void load(query.trim());
  }

  return (
    <Shell title="Customers">
      <form className="filters" onSubmit={submit}>
        <input
          placeholder="Search by name, email or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minWidth: 280 }}
        />
        <button className="btn" type="submit">Search</button>
        {query && <button className="btn" type="button" onClick={() => { setQuery(""); void load(""); }}>Clear</button>}
      </form>

      <div className="card">
        <div className="table-wrap">
          {state === "loading" && <div className="empty">Loading…</div>}
          {state === "error" && <div className="empty">Couldn&rsquo;t load customers.</div>}
          {state === "ready" &&
            (customers.length === 0 ? (
              <div className="empty">No customers found.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Phone</th><th className="num">Orders</th><th className="num">Lifetime spend</th><th>Joined</th></tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td className="strong"><Link href={`/customers/${c.id}`}>{c.name ?? "—"}</Link></td>
                      <td>{c.email ?? "—"}</td>
                      <td className="muted">{c.phone ?? "—"}</td>
                      <td className="num">{c.orderCount}</td>
                      <td className="num">{formatMoney(c.lifetimeSpendMinor)}</td>
                      <td className="muted">{new Date(c.createdAt).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>
      </div>
    </Shell>
  );
}
