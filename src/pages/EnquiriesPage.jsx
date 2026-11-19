import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ExternalLink, Mail, MessageCircle, Phone } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { dateTime, STORE_URL } from "../lib/format";
import { Badge, Card, Empty, ErrorBox, PageHeader, Pagination, Spinner, Tabs } from "../components/ui";

const STATUS = { NEW: ["New", "amber"], CONTACTED: ["Contacted", "blue"], CLOSED: ["Closed", "gray"] };

const KINDS = [
  { value: "", label: "All" },
  { value: "bulk", label: "Bulk orders" },
  { value: "contact", label: "Contact form" },
  { value: "product", label: "Product (WhatsApp)" },
  { value: "whatsapp", label: "WhatsApp chats" },
];
const KIND_LABEL = { bulk: "Bulk order", contact: "Contact form", product: "Product enquiry", whatsapp: "WhatsApp chat" };

const SOURCE_LABEL = {
  floating: "the floating WhatsApp button",
  "product-page": "the Enquire Now button on the product page",
  footer: "the WhatsApp link in the footer",
  "contact-page": "the WhatsApp link on Contact Us",
  "bulk-page": "the WhatsApp link on Bulk Enquiry",
  "order-help": "the WhatsApp button on their order page",
  other: "a WhatsApp link",
};

const digits = (phone) => String(phone || "").replace(/\D/g, "").slice(-10);

function ContactButtons({ e }) {
  const phone = digits(e.phone);
  const product = e.productName ? ` about ${e.productName}` : "";
  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      {phone && (
        <>
          <a href={`tel:+91${phone}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-medium hover:bg-slate-50">
            <Phone className="size-3.5" /> {e.phone}
          </a>
          <a
            href={`https://wa.me/91${phone}?text=${encodeURIComponent(`Hello ${e.name || ""}, this is Kreedum Sports. Thanks for your enquiry${product}. How can we help?`)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-medium hover:bg-slate-50"
          >
            <MessageCircle className="size-3.5" /> WhatsApp
          </a>
        </>
      )}
      {e.email && (
        <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-medium hover:bg-slate-50">
          <Mail className="size-3.5" /> {e.email}
        </a>
      )}
    </div>
  );
}

function Details({ e }) {
  if (e.kind === "product" || e.kind === "whatsapp") {
    return (
      <div className="mt-3 space-y-1 text-sm">
        {e.productName && (
          <p>
            <a href={`${STORE_URL}/products/${e.productSlug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
              {e.productName} <ExternalLink className="size-3.5" />
            </a>
            {(e.sku || e.quantity > 0) && (
              <span className="text-slate-500">
                {" "}
                {[e.sku && `SKU ${e.sku}`, e.quantity > 0 && `qty ${e.quantity}`].filter(Boolean).join(" · ")}
              </span>
            )}
          </p>
        )}
        {e.orderNumber && <p>About order <b>{e.orderNumber}</b></p>}
        <p className="text-slate-500">
          Opened WhatsApp with {SOURCE_LABEL[e.source] || "a WhatsApp link"}
          {e.page && !e.productName ? ` (${e.page})` : ""}
          {e.clicks > 1 ? ` · ${e.clicks} times` : ""}.
        </p>
        <p className="text-xs text-slate-400">Their message is in your WhatsApp. We only see that the chat was opened.</p>
      </div>
    );
  }
  if (e.kind === "contact") {
    return (
      <div className="mt-3 text-sm">
        {e.topic && <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{e.topic}</p>}
        {e.message && <p className="mt-1 rounded-lg bg-slate-50 p-3 text-slate-700">{e.message}</p>}
      </div>
    );
  }
  return (
    <>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {[["Facility", e.facilityType], ["Needs", e.equipmentNeed], ["Budget", e.budget], ["Timeline", e.timeline]].map(
          ([k, v]) =>
            v && (
              <div key={k}>
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd>{v}</dd>
              </div>
            )
        )}
      </dl>
      {e.message && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{e.message}</p>}
    </>
  );
}

export default function EnquiriesPage() {
  const [params, setParams] = useSearchParams();
  const kind = params.get("kind") || "";
  const status = params.get("status") ?? "NEW";
  const page = Number(params.get("page")) || 1;
  const queryClient = useQueryClient();

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v !== undefined && v !== null ? next.set(k, v) : next.delete(k)));
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["enquiries", { kind, status, page }],
    queryFn: () => adminApi.enquiries({ kind, status, page }),
    placeholderData: keepPreviousData,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }) => adminApi.setEnquiryStatus(id, status),
    onSuccess: (e) => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(`Marked ${STATUS[e.status][0].toLowerCase()}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const newByKind = data?.newByKind || {};
  const counts = data?.counts || {};
  const totalNew = Object.values(newByKind).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader title="Enquiries" subtitle="Bulk orders, Contact Us messages, and WhatsApp chats opened from the website." />
      <Tabs
        tabs={KINDS.map((k) => ({ ...k, count: k.value ? newByKind[k.value] : totalNew }))}
        value={kind}
        onChange={(v) => update({ kind: v || null })}
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[["NEW", "New"], ["CONTACTED", "Contacted"], ["CLOSED", "Closed"], ["", "All"]].map(([v, l]) => (
          <button
            key={v}
            onClick={() => update({ status: v })}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${status === v ? "bg-navy text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {l}
            {v && counts[v] ? <span className="ml-1 opacity-70">{counts[v]}</span> : null}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorBox error={errorMessage(error)} retry={refetch} />
      ) : isLoading ? (
        <Spinner />
      ) : data.enquiries.length === 0 ? (
        <Card><Empty title="No enquiries here" /></Card>
      ) : (
        <div className="space-y-3">
          {data.enquiries.map((e) => {
            const k = e.kind || "bulk";
            const who = e.name || (e.signedIn ? e.accountLogin : "Website visitor (not signed in)");
            return (
              <Card key={e.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">
                      {who} {e.organisation && <span className="font-normal text-slate-500">· {e.organisation}</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {KIND_LABEL[k]} · {dateTime(e.createdAt)}
                      {e.city && ` · ${e.city}`}
                      {e.signedIn && " · signed in"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS[e.status][1]}>{STATUS[e.status][0]}</Badge>
                    <select
                      className="input !w-auto !py-1 text-xs"
                      value={e.status}
                      onChange={(ev) => setStatus.mutate({ id: e.id, status: ev.target.value })}
                      aria-label="Change status"
                    >
                      {Object.entries(STATUS).map(([v, [l]]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Details e={{ ...e, kind: k }} />
                <ContactButtons e={e} />
              </Card>
            );
          })}
          <Card><Pagination page={data.page} pages={data.pages} total={data.total} onPage={(p) => update({ page: String(p) })} /></Card>
        </div>
      )}
    </>
  );
}
