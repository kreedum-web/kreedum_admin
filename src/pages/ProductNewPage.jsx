import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft, ImagePlus, Star, Trash2 } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { fileToDataUrl, STOCK } from "../lib/format";
import { Button, Card, Field, PageHeader, Toggle } from "../components/ui";
import CategorySelect from "../components/CategorySelect";
import ProductTextFields from "../components/ProductTextFields";

const EMPTY = {
  name: "",
  brand: "",
  categorySlug: "",
  sellingPrice: "",
  mrp: "",
  stockStatus: "in_stock",
  availabilityMessage: "",
  sku: "",
  descriptionText: "",
  features: "",
  live: true,
};

/**
 * Add a product by hand (one no supplier has). The catalogue sync never
 * changes or hides it. Leave the price empty for "Price on enquiry".
 */
export default function ProductNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInput = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [photos, setPhotos] = useState([]); // [{ file, preview }]
  const [progress, setProgress] = useState("");
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: adminApi.categories });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: adminApi.brands });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Free the photo previews when leaving the page.
  const previews = useRef([]);
  previews.current = photos.map((p) => p.preview);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const noPrice = !(Number(form.sellingPrice) > 0);
  const missing = [
    form.name.trim().length < 3 && "a name",
    form.brand.trim().length < 2 && "a brand",
    !form.categorySlug && "a category",
  ].filter(Boolean);

  const create = useMutation({
    mutationFn: async () => {
      setProgress("Saving the product…");
      const product = await adminApi.createProduct({ ...form, stockStatus: noPrice ? "enquiry_only" : form.stockStatus });
      // Photos one by one (each up to 8 MB); the first one is the main photo.
      const failed = [];
      for (const [i, photo] of photos.entries()) {
        setProgress(`Uploading photo ${i + 1} of ${photos.length}…`);
        try {
          await adminApi.addProductImage(product.id, { data: await fileToDataUrl(photo.file) });
        } catch (e) {
          failed.push(`${photo.file.name}: ${errorMessage(e)}`);
        }
      }
      return { product, failed };
    },
    onSuccess: ({ product, failed }) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      if (failed.length) toast.error(`Product saved, but ${failed.length} photo(s) didn't upload. Add them again here.\n${failed[0]}`, { duration: 8000 });
      else toast.success(product.live ? "Product added. The website shows it within a few minutes." : "Product added (hidden from the website).");
      navigate(`/products/${product.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => setProgress(""),
  });

  const addFiles = (files) =>
    setPhotos((list) => [
      ...list,
      ...[...files].filter((f) => f.type.startsWith("image/")).map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
  const removePhoto = (i) =>
    setPhotos((list) => {
      URL.revokeObjectURL(list[i].preview);
      return list.filter((_, j) => j !== i);
    });
  const makeMain = (i) => setPhotos((list) => [list[i], ...list.filter((_, j) => j !== i)]);

  const discount =
    Number(form.mrp) > Number(form.sellingPrice) && Number(form.sellingPrice) > 0
      ? Math.round(((form.mrp - form.sellingPrice) / form.mrp) * 100)
      : 0;

  return (
    <>
      <Link to="/products" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy">
        <ArrowLeft className="size-4" /> Products
      </Link>
      <PageHeader
        title="New product"
        subtitle="For products no supplier lists. The catalogue sync never changes or hides products added here."
        actions={
          <Button loading={create.isPending} disabled={missing.length > 0} onClick={() => create.mutate()}>
            Add product
          </Button>
        }
      />
      {progress && <p className="mb-3 text-sm text-slate-500">{progress}</p>}
      {missing.length > 0 && <p className="mb-3 text-sm text-slate-500">To add it, fill in {missing.join(", ")}.</p>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="space-y-4 p-4">
            <Field label="Product name">
              <input className="input" autoFocus value={form.name} maxLength={200} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Selling price (₹)" hint="Leave empty for “Price on enquiry”">
                <input className="input" type="number" min="0" value={form.sellingPrice} onChange={(e) => set("sellingPrice", e.target.value)} />
              </Field>
              <Field label="MRP (₹)" hint="Shown crossed out">
                <input className="input" type="number" min="0" value={form.mrp} disabled={noPrice} onChange={(e) => set("mrp", e.target.value)} />
              </Field>
              <div className="pt-6 text-sm text-slate-600">
                {noPrice ? "Customers will see “Price on enquiry” and an Enquire button" : discount ? `${discount}% off` : "No discount shown"}
              </div>
            </div>
            <ProductTextFields form={form} set={set} />
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-navy">Photos</h2>
              <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                <ImagePlus className="size-4" /> Add photos
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files || []);
                  e.target.value = "";
                }}
              />
            </div>
            {photos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No photos yet. You can add several at once (JPG, PNG or WebP, up to 8 MB each).
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {photos.map((photo, i) => (
                  <div key={photo.preview} className="relative rounded-lg border border-slate-200 p-1">
                    <img src={photo.preview} alt="" className="aspect-square w-full rounded object-contain" />
                    {i === 0 && <span className="absolute left-2 top-2 rounded bg-navy px-1.5 py-0.5 text-[10px] font-medium text-white">Main</span>}
                    <div className="mt-1 flex justify-center gap-1">
                      {i > 0 && (
                        <button className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Make main photo" onClick={() => makeMain(i)}>
                          <Star className="size-4" />
                        </button>
                      )}
                      <button className="rounded p-1 text-red-500 hover:bg-red-50" title="Remove" onClick={() => removePhoto(i)}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-navy">Show on website</p>
                <p className="text-xs text-slate-500">{form.live ? "Customers can see it once added" : "Hidden until you switch it on"}</p>
              </div>
              <Toggle checked={form.live} label="Show on website" onChange={(v) => set("live", v)} />
            </div>
            <Field label="Stock">
              <select className="input" value={noPrice ? "enquiry_only" : form.stockStatus} disabled={noPrice} onChange={(e) => set("stockStatus", e.target.value)}>
                {Object.entries(STOCK).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Availability message" hint="Optional. Shown on the product page">
              <input className="input" value={form.availabilityMessage} maxLength={200} onChange={(e) => set("availabilityMessage", e.target.value)} />
            </Field>
          </Card>

          <Card className="space-y-4 p-4">
            <h2 className="text-sm font-semibold text-navy">Brand & category</h2>
            <Field label="Brand" hint="Pick an existing brand or type a new one.">
              <input className="input" list="new-brand-names" value={form.brand} maxLength={60} onChange={(e) => set("brand", e.target.value)} />
              <datalist id="new-brand-names">
                {(brands || []).map((b) => (
                  <option key={b.slug} value={b.name} />
                ))}
              </datalist>
            </Field>
            <Field
              label="Category"
              hint={
                <>
                  Missing one?{" "}
                  <Link to="/categories" className="text-brand hover:underline">
                    Create it under Categories
                  </Link>{" "}
                  first.
                </>
              }
            >
              <CategorySelect categories={categories} value={form.categorySlug} onChange={(v) => set("categorySlug", v)} />
            </Field>
          </Card>
        </div>
      </div>
    </>
  );
}
