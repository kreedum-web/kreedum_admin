import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi, errorMessage } from "../lib/api";
import { number } from "../lib/format";
import { Card, ErrorBox, PageHeader, Spinner, Tabs } from "../components/ui";
import BarChart, { RankBars } from "../components/BarChart";

const DEVICE = { mobile: "Phone", tablet: "Tablet", desktop: "Computer" };

export default function TrafficPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["traffic", days],
    queryFn: () => adminApi.traffic(days),
    refetchInterval: 60_000,
  });

  return (
    <>
      <PageHeader title="Traffic" subtitle="Visitors to shop.kreedum.com. A visitor is one browser; it's counted once per day however many pages they open." />
      <Tabs
        tabs={[7, 30, 90].map((d) => ({ value: d, label: `Last ${d} days` }))}
        value={days}
        onChange={setDays}
      />
      {error ? (
        <ErrorBox error={errorMessage(error)} retry={refetch} />
      ) : isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">On the store now</p>
              <p className="mt-1 text-2xl font-semibold text-navy">{data.liveNow.visitors}</p>
              <p className="text-xs text-slate-500">active in the last 5 minutes</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Visitors</p>
              <p className="mt-1 text-2xl font-semibold text-navy">{number(data.totals.visitors)}</p>
              <p className="text-xs text-slate-500">different people, last {days} days</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pages viewed</p>
              <p className="mt-1 text-2xl font-semibold text-navy">{number(data.totals.pageViews)}</p>
              <p className="text-xs text-slate-500">last {days} days</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pages per visitor</p>
              <p className="mt-1 text-2xl font-semibold text-navy">
                {data.totals.visitors ? (data.totals.pageViews / data.totals.visitors).toFixed(1) : "—"}
              </p>
              <p className="text-xs text-slate-500">on average</p>
            </Card>
          </div>

          <Card className="mt-5 p-4">
            <h2 className="mb-3 text-sm font-semibold text-navy">Visitors per day</h2>
            <BarChart
              data={data.byDay}
              valueKey="visitors"
              format={(v) => `${number(v)} visitor${v === 1 ? "" : "s"}`}
              axisFormat={number}
              detail={(d) => `${number(d.pageViews)} pages viewed`}
              label="Visitors per day"
            />
          </Card>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <Card className="p-4 lg:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-navy">Most viewed pages</h2>
              {data.topPages.length ? <RankBars rows={data.topPages} labelKey="path" valueKey="views" format={(v) => `${number(v)} views`} /> : <p className="text-sm text-slate-500">No visits yet.</p>}
            </Card>
            <div className="space-y-5">
              <Card className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-navy">Where visitors came from</h2>
                {data.referrers.length ? <RankBars rows={data.referrers} labelKey="source" valueKey="visitors" format={number} /> : <p className="text-sm text-slate-500">No visits yet.</p>}
              </Card>
              <Card className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-navy">Devices</h2>
                {data.devices.length ? (
                  <RankBars rows={data.devices.map((d) => ({ ...d, device: DEVICE[d.device] || d.device }))} labelKey="device" valueKey="visitors" format={number} />
                ) : (
                  <p className="text-sm text-slate-500">No visits yet.</p>
                )}
              </Card>
              {data.liveNow.pages.length > 0 && (
                <Card className="p-4">
                  <h2 className="mb-3 text-sm font-semibold text-navy">Being viewed right now</h2>
                  <RankBars rows={data.liveNow.pages} labelKey="path" valueKey="visitors" format={number} />
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
