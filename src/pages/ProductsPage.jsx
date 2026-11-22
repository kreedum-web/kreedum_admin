import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Lock, Search, X } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { money, STOCK } from "../lib/format";
import { Badge, Card, Empty, ErrorBox, PageHeader, Pagination, Spinner, Table, Toggle } from "../components/ui";

export default function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const filters = {
    q: params.get("q") || "",
    state: params.get("state") || "",
    stock: params.get("stock") || "",
    department: params.get("department") || "",
    category: params.get("category") || "",
    page: Number(params.get("page")) || 1,
  };
  const [search, setSearch] = useState(filters.q);
  const queryClient = useQueryClient();

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };

  useEffect(() => {
    const t = setTimeout(() => search !== filters.q && update({ q: search, page: "" }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products", filters],
    queryFn: () => adminApi.products(filters),
    placeholderData: keepPreviousData,
  });

  const setLive = useMutation({
    mutationFn: ({ id, live }) => adminApi.updateProduct(id, { live }),
    onSuccess: (p) => {
      toast.success(p.live ? "Now showing on the website" : "Hidden from the website");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Products" subtitle="Change prices, stock and photos, or hide a product. Your changes stay even after the next Metro catalogue sync." />
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
          <input className="input !pl-9" placeholder="Name, SKU or brand" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input !w-auto" value={filters.state} onChange={(e) => update({ state: e.target.value, page: "" })}>
          <option value="">Shown & hidden</option>
          <option value="live">Shown on website</option>
          <option value="hidden">Hidden</option>
          <option value="locked">Changed by hand</option>
        </select>
        <select className="input !w-auto" value={filters.stock} onChange={(e) => update({ stock: e.target.value, page: "" })}>
          <option value="">Any stock</option>
          {Object.entries(STOCK).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className="input !w-auto" value={filters.department} onChange={(e) => update({ department: e.target.value, page: "" })}>
          <option value="">All departments</option>
          {(data?.departments || []).map((d) => (
            <option key={d} value={d}>{d.replace(/-/g, " ")}</option>
          ))}
        </select>
        {filters.category && (
          <button
            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700 hover:bg-indigo-100"
            onClick={() => update({ category: "", page: "" })}
            title="Clear the category filter"
          >
            Category: {filters.category.replace(/-/g, " ")} <X className="size-3.5" />
          </button>
        )}
      </div>

      {error ? (
        <ErrorBox error={errorMessage(error)} retry={refetch} />
      ) : (
        <Card>
          {isLoading ? (
            <Spinner />
          ) : data.products.length === 0 ? (
            <Empty title="No products found" />
          ) : (
            <Table head={["Product", "Brand", { label: "Price", right: true }, "Stock", "On website"]}>
              {data.products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="max-w-md px-4 py-2">
                    <Link to={`/products/${p.id}`} className="flex items-center gap-3">
                      {p.thumbnail ? (
                        <img src={p.thumbnail} alt="" className="size-11 shrink-0 rounded border border-slate-100 object-contain" />
                      ) : (
                        <div className="size-11 shrink-0 rounded bg-slate-100" />
                      )}
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-medium text-navy hover:text-brand">{p.name}</p>
                        <p className="flex items-center gap-1.5 text-xs text-slate-500">
                          {p.sku && <span>SKU {p.sku}</span>}
                          {p.variantCount > 0 && <span>· {p.variantCount} options</span>}
                          {p.adminLocked.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-amber-700" title="Changed by hand: kept during catalogue syncs">
                              <Lock className="size-3" /> edited
                            </span>
                          )}
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.brand}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                    {p.sellingPrice ? (
                      <>
                        {money(p.sellingPrice)}
                        {p.maxPrice > p.sellingPrice && <span className="text-slate-500"> – {money(p.maxPrice)}</span>}
                        {p.mrp > p.sellingPrice && <div className="text-xs text-slate-400 line-through">{money(p.mrp)}</div>}
                      </>
                    ) : (
                      <span className="text-slate-400">On request</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={p.stockStatus === "in_stock" ? "green" : p.stockStatus === "out_of_stock" ? "red" : "gray"}>{STOCK[p.stockStatus]}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Toggle
                      checked={p.live}
                      label={`Show ${p.name} on website`}
                      disabled={setLive.isPending && setLive.variables?.id === p.id}
                      onChange={(live) => setLive.mutate({ id: p.id, live })}
                    />
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
