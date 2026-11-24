import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Lock, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { bySlugOf, categoryLabel } from "../lib/categories";
import { Badge, Button, Card, Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Table, Toggle } from "../components/ui";

/**
 * Categories: create new ones (top level or inside a category, up to 3 levels),
 * rename, reorder, show / hide. Changes are kept when the catalogue syncs from
 * the suppliers. Categories made here can be deleted once they're empty;
 * the suppliers' categories can only be hidden.
 */
export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const [creating, setCreating] = useState(null); // { name, parentSlug, displayOrder }
  const [editing, setEditing] = useState(null); // { slug, name, displayOrder }
  // Counts follow the brand / department filters. keepPreviousData: the page
  // stays on screen (no spinner) while the new counts load.
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["categories", brandFilter, departmentFilter],
    queryFn: () => adminApi.categories({ brand: brandFilter, department: departmentFilter }),
    placeholderData: keepPreviousData,
  });
  const { data: brandsData = [], isLoading: brandsLoading } = useQuery({ queryKey: ["brands"], queryFn: () => adminApi.brands() });
  const categories = useMemo(() => data || [], [data]);
  const bySlug = useMemo(() => bySlugOf(categories), [categories]);

  const refresh = (message) => () => {
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    toast.success(message);
  };
  const onError = (e) => toast.error(errorMessage(e));

  const create = useMutation({
    mutationFn: (body) => adminApi.createCategory(body),
    onSuccess: (c) => {
      setCreating(null);
      refresh(`"${c.name}" created. Open a product to move it in.`)();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ slug, body }) => adminApi.updateCategory(slug, body),
    onSuccess: (c, { body }) => {
      setEditing(null);
      if (body.isActive !== undefined) {
        // Its products were hidden / shown too.
        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.invalidateQueries({ queryKey: ["brands"] });
      }
      const products = (n) => `${n} product${n === 1 ? "" : "s"}`;
      refresh(
        body.isActive === false
          ? `"${c.name}" is hidden${c.productsHidden ? `, with ${products(c.productsHidden)}` : ""}`
          : body.isActive
            ? `"${c.name}" is back on the website${c.productsShown ? `, with ${products(c.productsShown)}` : ""}`
            : "Saved"
      )();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (slug) => adminApi.deleteCategory(slug),
    onSuccess: refresh("Category deleted"),
    onError,
  });
  const reset = useMutation({
    mutationFn: (slug) => adminApi.resetCategory(slug),
    onSuccess: refresh("Your changes will be replaced by the supplier's at the next catalogue sync"),
    onError,
  });

  const setShown = (c, show) => {
    if (!show && c.liveProducts > 0) {
      const ok = confirm(
        `Hide "${c.name}"? Its ${c.liveProducts} product${c.liveProducts === 1 ? "" : "s"} on the website (sub-categories included) will be hidden too.` +
          (brandFilter || departmentFilter ? " (That number is for the current filter; other products in it are hidden as well.)" : "") +
          "\n\nShowing it again brings them back, except products you switched off yourself."
      );
      if (!ok) return;
    }
    update.mutate({ slug: c.slug, body: { isActive: show } });
  };

  const parents = categories.filter((c) => c.level < 3);
  // Brand filter: only categories with that brand's products; department filter: that department.
  const filteredCategories = useMemo(
    () =>
      categories.filter(
        (c) => (!departmentFilter || c.path?.[0] === departmentFilter) && (!brandFilter || c.totalProducts > 0)
      ),
    [categories, departmentFilter, brandFilter]
  );

  const text = q.trim().toLowerCase();
  const childrenByParent = useMemo(() => {
    const map = new Map();
    for (const c of filteredCategories) {
      const parentSlug = c.path?.length > 1 ? c.path[c.path.length - 2] : null;
      if (parentSlug) map.set(parentSlug, [...(map.get(parentSlug) || []), c]);
    }
    return map;
  }, [filteredCategories]);

  const visibleRows = useMemo(() => {
    // Searching: a flat list of matches (within the filters), with full paths.
    if (text) {
      return filteredCategories
        .filter((c) => categoryLabel(c, bySlug).toLowerCase().includes(text))
        .map((c) => ({ category: c, depth: 0, showPath: true }));
    }
    const result = [];
    const visit = (parentSlug, depth) => {
      const items = parentSlug ? childrenByParent.get(parentSlug) || [] : filteredCategories.filter((c) => c.level === 1);
      for (const category of items) {
        result.push({ category, depth, showPath: false });
        if (expanded.has(category.slug)) visit(category.slug, depth + 1);
      }
    };
    visit(null, 0);
    return result;
  }, [text, bySlug, filteredCategories, childrenByParent, expanded]);

  if (isLoading && !data) return <Spinner />;
  if (error) return <ErrorBox error={errorMessage(error)} retry={refetch} />;

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Create, rename, reorder or hide categories. Your changes are kept when the catalogue syncs from the suppliers."
        actions={
          <Button onClick={() => setCreating({ name: "", parentSlug: "", displayOrder: "" })}>
            <Plus className="size-4" /> New category
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
  <div className="relative w-full sm:max-w-sm">
    <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />

    <input
      className="input !pl-9"
      placeholder="Find a category"
      value={q}
      onChange={(e) => setQ(e.target.value)}
    />
  </div>

  <select
    className="input w-full sm:max-w-xs"
    value={brandFilter}
    disabled={brandsLoading}
    onChange={(e) => {
      setBrandFilter(e.target.value);
      setExpanded(new Set());
    }}
  >
    <option value="">All brands</option>

    {brandsData.map((brand) => (
      <option key={brand.slug} value={brand.slug}>
        {brand.name}
      </option>
    ))}
  </select>

  <select
    className="input w-full sm:max-w-xs"
    value={departmentFilter}
    onChange={(e) => {
      setDepartmentFilter(e.target.value);
      setExpanded(new Set());
    }}
  >
    <option value="">All departments</option>

    {categories
      .filter((c) => c.level === 1)
      .map((department) => (
        <option
          key={department.slug}
          value={department.slug}
        >
          {department.name}
        </option>
      ))}
  </select>

  {(brandFilter || departmentFilter || q) && (
    <button
      type="button"
      className="text-sm font-medium text-slate-500 hover:text-navy"
      onClick={() => {
        setBrandFilter("");
        setDepartmentFilter("");
        setQ("");
        setExpanded(new Set());
      }}
    >
      Clear filters
    </button>
  )}
</div>
      <Card>
        {visibleRows.length === 0 ? (
          <Empty title="No categories found" />
        ) : (
          <Table head={["Category", { label: "Products on website", right: true }, "Order", "On website", ""]}>
            {visibleRows.map(({ category: c, depth, showPath }) => {
              const hasChildren = (childrenByParent.get(c.slug) || []).length > 0;
              return (
              <tr key={c.slug} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <div className="flex flex-wrap items-center gap-2" style={{ paddingLeft: `${depth * 24}px` }}>
                    {hasChildren && !showPath ? (
                      <button
                        type="button"
                        className="rounded p-1 text-slate-500 hover:bg-slate-100"
                        aria-label={`${expanded.has(c.slug) ? "Collapse" : "Expand"} ${c.name}`}
                        aria-expanded={expanded.has(c.slug)}
                        onClick={() => setExpanded((current) => {
                          const next = new Set(current);
                          if (next.has(c.slug)) next.delete(c.slug);
                          else next.add(c.slug);
                          return next;
                        })}
                      >
                        {expanded.has(c.slug) ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </button>
                    ) : <span className="w-6" />}
                    <span className={clsx(c.level === 1 ? "font-semibold text-navy" : "text-slate-800")}>
                      {showPath ? categoryLabel(c, bySlug) : c.name}
                    </span>
                    {hasChildren && !showPath && <span className="text-xs text-slate-400">{childrenByParent.get(c.slug).length}</span>}
                    {c.fromAdmin && <Badge tone="blue">Made here</Badge>}
                    {!c.fromAdmin && c.adminLocked.length > 0 && (
                      <Badge tone="amber">
                        <Lock className="size-3" /> Changed
                      </Badge>
                    )}
                    {!c.isActive && <Badge tone="gray">Hidden</Badge>}
                    {c.isActive && c.hiddenByParent && (
                      <span title="A category above it is hidden, so this one and its products are off the website too">
                        <Badge tone="gray">Hidden (above)</Badge>
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <Link to={`/products?category=${c.slug}${brandFilter ? `&brand=${brandFilter}` : ""}`} className="hover:text-brand hover:underline" title="All products, including hidden ones">
                    {c.liveProducts}
                    {c.totalProducts !== c.liveProducts && <span className="text-slate-400"> / {c.totalProducts}</span>}
                  </Link>
                </td>
                <td className="px-4 py-2 tabular-nums text-slate-500">{c.displayOrder}</td>
                <td className="px-4 py-2">
                  <Toggle
                    checked={c.isActive}
                    label={`Show ${c.name} on the website`}
                    disabled={update.isPending}
                    onChange={(v) => setShown(c, v)}
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                      title="Rename / reorder"
                      onClick={() => setEditing({ slug: c.slug, name: c.name, displayOrder: c.displayOrder })}
                    >
                      <Pencil className="size-4" />
                    </button>
                    {c.level < 3 && (
                      <button
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                        title={`New category inside ${c.name}`}
                        onClick={() => setCreating({ name: "", parentSlug: c.slug, displayOrder: "" })}
                      >
                        <Plus className="size-4" />
                      </button>
                    )}
                    {!c.fromAdmin && c.adminLocked.length > 0 && (
                      <button
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                        title="Use the supplier's name / order again"
                        onClick={() => confirm(`Go back to the supplier's values for "${c.name}" at the next catalogue sync?`) && reset.mutate(c.slug)}
                      >
                        <RotateCcw className="size-4" />
                      </button>
                    )}
                    {c.fromAdmin && (
                      <button
                        className="rounded p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-30"
                        title={c.allProducts ? "Move its products to another category first" : "Delete"}
                        disabled={c.allProducts > 0 || remove.isPending}
                        onClick={() => confirm(`Delete "${c.name}"?`) && remove.mutate(c.slug)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </Table>
        )}
      </Card>
      <p className="mt-2 text-xs text-slate-400">
        Click the arrow next to a category to open or close its sub-categories. Hiding a category also hides its products and its
        sub-categories' products from the website; they stay here in the admin, and come back when you show it again (except
        products you switched off yourself). To move a product, open it under Products and choose its category.
      </p>

      <Modal
        open={Boolean(creating)}
        title="New category"
        onClose={() => setCreating(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(null)}>Cancel</Button>
            <Button
              loading={create.isPending}
              disabled={!creating?.name?.trim()}
              onClick={() => create.mutate({ ...creating, parentSlug: creating.parentSlug || null })}
            >
              Create
            </Button>
          </>
        }
      >
        {creating && (
          <div className="space-y-4">
            <Field label="Name">
              <input className="input" autoFocus value={creating.name} maxLength={60} onChange={(e) => setCreating({ ...creating, name: e.target.value })} />
            </Field>
            <Field label="Inside" hint="Top level = a new department in the store's menu. Categories go 3 levels deep at most.">
              <select className="input" value={creating.parentSlug} onChange={(e) => setCreating({ ...creating, parentSlug: e.target.value })}>
                <option value="">Top level (new department)</option>
                {parents.map((c) => (
                  <option key={c.slug} value={c.slug}>{categoryLabel(c, bySlug)}</option>
                ))}
              </select>
            </Field>
            <Field label="Order in the menu" hint="Lower numbers come first. Leave empty to put it last.">
              <input className="input" type="number" min="0" value={creating.displayOrder} onChange={(e) => setCreating({ ...creating, displayOrder: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(editing)}
        title="Edit category"
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              loading={update.isPending}
              disabled={!editing?.name?.trim()}
              onClick={() => update.mutate({ slug: editing.slug, body: { name: editing.name, displayOrder: Number(editing.displayOrder) || 0 } })}
            >
              Save
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Name">
              <input className="input" autoFocus value={editing.name} maxLength={60} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Order in the menu" hint="Lower numbers come first.">
              <input className="input" type="number" min="0" value={editing.displayOrder} onChange={(e) => setEditing({ ...editing, displayOrder: e.target.value })} />
            </Field>
            <p className="text-xs text-slate-400">The web address ({editing.slug}) stays the same, so existing links keep working.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
