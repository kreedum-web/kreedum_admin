import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, CalendarClock, ExternalLink, Pencil, Plus } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { STORE_URL } from "../lib/format";
import { Badge, Button, Card, ErrorBox, Field, Modal, PageHeader, Spinner, Toggle } from "../components/ui";

/** What fills a row after the picks, in plain words. */
export const RULE_TEXT = {
  featured: "Your picks, then the most popular products",
  bestsellers: "Your picks, then the most ordered and enquired-about (last 90 days)",
  new: "Your picks, then the newest products in the catalogue",
  trending: "Your picks, then the most viewed (last 14 days)",
  deals: "Your picks, then the biggest discounts (changes every day)",
  "ready-stock": "Products marked “Ready stock” (in our store, fastest delivery)",
  custom: "Your picks, then products matching its filters",
};

const date = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function when(s) {
  if (!s.startsAt && !s.endsAt) return null;
  if (s.startsAt && s.endsAt) return `${date(s.startsAt)} – ${date(s.endsAt)}`;
  return s.startsAt ? `From ${date(s.startsAt)}` : `Until ${date(s.endsAt)}`;
}

function status(s) {
  if (!s.isVisible) return <Badge tone="gray">Hidden</Badge>;
  if (s.showingNow) return <Badge tone="green">Showing</Badge>;
  if (s.endsAt && new Date(s.endsAt) < new Date()) return <Badge tone="gray">Ended</Badge>;
  return <Badge tone="amber">Scheduled</Badge>;
}

/**
 * Home page product rows: order, show / hide, and new rows (e.g. a season).
 * Each row's own page sets its picks, size, dates and rule.
 */
export default function HomeSectionsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["home-sections"], queryFn: () => adminApi.homeSections() });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["home-sections"] });
  const onError = (e) => toast.error(errorMessage(e));

  const update = useMutation({
    mutationFn: ({ id, body }) => adminApi.updateHomeSection(id, body),
    onSuccess: (s, { body }) => {
      refresh();
      toast.success(body.isVisible === false ? `"${s.title}" is hidden from the home page` : `"${s.title}" is on the home page`);
    },
    onError,
  });
  const reorder = useMutation({
    mutationFn: (ids) => adminApi.reorderHomeSections(ids),
    onSuccess: (list) => queryClient.setQueryData(["home-sections"], list),
    onError,
  });
  const create = useMutation({
    mutationFn: (body) => adminApi.createHomeSection(body),
    onSuccess: (s) => {
      refresh();
      setCreating(null);
      toast.success(`"${s.title}" created. Pick its products, then switch it on.`);
      navigate(`/homepage/${s.id}`);
    },
    onError,
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={errorMessage(error)} retry={refetch} />;

  const move = (index, step) => {
    const ids = data.map((s) => s.id);
    [ids[index], ids[index + step]] = [ids[index + step], ids[index]];
    reorder.mutate(ids);
  };

  return (
    <>
      <PageHeader
        title="Home page sections"
        subtitle="The product rows on the store's home page: their order, what's in them, and seasonal rows with dates."
        actions={
          <>
            <a href={STORE_URL} target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <ExternalLink className="size-4" /> View home page
              </Button>
            </a>
            <Button onClick={() => setCreating({ title: "", subtitle: "" })}>
              <Plus className="size-4" /> New section
            </Button>
          </>
        }
      />

      <div className="space-y-2">
        {data.map((s, i) => (
          <Card key={s.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
            <div className="flex flex-col">
              <button
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-navy disabled:opacity-20"
                disabled={i === 0 || reorder.isPending}
                onClick={() => move(i, -1)}
                title="Move up"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-navy disabled:opacity-20"
                disabled={i === data.length - 1 || reorder.isPending}
                onClick={() => move(i, 1)}
                title="Move down"
              >
                <ArrowDown className="size-4" />
              </button>
            </div>

            <Link to={`/homepage/${s.id}`} className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-navy hover:text-brand">{s.title}</span>
                {status(s)}
                {!s.builtIn && <Badge tone="blue">Custom</Badge>}
                {when(s) && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <CalendarClock className="size-3.5" /> {when(s)}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {RULE_TEXT[s.rule]} · up to {s.limit} products ·{" "}
                {s.pickCount ? `${s.pickCount} picked` : s.rule === "ready-stock" ? "none marked yet" : "none picked"}
              </p>
            </Link>

            <Toggle
              checked={s.isVisible}
              label={`Show ${s.title} on the home page`}
              disabled={update.isPending}
              onChange={(v) => update.mutate({ id: s.id, body: { isVisible: v } })}
            />
            <Link to={`/homepage/${s.id}`}>
              <Button variant="secondary">
                <Pencil className="size-4" /> Edit
              </Button>
            </Link>
          </Card>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        A product shown in one row isn't filled into a row below it again (your picks always show). Rows with no products are
        left out. Changes reach the store within a few minutes.
      </p>

      <Modal
        open={Boolean(creating)}
        title="New home page section"
        onClose={() => setCreating(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(null)}>Cancel</Button>
            <Button loading={create.isPending} disabled={(creating?.title || "").trim().length < 2} onClick={() => create.mutate(creating)}>
              Create
            </Button>
          </>
        }
      >
        {creating && (
          <div className="space-y-4">
            <Field label="Title" hint="e.g. Summer Season, Monsoon Fitness, Diwali Offers">
              <input className="input" autoFocus maxLength={80} value={creating.title} onChange={(e) => setCreating({ ...creating, title: e.target.value })} />
            </Field>
            <Field label="Subtitle (optional)">
              <input className="input" maxLength={160} value={creating.subtitle} onChange={(e) => setCreating({ ...creating, subtitle: e.target.value })} />
            </Field>
            <p className="text-xs text-slate-500">
              It starts hidden. On the next page you pick its products, choose what fills it up (a category, brands, a price range) and
              set dates if it's seasonal.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
