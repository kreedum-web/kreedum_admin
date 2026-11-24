import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, EyeOff, Pencil, Pin, Plus, Search, Trash2, X } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { money } from "../lib/format";
import { Badge, Button, Card, Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Table, Tabs } from "../components/ui";

const date = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/**
 * Search: what customers look for and what finds nothing, words that mean
 * the same ("walking pad" = "walkpad"), and the website's popular searches.
 */
export default function SearchPage() {
  const [tab, setTab] = useState("top");
  const [days, setDays] = useState(30);
  const [tryText, setTryText] = useState("");
  const [group, setGroup] = useState(null); // { id?, text }
  const queryClient = useQueryClient();

  const stats = useQuery({ queryKey: ["search-stats", days], queryFn: () => adminApi.searchStats(days) });
  const synonyms = useQuery({ queryKey: ["search-synonyms"], queryFn: () => adminApi.searchSynonyms() });
  const popular = useQuery({ queryKey: ["search-popular"], queryFn: () => adminApi.searchPopular() });

  const savePopular = useMutation({
    mutationFn: (body) => adminApi.updateSearchPopular(body),
    onSuccess: (data) => {
      queryClient.setQueryData(["search-popular"], data);
      toast.success("Popular searches updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const saveGroup = useMutation({
    mutationFn: ({ id, phrases }) => (id ? adminApi.updateSearchSynonym(id, phrases) : adminApi.createSearchSynonym(phrases)),
    onSuccess: (g) => {
      queryClient.invalidateQueries({ queryKey: ["search-synonyms"] });
      setGroup(null);
      setTryText(g.phrases[0]);
      toast.success(`Saved: ${g.phrases.join(" = ")}. Try it below.`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const deleteGroup = useMutation({
    mutationFn: (id) => adminApi.deleteSearchSynonym(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search-synonyms"] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const pinned = popular.data?.pinned || [];
  const hidden = popular.data?.hidden || [];
  const pin = (text) => savePopular.mutate({ pinned: [...pinned.filter((p) => p.toLowerCase() !== text.toLowerCase()), text] });
  const hide = (text) => savePopular.mutate({ hidden: [...hidden, text], pinned: pinned.filter((p) => p.toLowerCase() !== text.toLowerCase()) });
  const tryIt = (text) => {
    setTryText(text);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const s = stats.data;
  return (
    <>
      <PageHeader
        title="Search"
        subtitle="What customers search for on the store, what finds nothing, and how to fix it."
        actions={
          <select className="input !w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 30, 90, 180].map((d) => (
              <option key={d} value={d}>Last {d} days</option>
            ))}
          </select>
        }
      />

      <TrySearch text={tryText} onText={setTryText} />

      {s && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs text-slate-500">Searches</p>
            <p className="text-2xl font-semibold text-navy">{s.searches.toLocaleString("en-IN")}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Found nothing</p>
            <p className="text-2xl font-semibold text-navy">
              {s.withoutResults.toLocaleString("en-IN")}
              {s.searches > 0 && <span className="ml-2 text-sm font-normal text-slate-500">{Math.round((s.withoutResults / s.searches) * 100)}%</span>}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Same-meaning word groups</p>
            <p className="text-2xl font-semibold text-navy">{synonyms.data?.length ?? "–"}</p>
          </Card>
        </div>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "top", label: "Top searches" },
          { value: "none", label: "No results", count: s?.noResults.length },
          { value: "words", label: "Same-meaning words", count: synonyms.data?.length },
          { value: "popular", label: "Popular searches" },
        ]}
      />

      {tab === "top" || tab === "none" ? (
        stats.isLoading ? (
          <Spinner />
        ) : stats.error ? (
          <ErrorBox error={errorMessage(stats.error)} retry={stats.refetch} />
        ) : (
          <Card>
            {tab === "none" && (
              <p className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
                Searches that found nothing, or only partly matched. If we sell it under another name, click <b>Add same-meaning words</b> and
                write what our products call it, e.g. “jump rope” = “skipping rope”.
              </p>
            )}
            {(tab === "top" ? s.top : s.noResults).length === 0 ? (
              <Empty title={tab === "top" ? "No searches yet" : "Every search found products"}>
                {tab === "top" ? "Searches made on the store show here." : "Nothing to fix for now."}
              </Empty>
            ) : (
              <Table head={["Search", { label: "Times", right: true }, "Results now", "Last", ""]}>
                {(tab === "top" ? s.top : s.noResults).map((r) => (
                  <tr key={r.term} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-navy">{r.text || r.term}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.count}</td>
                    <td className="px-4 py-2">
                      {r.results === 0 ? <Badge tone="red">None</Badge> : r.relaxed ? <Badge tone="amber">{r.results} partial</Badge> : r.results}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{date(r.lastAt)}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" onClick={() => tryIt(r.text || r.term)}>
                          <Search className="size-4" /> Try
                        </Button>
                        {tab === "none" ? (
                          <Button variant="secondary" onClick={() => setGroup({ text: `${r.term}\n` })}>
                            <Plus className="size-4" /> Add same-meaning words
                          </Button>
                        ) : (
                          <>
                            <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Pin to popular searches" onClick={() => pin(r.text || r.term)}>
                              <Pin className="size-4" />
                            </button>
                            <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Never show as a popular search" onClick={() => hide(r.text || r.term)}>
                              <EyeOff className="size-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        )
      ) : tab === "words" ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <p className="text-sm text-slate-600">
              Words or phrases that mean the same. A customer typing any one of them finds products that use any of them.
            </p>
            <Button onClick={() => setGroup({ text: "" })}>
              <Plus className="size-4" /> New group
            </Button>
          </div>
          {synonyms.isLoading ? (
            <Spinner />
          ) : !synonyms.data?.length ? (
            <Empty title="No groups yet">For example: walking pad = walkpad = walk pad, or skipping rope = jump rope.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {synonyms.data.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {g.phrases.map((p, i) => (
                      <span key={p} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-slate-400">=</span>}
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-sm text-indigo-700">{p}</span>
                      </span>
                    ))}
                  </div>
                  <Button variant="ghost" onClick={() => tryIt(g.phrases[0])}>
                    <Search className="size-4" /> Try
                  </Button>
                  <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Edit" onClick={() => setGroup({ id: g.id, text: g.phrases.join("\n") })}>
                    <Pencil className="size-4" />
                  </button>
                  <button
                    className="rounded p-1.5 text-red-500 hover:bg-red-50"
                    title="Delete"
                    onClick={() => confirm(`Delete "${g.phrases.join(" = ")}"?`) && deleteGroup.mutate(g.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <PopularTab data={popular.data} loading={popular.isLoading} saving={savePopular.isPending} onSave={(body) => savePopular.mutate(body)} />
      )}

      <Modal
        open={Boolean(group)}
        title={group?.id ? "Edit same-meaning words" : "Words that mean the same"}
        onClose={() => setGroup(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setGroup(null)}>Cancel</Button>
            <Button
              loading={saveGroup.isPending}
              onClick={() => saveGroup.mutate({ id: group.id, phrases: group.text.split(/\n|,|=/).map((p) => p.trim()).filter(Boolean) })}
            >
              Save
            </Button>
          </>
        }
      >
        {group && (
          <div className="space-y-3">
            <Field label="One per line" hint="At least two. Up to 4 words each. Capitals and plurals don't matter.">
              <textarea
                className="input min-h-36"
                autoFocus
                value={group.text}
                onChange={(e) => setGroup({ ...group, text: e.target.value })}
                placeholder={"walking pad\nwalkpad\nwalk pad"}
              />
            </Field>
            <p className="text-xs text-slate-500">
              Tip: put what customers type and what our products are called. Check with “Try a search” after saving.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Try a search as customers would (debounced). */
function TrySearch({ text, onText }) {
  const [term, setTerm] = useState(text);
  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);
  const { data, isFetching } = useQuery({
    queryKey: ["search-test", term],
    queryFn: () => adminApi.searchTest(term),
    enabled: term.length >= 2,
  });

  return (
    <Card className="mb-4 p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
        <input className="input !pl-9" placeholder="Try a search, as a customer would" value={text} onChange={(e) => onText(e.target.value)} />
        {text && (
          <button className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:text-navy" onClick={() => onText("")} title="Clear">
            <X className="size-4" />
          </button>
        )}
      </div>
      {term.length >= 2 && data && (
        <div className={isFetching ? "opacity-60" : ""}>
          <p className="mt-3 text-sm text-slate-600">
            <b>{data.total}</b> product{data.total === 1 ? "" : "s"}
            {data.interpreted?.relaxed && <span className="text-amber-700"> (partial matches: no product has every word)</span>}
            {data.interpreted?.corrections?.length > 0 && (
              <span> · read as “{data.interpreted.corrections.map((c) => c.to).join(", ")}”</span>
            )}
            {data.interpreted?.maxPrice != null && <span> · under {money(data.interpreted.maxPrice)}</span>}
            {data.interpreted?.minPrice != null && <span> · above {money(data.interpreted.minPrice)}</span>}
          </p>
          {data.products.length > 0 && (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.products.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2 text-sm">
                  {p.thumbnail ? <img src={p.thumbnail} alt="" className="size-9 rounded object-contain" /> : <div className="size-9 rounded bg-slate-100" />}
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

/** Pinned and hidden popular searches, and what the store shows now. */
function PopularTab({ data, loading, saving, onSave }) {
  const [adding, setAdding] = useState("");
  if (loading || !data) return <Spinner />;
  const { pinned, hidden, showing } = data;
  const move = (i, step) => {
    const next = [...pinned];
    [next[i], next[i + step]] = [next[i + step], next[i]];
    onSave({ pinned: next });
  };
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-navy">Shown on the store now</h2>
        <p className="mb-3 text-xs text-slate-500">Pinned first, then what customers search most (last 30 days), then starter searches.</p>
        <ol className="space-y-1 text-sm">
          {showing.map((t, i) => (
            <li key={t} className="flex gap-2">
              <span className="w-4 text-right tabular-nums text-slate-400">{i + 1}</span>
              {t}
              {pinned.some((p) => p.toLowerCase() === t.toLowerCase()) && <Badge tone="blue">Pinned</Badge>}
            </li>
          ))}
        </ol>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-navy">Pinned</h2>
        <p className="mb-3 text-xs text-slate-500">Always shown first, in this order.</p>
        <form
          className="mb-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!adding.trim()) return;
            onSave({ pinned: [...pinned, adding.trim()] });
            setAdding("");
          }}
        >
          <input className="input" placeholder="e.g. Walking Pad" maxLength={60} value={adding} onChange={(e) => setAdding(e.target.value)} />
          <Button type="submit" loading={saving}>Add</Button>
        </form>
        {pinned.length === 0 ? (
          <p className="text-sm text-slate-500">None pinned.</p>
        ) : (
          <ul className="space-y-1">
            {pinned.map((t, i) => (
              <li key={t} className="flex items-center gap-1 text-sm">
                <span className="flex-1">{t}</span>
                <button className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-20" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="size-4" />
                </button>
                <button className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-20" disabled={i === pinned.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="size-4" />
                </button>
                <button className="rounded p-1 text-red-500 hover:bg-red-50" onClick={() => onSave({ pinned: pinned.filter((p) => p !== t) })} title="Unpin">
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-navy">Never shown</h2>
        <p className="mb-3 text-xs text-slate-500">Searches kept off the popular list (typos, odd ones). Hide one from the Top searches tab.</p>
        {hidden.length === 0 ? (
          <p className="text-sm text-slate-500">None.</p>
        ) : (
          <ul className="space-y-1">
            {hidden.map((t) => (
              <li key={t} className="flex items-center gap-1 text-sm">
                <span className="flex-1">{t}</span>
                <button className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => onSave({ hidden: hidden.filter((h) => h !== t) })} title="Allow again">
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
