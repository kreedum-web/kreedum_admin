import { bySlugOf, categoryLabel } from "../lib/categories";

/** Every category, shown as its full path ("Cardio › Walking Pads"), in menu order. */
export default function CategorySelect({ categories, value, onChange }) {
  if (!categories) return <select className="input" disabled><option>Loading…</option></select>;
  const bySlug = bySlugOf(categories);
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {!bySlug.has(value) && <option value={value}>{value || "Choose a category"}</option>}
      {categories.map((c) => (
        <option key={c.slug} value={c.slug}>
          {categoryLabel(c, bySlug)}
          {c.isActive ? "" : " (hidden)"}
        </option>
      ))}
    </select>
  );
}
