import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { date, fileToDataUrl } from "../lib/format";
import { Badge, Button, Card, Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Tabs, Toggle } from "../components/ui";

/** Each kind of content: its fields in the edit form and how a row is shown. */
const KINDS = {
  hero: {
    tab: "Home banners",
    one: "banner",
    help: "The big sliding banners at the top of the home page. Use start/end dates for timed offers. Best picture size: 1920 × 700.",
    image: true,
    fields: [
      { key: "title", label: "Heading", required: true, max: 120 },
      { key: "subtitle", label: "Text under the heading", max: 200 },
      { key: "buttonText", label: "Button text", max: 40, placeholder: "Shop now" },
      { key: "buttonLink", label: "Button link", max: 300, placeholder: "/categories/gym-equipment" },
      { key: "startsAt", label: "Show from (optional)", type: "date" },
      { key: "endsAt", label: "Show until (optional)", type: "date" },
    ],
    title: (r) => r.title,
    sub: (r) => [r.subtitle, (r.startsAt || r.endsAt) && `${r.startsAt ? date(r.startsAt) : "now"} → ${r.endsAt ? date(r.endsAt) : "no end"}`].filter(Boolean).join(" · "),
  },
  announcements: {
    tab: "Announcement bar",
    one: "message",
    help: "Short messages in the moving strip at the top of every page.",
    fields: [
      { key: "text", label: "Message", required: true, max: 120, placeholder: "Free delivery on orders above ₹999" },
      { key: "link", label: "Link (optional)", max: 300, placeholder: "/categories/fitness" },
    ],
    title: (r) => r.text,
    sub: (r) => r.link,
  },
  leaders: {
    tab: "Leadership",
    one: "person",
    help: "People shown on the About Us page. Square photos work best.",
    image: true,
    fields: [
      { key: "name", label: "Name", required: true, max: 80 },
      { key: "role", label: "Role", max: 80, placeholder: "Managing Director" },
      { key: "quote", label: "Quote", max: 600, textarea: true },
    ],
    title: (r) => r.name,
    sub: (r) => r.role,
  },
  clients: {
    tab: "Client logos",
    one: "client",
    help: "Logos in the clients strip on the home page. PNG with a transparent background works best.",
    image: true,
    fields: [{ key: "name", label: "Name", required: true, max: 120 }],
    title: (r) => r.name,
    sub: () => "",
  },
};

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function Editor({ kind, row, onClose }) {
  const config = KINDS[kind];
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() =>
    Object.fromEntries(config.fields.map((f) => [f.key, f.type === "date" ? toDateInput(row?.[f.key]) : row?.[f.key] || ""]))
  );
  const [image, setImage] = useState(null); // new picture (data URL)

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form };
      // Dates: start of the day / end of the day, India time.
      if ("startsAt" in body) body.startsAt = body.startsAt ? `${body.startsAt}T00:00:00+05:30` : null;
      if ("endsAt" in body) body.endsAt = body.endsAt ? `${body.endsAt}T23:59:59+05:30` : null;
      if (image) body.image = image;
      return row ? adminApi.updateContent(kind, row.id, body) : adminApi.addContent(kind, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", kind] });
      toast.success("Saved. It's live on the website.");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const preview = image || row?.image;
  const missingImage = config.image && !preview;

  return (
    <Modal
      open
      title={`${row ? "Edit" : "Add"} ${config.one}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        {config.image && (
          <div>
            <p className="label">Picture</p>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-3 text-sm text-slate-500 hover:border-brand">
              {preview ? <img src={preview} alt="" className="max-h-40 rounded object-contain" /> : <ImagePlus className="size-6" />}
              <span>{preview ? "Change picture" : "Choose a picture"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 8 * 1024 * 1024) return toast.error("Picture is too big (max 8 MB).");
                  setImage(await fileToDataUrl(file));
                }}
              />
            </label>
            {missingImage && kind !== "clients" && <p className="mt-1 text-xs text-amber-700">Without a picture this {config.one} shows as a plain block.</p>}
          </div>
        )}
        {config.fields.map((f) => (
          <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`}>
            {f.textarea ? (
              <textarea className="input" rows={3} maxLength={f.max} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            ) : (
              <input
                className="input"
                type={f.type || "text"}
                maxLength={f.max}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            )}
          </Field>
        ))}
      </div>
    </Modal>
  );
}

export default function ContentPage() {
  const [params, setParams] = useSearchParams();
  const kind = KINDS[params.get("kind")] ? params.get("kind") : "hero";
  const config = KINDS[kind];
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // row, or "new"

  const { data: rows, isLoading, error, refetch } = useQuery({ queryKey: ["content", kind], queryFn: () => adminApi.content(kind) });
  const refresh = (list) => queryClient.setQueryData(["content", kind], list);

  const toggle = useMutation({
    mutationFn: (row) => adminApi.updateContent(kind, row.id, { isActive: !row.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["content", kind] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (row) => adminApi.deleteContent(kind, row.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", kind] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reorder = useMutation({
    mutationFn: (ids) => adminApi.reorderContent(kind, ids),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });

  const move = (i, by) => {
    const ids = rows.map((r) => r.id);
    const [id] = ids.splice(i, 1);
    ids.splice(i + by, 0, id);
    reorder.mutate(ids);
  };

  return (
    <>
      <PageHeader
        title="Website content"
        subtitle={config.help}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" /> Add {config.one}
          </Button>
        }
      />
      <Tabs tabs={Object.entries(KINDS).map(([value, k]) => ({ value, label: k.tab }))} value={kind} onChange={(v) => setParams({ kind: v })} />

      {error ? (
        <ErrorBox error={errorMessage(error)} retry={refetch} />
      ) : isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Card>
          <Empty title={`No ${config.tab.toLowerCase()} added yet`}>
            Until you add one, the website shows its built-in {config.tab.toLowerCase()}. Once you add one, only what's here is shown.
          </Empty>
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <div key={row.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex flex-col">
                <button className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="size-4" /></button>
                <button className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={i === rows.length - 1 || reorder.isPending} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="size-4" /></button>
              </div>
              {config.image &&
                (row.image ? (
                  <img src={row.image} alt="" className={`shrink-0 rounded border border-slate-100 object-cover ${kind === "hero" ? "h-14 w-32" : "size-14 object-contain"}`} />
                ) : (
                  <div className={`shrink-0 rounded bg-slate-100 ${kind === "hero" ? "h-14 w-32" : "size-14"}`} />
                ))}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-navy">{config.title(row)}</p>
                {config.sub(row) && <p className="truncate text-xs text-slate-500">{config.sub(row)}</p>}
              </div>
              {!row.isActive && <Badge>Hidden</Badge>}
              {kind === "hero" && row.endsAt && new Date(row.endsAt) < new Date() && <Badge tone="amber">Ended</Badge>}
              <Toggle checked={row.isActive} label="Show on website" onChange={() => toggle.mutate(row)} />
              <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setEditing(row)} aria-label="Edit"><Pencil className="size-4" /></button>
              <button
                className="rounded p-1.5 text-red-500 hover:bg-red-50"
                onClick={() => confirm(`Delete "${config.title(row)}"?`) && remove.mutate(row)}
                aria-label="Delete"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </Card>
      )}

      {editing && <Editor key={kind + (editing.id || "new")} kind={kind} row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
