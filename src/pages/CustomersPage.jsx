import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { date, money } from "../lib/format";
import { Badge, Card, Empty, ErrorBox, PageHeader, Pagination, Spinner, Table } from "../components/ui";

export default function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const page = Number(params.get("page")) || 1;
  const [search, setSearch] = useState(q);

  useEffect(() => {
    const t = setTimeout(() => search !== q && setParams(search ? { q: search } : {}), 350);
    return () => clearTimeout(t);
  }, [search, q, setParams]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["customers", { q, page }],
    queryFn: () => adminApi.customers({ q, page }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Customers" subtitle="Everyone with a store account, newest first." />
      <div className="relative mb-3 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
        <input className="input !pl-9" placeholder="Name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {error ? (
        <ErrorBox error={errorMessage(error)} retry={refetch} />
      ) : (
        <Card>
          {isLoading ? (
            <Spinner />
          ) : data.customers.length === 0 ? (
            <Empty title="No customers found" />
          ) : (
            <Table head={["Customer", "Contact", "Joined", { label: "Orders", right: true }, { label: "Spent", right: true }]}>
              {data.customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link to={`/customers/${c.id}`} className="font-medium text-brand hover:underline">
                      {c.name || "(no name yet)"}
                    </Link>
                    {!c.isActive && <Badge tone="red" className="ml-2">Disabled</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {c.email && <div>{c.email}</div>}
                    {c.phone && <div className="text-xs text-slate-500">{c.phone}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{date(c.createdAt)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{c.orders}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">{c.spent ? money(c.spent) : "—"}</td>
                </tr>
              ))}
            </Table>
          )}
          {data && <Pagination page={data.page} pages={data.pages} total={data.total} onPage={(p) => setParams({ ...(q ? { q } : {}), page: String(p) })} />}
        </Card>
      )}
    </>
  );
}
