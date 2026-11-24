import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Eye, EyeOff, Lock, Plus, Search, Store, X } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { money, STOCK } from "../lib/format";
import { Badge, Button, Card, Empty, ErrorBox, Modal, PageHeader, Pagination, Spinner, Table, Toggle } from "../components/ui";

export default function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const filters = {
    q: params.get("q") || "",
    state: params.get("state") || "",
    highlight: params.get("highlight") || "",
    stock: params.get("stock") || "",
    department: params.get("department") || "",
    category: params.get("category") || "",
    page: Number(params.get("page")) || 1,
    brand: params.get("brand") || "",
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

  // Lists for the filter menus (counts across every brand / department).
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: () => adminApi.categories() });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: () => adminApi.brands() });

  const setLive = useMutation({
    mutationFn: ({ id, live }) => adminApi.updateProduct(id, { live }),
    onSuccess: (p) => {
      toast.success(p.live ? "Now showing on the website" : "Hidden from the website");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // Department › sub-category › nested category, worked out from ?department= and ?category=.
  const selectedCategory = categories.find((c) => c.slug === filters.category);
  const selectedPath = selectedCategory?.path || [];
  const department = selectedPath[0] || filters.department;
  const subcategory = selectedPath[1] || "";
  const nested = selectedPath[2] || "";
  const departments = categories.filter((c) => c.level === 1);
  const subcategories = categories.filter((c) => c.level === 2 && c.path?.[0] === department);
  const nestedCategories = categories.filter((c) => c.level === 3 && c.path?.[1] === subcategory);
  const anyFilter = ["q", "state", "stock", "brand", "department", "category", "highlight"].some((k) => filters[k]);

  // ---- bulk show / hide: every product matching the filters (all pages)
  const [bulk, setBulk] = useState(null); // { live, preview }
  const bulkFilters = {
    q: filters.q, brand: filters.brand, department: filters.department, category: filters.category,
    state: filters.state, stock: filters.stock, highlight: filters.highlight,
  };
  const previewBulk = useMutation({
    mutationFn: (live) => adminApi.bulkProductsLive({ filters: bulkFilters, live, dryRun: true }),
    onSuccess: (preview, live) => setBulk({ live, preview }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const applyBulk = useMutation({
    mutationFn: () => adminApi.bulkProductsLive({ filters: bulkFilters, live: bulk.live }),
    onSuccess: (r) => {
      setBulk(null);
      ["products", "categories", "brands"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      const n = (k) => `${k} product${k === 1 ? "" : "s"}`;
      toast.success(
        bulk.live
          ? `${n(r.changed)} shown on the website${r.waiting ? `; ${r.waiting} will show once their category or brand is on` : ""}`
          : `${n(r.changed)} hidden from the website`
      );
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // ---- bulk ready stock (in our store: fastest delivery)
  const readyStock = useMutation({
    mutationFn: async (mark) => {
      const preview = await adminApi.bulkReadyStock({ filters: bulkFilters, readyStock: mark, dryRun: true });
      if (!preview.changed) return { ...preview, skipped: true, mark };
      const n = (k) => `${k} product${k === 1 ? "" : "s"}`;
      const ok = confirm(
        mark
          ? `Mark ${n(preview.changed)} as ready stock (in our store, fastest delivery)?${preview.already ? ` ${preview.already} already are.` : ""}\n\nThey'll show in the home page's Ready Stock row.`
          : `Remove ready stock from ${n(preview.changed)}?`
      );
      if (!ok) return { cancelled: true };
      return { ...(await adminApi.bulkReadyStock({ filters: bulkFilters, readyStock: mark })), mark };
    },
    onSuccess: (r) => {
      if (r.cancelled) return;
      if (r.skipped) return toast(`All ${r.matched} already ${r.mark ? "are" : "aren't"} ready stock.`);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`${r.changed} product${r.changed === 1 ? "" : "s"} ${r.mark ? "marked" : "no longer"} ready stock`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Add products, change prices, stock and photos, or hide a product. Your changes stay even after the next catalogue sync."
        actions={
          <Link to="/products/new">
            <Button>
              <Plus className="size-4" /> New product
            </Button>
          </Link>
        }
      />
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
        <select className="input !w-auto" value={filters.highlight} onChange={(e) => update({ highlight: e.target.value, page: "" })}>
          <option value="">Any highlight</option>
          <option value="featured">Featured</option>
          <option value="bestseller">Best seller</option>
          <option value="new">New arrival</option>
          <option value="trending">Trending</option>
          <option value="ready-stock">Ready stock</option>
        </select>
        <select className="input !w-auto" value={filters.stock} onChange={(e) => update({ stock: e.target.value, page: "" })}>
          <option value="">Any stock</option>
          {Object.entries(STOCK).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className="input !w-auto" value={filters.brand} onChange={(e) => update({ brand: e.target.value, page: "" })}>
          <option value="">All brands</option>
          {brands
            .filter((b) => b.totalProducts > 0 || b.slug === filters.brand)
            .map((b) => (
              <option key={b.slug} value={b.slug}>{b.name}</option>
            ))}
        </select>
        <select
          className="input !w-auto"
          value={department}
          onChange={(e) => update({ department: e.target.value, category: "", page: "" })}
        >
          <option value="">All departments</option>
          {departments.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
        {department && subcategories.length > 0 && (
          <select
            className="input !w-auto"
            value={subcategory}
            onChange={(e) => update({ department, category: e.target.value, page: "" })}
          >
            <option value="">All of {departments.find((d) => d.slug === department)?.name || "it"}</option>
            {subcategories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        )}
        {subcategory && nestedCategories.length > 0 && (
          <select
            className="input !w-auto"
            value={nested}
            onChange={(e) => update({ department, category: e.target.value || subcategory, page: "" })}
          >
            <option value="">All of {subcategories.find((c) => c.slug === subcategory)?.name || "it"}</option>
            {nestedCategories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        )}
        {filters.category && !selectedCategory && categories.length > 0 && (
          <span className="self-center text-sm text-amber-700">Category “{filters.category}” no longer exists.</span>
        )}
        {anyFilter && (
          <button
            type="button"
            className="inline-flex items-center gap-1 self-center text-sm font-medium text-slate-500 hover:text-navy"
            onClick={() => {
              setSearch("");
              setParams(new URLSearchParams());
            }}
          >
            <X className="size-3.5" /> Clear filters
          </button>
        )}
      </div>

      {anyFilter && data?.total > 0 && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-600">
            {data.total} product{data.total === 1 ? "" : "s"} match these filters{data.pages > 1 ? ` (all ${data.pages} pages)` : ""}.
          </span>
          <span className="flex gap-2">
            <Button variant="secondary" loading={previewBulk.isPending && previewBulk.variables === true} disabled={previewBulk.isPending} onClick={() => previewBulk.mutate(true)}>
              <Eye className="size-4" /> Show all
            </Button>
            <Button variant="secondary" loading={previewBulk.isPending && previewBulk.variables === false} disabled={previewBulk.isPending} onClick={() => previewBulk.mutate(false)}>
              <EyeOff className="size-4" /> Hide all
            </Button>
            {filters.highlight === "ready-stock" ? (
              <Button variant="secondary" loading={readyStock.isPending} onClick={() => readyStock.mutate(false)}>
                <Store className="size-4" /> Remove ready stock
              </Button>
            ) : (
              <Button variant="secondary" loading={readyStock.isPending} onClick={() => readyStock.mutate(true)}>
                <Store className="size-4" /> Mark ready stock
              </Button>
            )}
          </span>
        </div>
      )}
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
                          {p.manual && <Badge tone="blue">Added here</Badge>}
                          {p.readyStock && <Badge tone="green">Ready stock</Badge>}
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

      <Modal
        open={Boolean(bulk)}
        title={bulk?.live ? "Show these products on the website?" : "Hide these products from the website?"}
        onClose={() => setBulk(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulk(null)}>Cancel</Button>
            <Button
              variant={bulk?.live ? "primary" : "danger"}
              loading={applyBulk.isPending}
              disabled={!bulk?.preview.changed && !(bulk?.live && bulk?.preview.waiting)}
              onClick={() => applyBulk.mutate()}
            >
              {bulk?.live ? `Show ${bulk?.preview.changed}` : `Hide ${bulk?.preview.changed}`}
            </Button>
          </>
        }
      >
        {bulk && <BulkPreview live={bulk.live} preview={bulk.preview} />}
      </Modal>
    </>
  );
}

/** What a bulk show / hide will do, from its dry run. */
function BulkPreview({ live, preview: p }) {
  const n = (k) => `${k} product${k === 1 ? "" : "s"}`;
  return (
    <div className="space-y-2 text-sm text-slate-700">
      <p>Of the {n(p.matched)} matching your filters (every page, not only this one):</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <b>{n(p.changed)}</b> will be {live ? "shown" : "hidden"}.
        </li>
        {p.already > 0 && <li>{n(p.already)} {p.already === 1 ? "is" : "are"} already {live ? "shown" : "hidden"}.</li>}
        {live && p.waiting > 0 && (
          <li>
            {n(p.waiting)} stay hidden because their category or brand is hidden; they'll show once that is switched on.
          </li>
        )}
        {live && p.bySync > 0 && (
          <li>
            {n(p.bySync)} were hidden by the catalogue sync (no longer at the supplier, or no category) and are left as they are. Open
            one to switch it on by hand.
          </li>
        )}
      </ul>
      {!live && p.changed > 0 && <p className="text-slate-500">They stay hidden after catalogue syncs, until you show them again.</p>}
    </div>
  );
}
