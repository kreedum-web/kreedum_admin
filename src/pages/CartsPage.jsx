import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { ago, money } from "../lib/format";
import { Card, Empty, ErrorBox, PageHeader, Pagination, Spinner, Table, Tabs } from "../components/ui";

export default function CartsPage() {
  const [params, setParams] = useSearchParams();
  const type = params.get("type") || "cart";
  const idle = params.get("idle") || "";
  const q = params.get("q") || "";
  const page = Number(params.get("page")) || 1;
  const [search, setSearch] = useState(q);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };

  useEffect(() => {
    const t = setTimeout(() => search !== q && update({ q: search }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["carts", { type, idle, q, page }],
    queryFn: () => adminApi.carts({ type, idle, q, page }),
    placeholderData: keepPreviousData,
  });

  const isCart = type === "cart";

  return (
    <>
      <PageHeader
        title="Carts & wishlists"
        subtitle="Signed-in customers with products waiting in their cart or wishlist. Open one to see the items, call or WhatsApp them, and note what they said."
      />
      <Tabs
        tabs={[
          { value: "cart", label: "In cart" },
          { value: "wishlist", label: "In wishlist" },
        ]}
        value={type}
        onChange={(v) => update({ type: v === "cart" ? "" : v })}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
          <input className="input !pl-9" placeholder="Name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input !w-auto" value={idle} onChange={(e) => update({ idle: e.target.value })}>
          <option value="">Any time</option>
          <option value="1">Untouched 1 hour+</option>
          <option value="24">Untouched 1 day+</option>
          <option value="72">Untouched 3 days+</option>
          <option value="168">Untouched 1 week+</option>
        </select>
      </div>

      {error ? (
        <ErrorBox error={errorMessage(error)} retry={refetch} />
      ) : (
        <Card>
          {isLoading ? (
            <Spinner />
          ) : data.rows.length === 0 ? (
            <Empty title={isCart ? "No carts waiting" : "No wishlists"}>
              {idle ? "Try a shorter time." : "When signed-in customers add products, they'll show up here."}
            </Empty>
          ) : (
            <Table head={["Customer", "Products", { label: isCart ? "Cart value" : "Wishlist value", right: true }, "Last change", "Followed up"]}>
              {data.rows.map((r) => (
                <tr key={r.customer.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link to={`/carts/${r.customer.id}?from=${type}`} className="font-medium text-brand hover:underline">
                      {r.customer.name || r.customer.email || r.customer.phone}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {[r.customer.phone, r.customer.email].filter(Boolean).join(" · ")}
                    </div>
                    <div className="text-xs text-slate-400">{r.orders ? `${r.orders} past order${r.orders > 1 ? "s" : ""}` : "Never ordered"}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {r.preview.map((p, i) =>
                        p.thumbnail ? (
                          <img key={i} src={p.thumbnail} alt={p.name} title={p.name} className="size-9 rounded border border-slate-100 bg-white object-contain" />
                        ) : (
                          <div key={i} title={p.name} className="size-9 rounded bg-slate-100" />
                        )
                      )}
                      <span className="ml-1 text-xs text-slate-500">
                        {isCart ? `${r.quantity} item${r.quantity === 1 ? "" : "s"}` : `${r.lines} product${r.lines === 1 ? "" : "s"}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">{money(r.value)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{ago(r.updatedAt)}</td>
                  <td className="max-w-56 px-4 py-2.5 text-xs">
                    {r.lastFollowUp ? (
                      <>
                        <span className="text-slate-500">{ago(r.lastFollowUp.at)}{r.lastFollowUp.by && ` · ${r.lastFollowUp.by}`}</span>
                        <p className="truncate text-slate-700" title={r.lastFollowUp.note}>{r.lastFollowUp.note}</p>
                      </>
                    ) : (
                      <span className="text-amber-700">Not yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
          {data && <Pagination page={data.page} pages={data.pages} total={data.total} onPage={(p) => update({ page: String(p) })} />}
        </Card>
      )}
    </>
  );
}
