import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Search, Trash2, X } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { money } from "../lib/format";
import { bySlugOf, categoryLabel } from "../lib/categories";
import { Badge, Button, Card, ErrorBox, Field, PageHeader, Spinner, Toggle } from "../components/ui";
import { RULE_TEXT } from "./HomeSectionsPage";

const SORTS = {
  popular: "Most popular",
  newest: "Newest",
  discount: "Biggest discount",
  price_low: "Price: low to high",
  price_high: "Price: high to low",
};

// Dates are picked as days (India time); a row runs from the start of its first day to the end of its last.
const dayOf = (iso) => (iso ? new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10) : "");
const startOf = (day) => (day ? `${day}T00:00:00+05:30` : null);
const endOf = (day) => (day ? `${day}T23:59:59+05:30` : null);

function formFrom(s) {
  return {
    title: s.title,
    subtitle: s.subtitle,
    isVisible: s.isVisible,
    limit: s.limit,
    startDay: dayOf(s.startsAt),
    endDay: dayOf(s.endsAt),
    autoFill: s.autoFill,
    filters: { ...s.filters, minPrice: s.filters.minPrice ?? "", maxPrice: s.filters.maxPrice ?? "", minDiscount: s.filters.minDiscount ?? "" },
  };
}

const Thumb = ({ src }) =>
  src ? <img src={src} alt="" className="size-10 shrink-0 rounded border border-slate-100 object-contain" /> : <div className="size-10 shrink-0 rounded bg-slate-100" />;

/** One home page row: picks (in order), settings, dates, fill rule, and a preview. */
export default function HomeSectionEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sections = useQuery({ queryKey: ["home-sections"], queryFn: () => adminApi.homeSections() });
  const section = sections.data?.find((s) => s.id === id);
  const picksQuery = useQuery({ queryKey: ["home-section-picks", id], queryFn: () => adminApi.homeSectionPicks(id) });
  const preview = useQuery({ queryKey: ["home-section-preview", id], queryFn: () => adminApi.homeSectionPreview(id) });
  const custom = section?.rule === "custom";
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => adminApi.categories(), enabled: custom });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => adminApi.brands(), enabled: custom });

  const [form, setForm] = useState(null);
  const [picks, setPicks] = useState(null);
  useEffect(() => {
    if (section && !form) setForm(formFrom(section));
  }, [section, form]);
  useEffect(() => {
    if (picksQuery.data && !picks) setPicks(picksQuery.data);
  }, [picksQuery.data, picks]);

  // product search to add picks
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const found = useQuery({
    queryKey: ["products", { q: term, limit: 8, state: "live" }],
    queryFn: () => adminApi.products({ q: term, limit: 8, state: "live" }),
    enabled: term.length >= 2,
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setFilter = (k, v) => setForm((f) => ({ ...f, filters: { ...f.filters, [k]: v } }));
  const picksChanged = picks && picksQuery.data && picks.map((p) => p.id).join() !== picksQuery.data.map((p) => p.id).join();

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        title: form.title,
        subtitle: form.subtitle,
        isVisible: form.isVisible,
        limit: Number(form.limit),
        startsAt: startOf(form.startDay),
        endsAt: endOf(form.endDay),
      };
      if (custom) {
        body.autoFill = form.autoFill;
        body.filters = form.filters;
      }
      await adminApi.updateHomeSection(id, body);
      if (picksChanged) await adminApi.setHomeSectionPicks(id, picks.map((p) => p.id));
    },
    onSuccess: async () => {
      await Promise.all(
        [["home-sections"], ["home-section-picks", id], ["home-section-preview", id], ["products"]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      );
      setPicks(null);
      setForm(null);
      toast.success("Saved. The home page shows it within a few minutes.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => adminApi.deleteHomeSection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-sections"] });
      toast.success("Section deleted");
      navigate("/homepage");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const bySlug = useMemo(() => bySlugOf(categories || []), [categories]);

  if (sections.isLoading) return <Spinner />;
  if (sections.error) return <ErrorBox error={errorMessage(sections.error)} retry={sections.refetch} />;
  if (!section) return <ErrorBox error="This section doesn't exist (any more)." />;
  if (!form || !picks) return <Spinner />;

  const picked = new Set(picks.map((p) => p.id));
  const movePick = (i, step) =>
    setPicks((list) => {
      const next = [...list];
      [next[i], next[i + step]] = [next[i + step], next[i]];
      return next;
    });
  const pickNoun = section.rule === "ready-stock" ? "ready stock products" : "picked products";

  return (
    <>
      <Link to="/homepage" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy">
        <ArrowLeft className="size-4" /> Home page sections
      </Link>
      <PageHeader
        title={section.title}
        subtitle={RULE_TEXT[section.rule]}
        actions={
          <>
            {custom && (
              <Button variant="danger" loading={remove.isPending} onClick={() => confirm(`Delete "${section.title}"?`) && remove.mutate()}>
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
            <Button loading={save.isPending} disabled={form.title.trim().length < 2} onClick={() => save.mutate()}>
              Save changes
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* ------------------------------------------------ picks */}
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-navy">
              {section.rule === "ready-stock" ? "Ready stock products" : "Your picks"} ({picks.length})
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              {section.rule === "ready-stock"
                ? "Products in our store, ready to deliver fastest. You can also mark them on a product's page, or many at once from Products (filter, then “Mark ready stock”)."
                : `Shown first, in this order${section.picksAreTicks ? " (the same as ticking the product's “" + section.title + "” box)" : ""}. The rest of the row fills up by its rule.`}
            </p>

            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
              <input className="input !pl-9" placeholder="Find a product to add (name, SKU or brand)" value={q} onChange={(e) => setQ(e.target.value)} />
              {term.length >= 2 && (
                <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                  {found.isLoading ? (
                    <p className="p-3 text-sm text-slate-500">Searching…</p>
                  ) : !found.data?.products.length ? (
                    <p className="p-3 text-sm text-slate-500">No product on the website matches “{term}”.</p>
                  ) : (
                    found.data.products.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={picked.has(p.id)}
                        onClick={() => {
                          setPicks((list) => [...list, { id: p.id, name: p.name, brand: p.brand, thumbnail: p.thumbnail, sellingPrice: p.sellingPrice, live: p.live }]);
                          setQ("");
                        }}
                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Thumb src={p.thumbnail} />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className="text-xs text-slate-500">{p.sellingPrice ? money(p.sellingPrice) : "On request"}</span>
                        {picked.has(p.id) ? <Badge tone="green">Added</Badge> : <Plus className="size-4 text-brand" />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {picks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                No {pickNoun} yet{section.rule === "ready-stock" ? ": this row stays off the home page until there are some." : ". The row fills by its rule alone."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {picks.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 p-2 text-sm">
                    <span className="w-5 text-right text-xs tabular-nums text-slate-400">{i + 1}</span>
                    <Thumb src={p.thumbnail} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-navy">{p.name}</span>
                      <span className="text-xs text-slate-500">
                        {p.brand} · {p.sellingPrice ? money(p.sellingPrice) : "Price on request"}
                        {!p.live && <span className="text-amber-700"> · hidden from the website, not shown</span>}
                      </span>
                    </span>
                    <button className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-20" disabled={i === 0} onClick={() => movePick(i, -1)} title="Move up">
                      <ArrowUp className="size-4" />
                    </button>
                    <button className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-20" disabled={i === picks.length - 1} onClick={() => movePick(i, 1)} title="Move down">
                      <ArrowDown className="size-4" />
                    </button>
                    <button className="rounded p-1 text-red-500 hover:bg-red-50" onClick={() => setPicks((list) => list.filter((x) => x.id !== p.id))} title="Remove">
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {picksChanged && <p className="mt-2 text-xs text-amber-700">Not saved yet: click “Save changes”.</p>}
          </Card>

          {/* ------------------------------------------------ preview */}
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-navy">What the row shows now</h2>
            <p className="mb-3 text-xs text-slate-500">
              As saved, on its own. On the home page, products already in a row above are skipped (except your picks).
            </p>
            {preview.isLoading ? (
              <Spinner />
            ) : !preview.data?.length ? (
              <p className="text-sm text-slate-500">Nothing to show: this row is left off the home page.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {preview.data.map((p) => (
                  <div key={p.id} className="rounded-lg border border-slate-100 p-2 text-xs">
                    {p.thumbnail ? <img src={p.thumbnail} alt="" className="mb-2 aspect-square w-full object-contain" /> : <div className="mb-2 aspect-square rounded bg-slate-100" />}
                    <p className="line-clamp-2 font-medium text-navy">{p.name}</p>
                    <p className="mt-1 text-slate-500">{p.sellingPrice ? money(p.sellingPrice) : "Price on request"}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.picked ? <Badge tone="blue">Your pick</Badge> : <Badge tone="gray">By rule</Badge>}
                      {p.readyStock && <Badge tone="green">Ready stock</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {/* ------------------------------------------------ settings */}
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-navy">Show on home page</p>
                <p className="text-xs text-slate-500">{form.isVisible ? "Shown (between its dates, if set)" : "Hidden"}</p>
              </div>
              <Toggle checked={form.isVisible} label="Show on home page" onChange={(v) => set("isVisible", v)} />
            </div>
            <Field label="Title">
              <input className="input" maxLength={80} value={form.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Subtitle">
              <input className="input" maxLength={160} value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
            </Field>
            <Field label="Products in the row">
              <select className="input" value={form.limit} onChange={(e) => set("limit", e.target.value)}>
                {[4, 8, 12, 16].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </Field>
            <div>
              <span className="label">Dates (optional)</span>
              <div className="flex items-center gap-2">
                <input type="date" className="input" value={form.startDay} onChange={(e) => set("startDay", e.target.value)} aria-label="First day" />
                <span className="text-slate-400">–</span>
                <input type="date" className="input" value={form.endDay} onChange={(e) => set("endDay", e.target.value)} aria-label="Last day" />
              </div>
              <span className="mt-1 block text-xs text-slate-400">
                For seasons and offers: shown only from the first to the last day. Leave empty to always show.
              </span>
            </div>
          </Card>

          {/* ------------------------------------------------ fill rule (custom rows) */}
          {custom && (
            <Card className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-navy">Fill up automatically</p>
                  <p className="text-xs text-slate-500">{form.autoFill ? "After your picks, with products matching:" : "Only your picks"}</p>
                </div>
                <Toggle checked={form.autoFill} label="Fill up automatically" onChange={(v) => set("autoFill", v)} />
              </div>
              {form.autoFill && (
                <>
                  <Field label="Category">
                    <select className="input" value={form.filters.categorySlug} onChange={(e) => setFilter("categorySlug", e.target.value)}>
                      <option value="">Any category</option>
                      {(categories || []).map((c) => (
                        <option key={c.slug} value={c.slug}>{categoryLabel(c, bySlug)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Brands" hint="None ticked = any brand">
                    <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                      {(brands || [])
                        .filter((b) => b.totalProducts > 0 || form.filters.brandSlugs.includes(b.slug))
                        .map((b) => (
                          <label key={b.slug} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={form.filters.brandSlugs.includes(b.slug)}
                              onChange={(e) =>
                                setFilter(
                                  "brandSlugs",
                                  e.target.checked ? [...form.filters.brandSlugs, b.slug] : form.filters.brandSlugs.filter((s) => s !== b.slug)
                                )
                              }
                            />
                            {b.name}
                          </label>
                        ))}
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Min price (₹)">
                      <input className="input" type="number" min="0" value={form.filters.minPrice} onChange={(e) => setFilter("minPrice", e.target.value)} />
                    </Field>
                    <Field label="Max price (₹)">
                      <input className="input" type="number" min="0" value={form.filters.maxPrice} onChange={(e) => setFilter("maxPrice", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Min discount (%)">
                    <input className="input" type="number" min="0" max="100" value={form.filters.minDiscount} onChange={(e) => setFilter("minDiscount", e.target.value)} />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.filters.readyStockOnly} onChange={(e) => setFilter("readyStockOnly", e.target.checked)} />
                    Only ready stock (in our store)
                  </label>
                  <Field label="Order">
                    <select className="input" value={form.filters.sort} onChange={(e) => setFilter("sort", e.target.value)}>
                      {Object.entries(SORTS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
