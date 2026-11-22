import { Field } from "./ui";

/** SKU, description and feature lines of a product added by hand. */
export default function ProductTextFields({ form, set }) {
  return (
    <>
      <Field label="SKU / model number" hint="Optional. Shown on the product page and searchable.">
        <input className="input" value={form.sku} maxLength={60} onChange={(e) => set("sku", e.target.value)} />
      </Field>
      <Field label="Description">
        <textarea className="input min-h-28" value={form.descriptionText} maxLength={5000} onChange={(e) => set("descriptionText", e.target.value)} />
      </Field>
      <Field
        label="Features & specifications"
        hint={
          <>
            One per line. Write "Name: value" for specifications, e.g. <i>Motor: 2 HP</i>, <i>Warranty: 1 year</i>, <i>Weight: 25 kg</i>,{" "}
            <i>Dimensions: 120 x 60 cm</i>, <i>Max User Weight: 110 kg</i>.
          </>
        }
      >
        <textarea
          className="input min-h-32 font-mono text-xs"
          value={form.features}
          onChange={(e) => set("features", e.target.value)}
          placeholder={"Motor: 2 HP\nFoldable design\nWarranty: 1 year"}
        />
      </Field>
    </>
  );
}
