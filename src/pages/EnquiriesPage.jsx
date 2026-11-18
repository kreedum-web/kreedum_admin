import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { dateTime } from "../lib/format";
import { Badge, Card, Empty, ErrorBox, PageHeader, Pagination, Spinner, Tabs } from "../components/ui";

const STATUS = { NEW: ["New", "amber"], CONTACTED: ["Contacted", "blue"], CLOSED: ["Closed", "gray"] };

export default function EnquiriesPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "NEW";
  const page = Number(params.get("page")) || 1;
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["enquiries", { status, page }],
    queryFn: () => adminApi.enquiries({ status, page }),
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

  const counts = data?.counts || {};
  return (
    <>
      <PageHeader title="Bulk enquiries" subtitle="Quote requests from the website's Bulk Enquiry form." />
      <Tabs
        tabs={[
          { value: "NEW", label: "New", count: counts.NEW },
          { value: "CONTACTED", label: "Contacted", count: counts.CONTACTED },
          { value: "CLOSED", label: "Closed" },
          { value: "", label: "All" },
        ]}
        value={status}
        onChange={(v) => setParams({ status: v })}
      />
      {error ? (
        <ErrorBox error={errorMessage(error)} retry={refetch} />
      ) : isLoading ? (
        <Spinner />
      ) : data.enquiries.length === 0 ? (
        <Card><Empty title="No enquiries here" /></Card>
      ) : (
        <div className="space-y-3">
          {data.enquiries.map((e) => {
            const phone = String(e.phone).replace(/\D/g, "").slice(-10);
            return (
              <Card key={e.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">
                      {e.name} {e.organisation && <span className="font-normal text-slate-500">· {e.organisation}</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {dateTime(e.createdAt)} {e.city && `· ${e.city}`} {e.signedIn && "· signed in"}
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
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <a href={`tel:+91${phone}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-medium hover:bg-slate-50"><Phone className="size-3.5" /> {e.phone}</a>
                  <a href={`https://wa.me/91${phone}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-medium hover:bg-slate-50"><MessageCircle className="size-3.5" /> WhatsApp</a>
                  {e.email && <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-medium hover:bg-slate-50"><Mail className="size-3.5" /> {e.email}</a>}
                </div>
              </Card>
            );
          })}
          <Card><Pagination page={data.page} pages={data.pages} total={data.total} onPage={(p) => setParams({ status, page: String(p) })} /></Card>
        </div>
      )}
    </>
  );
}
