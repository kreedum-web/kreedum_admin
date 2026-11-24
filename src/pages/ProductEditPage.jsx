import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, ImagePlus, Lock, RotateCcw, Star, Trash2 } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import CategorySelect from "../components/CategorySelect";
import ProductTextFields from "../components/ProductTextFields";
import { date, fileToDataUrl, money, STOCK, STORE_URL } from "../lib/format";
import { Button, Card, ErrorBox, Field, PageHeader, Spinner, Toggle } from "../components/ui";

const FLAGS = [
  ["isFeatured", "Featured"],
  ["isBestSeller", "Best seller"],
  ["isNewArrival", "New arrival"],
  ["isTrending", "Trending"],
  ["readyStock", "Ready stock (in our store)"],
];

function formFrom(p) {
  return {
    name: p.name,
    sellingPrice: p.sellingPrice,
    mrp: p.mrp,
    stockStatus: p.stockStatus,
    availabilityMessage: p.availabilityMessage || "",
    live: p.live,
    badge: p.badge || "",
    ...Object.fromEntries(FLAGS.map(([k]) => [k, Boolean(p[k])])),
    variants: (p.variants || []).map((v) => ({ variantId: v.variantId, label: v.label, sellingPrice: v.sellingPrice, mrp: v.mrp, inStock: v.inStock !== false })),
    images: p.images || [],
    brand: p.brand || "",
    categorySlug: (p.categoryPath || []).at(-1) || "",
    // Products added here: their text can be edited too.
    ...(p.manual ? { sku: p.sku || "", descriptionText: p.descriptionText || "", features: (p.features || []).join("\n") } : {}),
  };
}

// Hidden by a brand / category switch: switching the product on here isn't enough.
const HIDDEN_BECAUSE = {
  "admin-category": "Hidden because its category (or one above it) is hidden. Show the category under Categories, or move the product to another category.",
  "admin-brand": "Hidden because its brand is switched off under Brands.",
  "brand-rule": "Hidden because its brand is on the not-sold list.",
};

export default function ProductEditPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInput = useRef(null);
  const { data: product, isLoading, error, refetch } = useQuery({ queryKey: ["product", id], queryFn: () => adminApi.product(id) });
  const [form, setForm] = useState(null);
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => adminApi.categories() });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => adminApi.brands() });

  useEffect(() => {
    if (product) setForm(formFrom(product));
  }, [product]);

  const done = (message) => (p) => {
    queryClient.setQueryData(["product", id], p);
    queryClient.invalidateQueries({ queryKey: ["products"] });
    toast.success(message);
  };

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form };
      const before = formFrom(product);
      // Brand and category are only sent when changed, so saving a price doesn't lock them.
      if (!body.brand.trim() || body.brand.trim() === before.brand) delete body.brand;
      if (!body.categorySlug || body.categorySlug === before.categorySlug) delete body.categorySlug;
      if (product.variants?.length) {
        delete body.sellingPrice; // set from the options
        delete body.mrp;
      } else {
        delete body.variants;
      }
      return adminApi.updateProduct(id, body);
    },
    onSuccess: (p) => {
      if (form.live && !p.live && HIDDEN_BECAUSE[p.hiddenBy]) {
        done("Saved, but it stays hidden")(p);
        toast(HIDDEN_BECAUSE[p.hiddenBy], { icon: "⚠️", duration: 8000 });
      } else {
        done("Saved. The website shows it within a few minutes.")(p);
      }
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const addImage = useMutation({
    mutationFn: async (file) => adminApi.addProductImage(id, { data: await fileToDataUrl(file) }),
    onSuccess: done("Photo added"),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: () => adminApi.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Product deleted");
      navigate("/products");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const reset = useMutation({
    mutationFn: () => adminApi.resetProduct(id),
    onSuccess: done("Your changes will be replaced by the supplier's values at the next catalogue sync."),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading || (product && !form)) return <Spinner />;
  if (error) return <ErrorBox error={errorMessage(error)} retry={refetch} />;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setVariant = (i, k, v) => setForm((f) => ({ ...f, variants: f.variants.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
  const moveImage = (i, by) =>
    setForm((f) => {
      const images = [...f.images];
      const [img] = images.splice(i, 1);
      images.splice(Math.max(0, Math.min(images.length, i + by)), 0, img);
      return { ...f, images };
    });
  const removeImage = (i) => setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }));
  const discount = form.mrp > form.sellingPrice && form.sellingPrice > 0 ? Math.round(((form.mrp - form.sellingPrice) / form.mrp) * 100) : 0;

  return (
    <>
      <Link to="/products" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy">
        <ArrowLeft className="size-4" /> Products
      </Link>
      <PageHeader
        title={product.name}
        subtitle={`${product.brand} · ${product.categoryPath.join(" › ").replace(/-/g, " ")} · updated ${date(product.updatedAt)}`}
        actions={
          <>
            <a href={`${STORE_URL}/products/${product.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              View on store <ExternalLink className="size-4" />
            </a>
            {product.manual && (
              <Button variant="danger" loading={remove.isPending} onClick={() => confirm(`Delete "${product.name}" for good?`) && remove.mutate()}>
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
            <Button loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>
          </>
        }
      />

      {product.adminLocked.length > 0 && (
        <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span className="flex items-center gap-2">
            <Lock className="size-4" /> Changed by hand ({product.adminLocked.join(", ")}). These stay as you set them when the catalogue syncs from the suppliers.
          </span>
          <Button variant="secondary" loading={reset.isPending} onClick={() => confirm("Go back to the supplier's values at the next catalogue sync?") && reset.mutate()}>
            <RotateCcw className="size-4" /> Use the supplier's values again
          </Button>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="space-y-4 p-4">
            <Field label="Product name">
              <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            {form.variants.length === 0 ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Selling price (₹)">
                  <input className="input" type="number" min="0" value={form.sellingPrice} onChange={(e) => set("sellingPrice", e.target.value === "" ? "" : Number(e.target.value))} />
                </Field>
                <Field label="MRP (₹)" hint="Shown crossed out">
                  <input className="input" type="number" min="0" value={form.mrp} onChange={(e) => set("mrp", e.target.value === "" ? "" : Number(e.target.value))} />
                </Field>
                <div className="pt-6 text-sm text-slate-600">{discount ? `${discount}% off` : "No discount shown"}</div>
              </div>
            ) : (
              <div>
                <p className="label">Options and prices</p>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Option</th>
                        <th className="px-3 py-2 text-left font-medium">Price (₹)</th>
                        <th className="px-3 py-2 text-left font-medium">MRP (₹)</th>
                        <th className="px-3 py-2 text-left font-medium">In stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {form.variants.map((v, i) => (
                        <tr key={v.variantId}>
                          <td className="px-3 py-2">{v.label}</td>
                          <td className="px-3 py-2"><input className="input !w-28" type="number" min="0" value={v.sellingPrice} onChange={(e) => setVariant(i, "sellingPrice", Number(e.target.value))} /></td>
                          <td className="px-3 py-2"><input className="input !w-28" type="number" min="0" value={v.mrp} onChange={(e) => setVariant(i, "mrp", Number(e.target.value))} /></td>
                          <td className="px-3 py-2"><Toggle checked={v.inStock} label={`${v.label} in stock`} onChange={(x) => setVariant(i, "inStock", x)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-xs text-slate-400">The product shows "from {money(Math.min(...form.variants.map((v) => v.sellingPrice)))}" on the store.</p>
              </div>
            )}
          </Card>

          {product.manual && (
            <Card className="space-y-4 p-4">
              <ProductTextFields form={form} set={set} />
            </Card>
          )}

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-navy">Photos</h2>
              <Button variant="secondary" loading={addImage.isPending} onClick={() => fileInput.current?.click()}>
                <ImagePlus className="size-4" /> Add photo
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) addImage.mutate(file);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {form.images.map((url, i) => (
                <div key={`${i}-${url}`} className="group relative rounded-lg border border-slate-200 p-1">
                  <img src={url} alt="" className="aspect-square w-full rounded object-contain" />
                  {i === 0 && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded bg-navy px-1.5 py-0.5 text-[10px] font-medium text-white">
                      <Star className="size-3" /> Main
                    </span>
                  )}
                  <div className="mt-1 flex justify-center gap-1">
                    <button className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" disabled={i === 0} onClick={() => moveImage(i, -1)} aria-label="Move earlier"><ArrowUp className="size-4" /></button>
                    <button className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" disabled={i === form.images.length - 1} onClick={() => moveImage(i, 1)} aria-label="Move later"><ArrowDown className="size-4" /></button>
                    <button className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-30" disabled={form.images.length === 1} onClick={() => removeImage(i)} aria-label="Remove photo"><Trash2 className="size-4" /></button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">The first photo is the main one. Reordering or removing photos takes effect when you press Save changes.</p>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-navy">Show on website</p>
                <p className="text-xs text-slate-500">{form.live ? "Customers can see and buy it" : "Hidden from customers"}</p>
                {!product.live && HIDDEN_BECAUSE[product.hiddenBy] && (
                  <p className="mt-1 text-xs text-amber-700">{HIDDEN_BECAUSE[product.hiddenBy]}</p>
                )}
              </div>
              <Toggle checked={form.live} label="Show on website" onChange={(v) => set("live", v)} />
            </div>
            <Field label="Stock">
              <select className="input" value={form.stockStatus} onChange={(e) => set("stockStatus", e.target.value)}>
                {Object.entries(STOCK).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Availability message" hint="Shown on the product page">
              <input className="input" value={form.availabilityMessage} onChange={(e) => set("availabilityMessage", e.target.value)} maxLength={200} />
            </Field>
          </Card>
          <Card className="space-y-4 p-4">
            <h2 className="text-sm font-semibold text-navy">Brand & category</h2>
            <Field label="Brand" hint="Pick an existing brand or type a new one.">
              <input className="input" list="brand-names" value={form.brand} maxLength={60} onChange={(e) => set("brand", e.target.value)} />
              <datalist id="brand-names">
                {(brands || []).map((b) => (
                  <option key={b.slug} value={b.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Category" hint={<>Missing one? <Link to="/categories" className="text-brand hover:underline">Create it under Categories</Link>.</>}>
              <CategorySelect categories={categories} value={form.categorySlug} onChange={(v) => set("categorySlug", v)} />
            </Field>
          </Card>
          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-navy">Home page rows</h2>
            <p className="-mt-2 text-xs text-slate-400">
              Ticked products come first in that row. Ready stock = in our store, fastest delivery.{" "}
              <Link to="/homepage" className="text-brand hover:underline">Set up the rows</Link>
            </p>
            {FLAGS.map(([k, l]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                {l}
                <Toggle checked={form[k]} label={l} onChange={(v) => set(k, v)} />
              </div>
            ))}
            <Field label="Badge on the product card">
              <select className="input" value={form.badge} onChange={(e) => set("badge", e.target.value)}>
                {["", "Best Seller", "New Arrival", "Trending", "Hot Deal"].map((b) => (
                  <option key={b} value={b}>{b || "None"}</option>
                ))}
              </select>
            </Field>
          </Card>
          {product.sourceUrl && (
            <a href={product.sourceUrl} target="_blank" rel="noreferrer" className="block text-xs text-slate-400 hover:text-brand">
              Supplier page ↗
            </a>
          )}
        </div>
      </div>
    </>
  );
}

