import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Search, Star, Upload } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { fileToDataUrl } from "../lib/format";
import { Card, Empty, ErrorBox, PageHeader, Spinner, Table, Toggle } from "../components/ui";

export default function BrandsPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const fileInput = useRef(null);
  const [logoFor, setLogoFor] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["brands"], queryFn: () => adminApi.brands() });

  const update = useMutation({
    mutationFn: ({ slug, body }) => adminApi.updateBrand(slug, body),
    onSuccess: (b, { body }) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(body.live === false ? `${b.name} and its products are hidden` : body.live ? `${b.name} is back on the website` : "Saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={errorMessage(error)} retry={refetch} />;

  const brands = data.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="Brands" subtitle="Switching a brand off hides it and all its products. Switching it on brings back the products it hid." />
      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
        <input className="input !pl-9" placeholder="Find a brand" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && logoFor) update.mutate({ slug: logoFor, body: { logo: await fileToDataUrl(file) } });
        }}
      />
      <Card>
        {brands.length === 0 ? (
          <Empty title="No brands found" />
        ) : (
          <Table head={["Brand", { label: "Products on website", right: true }, "Featured", "On website"]}>
            {brands.map((b) => (
              <tr key={b.slug} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setLogoFor(b.slug);
                        fileInput.current?.click();
                      }}
                      className="group relative flex size-11 shrink-0 items-center justify-center rounded border border-slate-200 bg-white"
                      title="Change logo"
                    >
                      {b.logo ? <img src={b.logo} alt="" className="size-10 object-contain" /> : <Upload className="size-4 text-slate-400" />}
                    </button>
                    <div>
                      <Link to={`/products?q=${encodeURIComponent(b.name)}`} className="font-medium text-navy hover:text-brand">
                        {b.name}
                      </Link>
                      {b.adminHidden && <p className="text-xs text-red-600">Hidden by you</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                  {b.liveProducts} <span className="text-slate-400">/ {b.totalProducts}</span>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => update.mutate({ slug: b.slug, body: { featured: !b.featured } })}
                    className={b.featured ? "text-amber-500" : "text-slate-300 hover:text-slate-400"}
                    aria-label={b.featured ? "Featured (click to remove)" : "Mark as featured"}
                  >
                    <Star className="size-5" fill={b.featured ? "currentColor" : "none"} />
                  </button>
                </td>
                <td className="px-4 py-2">
                  <Toggle
                    checked={b.live}
                    label={`Show ${b.name} on website`}
                    disabled={update.isPending && update.variables?.slug === b.slug}
                    onChange={(live) => {
                      if (!live && !confirm(`Hide ${b.name} and all its ${b.liveProducts} products from the website?`)) return;
                      update.mutate({ slug: b.slug, body: { live } });
                    }}
                  />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
