import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { dateTime, money } from "../lib/format";
import { Card, Empty, ErrorBox, NewDot, OrderStatus, PageHeader, Pagination, PaymentStatus, Spinner, Table, Tabs } from "../components/ui";
import { useNotifications } from "../components/NotificationWatcher";

const TABS = [
  { value: "", label: "All" },
  { value: "NEW", label: "New" },
  { value: "PENDING", label: "To confirm" },
  { value: "TO_SHIP", label: "To pack & ship" },
  { value: "IN_TRANSIT", label: "On the way" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "RETURNED", label: "Returned" },
  { value: "AWAITING_PAYMENT", label: "Unpaid checkouts" },
];

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const page = Number(params.get("page")) || 1;
  const q = params.get("q") || "";
  const payment = params.get("payment") || "";
  const [search, setSearch] = useState(q);
  const { newOrders: newCount } = useNotifications();

  // Search as you type (after a short pause).
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== q) update({ q: search, page: "" });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["orders", { status, page, q, payment }],
    queryFn: () => adminApi.orders({ status, page, q, payment }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Orders" subtitle="Open an order to confirm it, mark it packed, shipped or delivered, or cancel it." />
      <Tabs
        tabs={TABS.map((t) => (t.value === "NEW" ? { ...t, count: newCount } : t))}
        value={status}
        onChange={(v) => update({ status: v, page: "" })}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
          <input className="input !pl-9" placeholder="Order number, name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input !w-auto" value={payment} onChange={(e) => update({ payment: e.target.value, page: "" })}>
          <option value="">All payments</option>
          <option value="COD">Cash on delivery</option>
          <option value="ONLINE">Paid online</option>
        </select>
      </div>

      {error ? (
        <ErrorBox error={errorMessage(error)} retry={refetch} />
      ) : (
        <Card>
          {isLoading ? (
            <Spinner />
          ) : data.orders.length === 0 ? (
            <Empty title="No orders here">{q ? "Try a different search." : "Orders in this list will show up here."}</Empty>
          ) : (
            <>
            {/* Phones: one card per order */}
            <ul className="divide-y divide-slate-100 sm:hidden">
              {data.orders.map((o) => (
                <li key={o.id}>
                  <Link to={`/orders/${o.id}`} className={`block px-4 py-3 ${o.isNew ? "bg-tint/50" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-brand">{o.orderNumber}</span>
                      <span className="font-semibold tabular-nums">{money(o.total)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-700">
                      {o.customer} · {o.city}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {o.firstItem}
                      {o.itemCount > 1 && ` + ${o.itemCount - 1} more`}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {o.isNew && <NewDot />}
                      <OrderStatus status={o.orderStatus} />
                      <PaymentStatus status={o.paymentStatus} method={o.paymentMethod} />
                      <span className="ml-auto text-xs text-slate-400">{dateTime(o.createdAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden sm:block">
            <Table head={["Order", "Customer", "Items", "Status", "Payment", { label: "Total", right: true }]}>
              {data.orders.map((o) => (
                <tr key={o.id} className={o.isNew ? "bg-tint/50 hover:bg-tint" : "hover:bg-slate-50"}>
                  <td className="px-4 py-2.5">
                    <Link to={`/orders/${o.id}`} className="whitespace-nowrap font-medium text-brand hover:underline">
                      {o.orderNumber}
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      {dateTime(o.createdAt)} {o.isNew && <NewDot />}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {o.customer}
                    <div className="text-xs text-slate-500">
                      {o.phone} · {o.city}
                    </div>
                  </td>
                  <td className="max-w-56 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {o.thumbnail && <img src={o.thumbnail} alt="" className="size-9 shrink-0 rounded border border-slate-100 object-contain" />}
                      <div className="min-w-0">
                        <p className="truncate">{o.firstItem}</p>
                        {o.itemCount > 1 && <p className="text-xs text-slate-500">{o.itemCount} items</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><OrderStatus status={o.orderStatus} /></td>
                  <td className="px-4 py-2.5"><PaymentStatus status={o.paymentStatus} method={o.paymentMethod} /></td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">{money(o.total)}</td>
                </tr>
              ))}
            </Table>
            </div>
            </>
          )}
          {data && <Pagination page={data.page} pages={data.pages} total={data.total} onPage={(p) => update({ page: String(p) })} />}
        </Card>
      )}
    </>
  );
}
