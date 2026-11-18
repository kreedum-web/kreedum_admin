import { useMemo, useState } from "react";
import { dayLabel } from "../lib/format";

/** Clean tick step for an axis reaching `max`. */
function niceStep(max, ticks = 4) {
  if (max <= 0) return 1;
  const raw = max / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw);
  return step;
}

/**
 * Single-series column chart over days (one hue, so no legend: the title names it).
 * data: [{ day: "2026-11-18", ...values }], valueKey picks the plotted value,
 * format formats values (tooltip, axis), detail(row) adds a tooltip line.
 */
export default function BarChart({ data, valueKey, format = String, axisFormat, detail, height = 200, label }) {
  const [hover, setHover] = useState(null);
  const width = 720;
  const pad = { top: 12, right: 8, bottom: 26, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const { step, top } = useMemo(() => {
    const max = Math.max(0, ...data.map((d) => d[valueKey] || 0));
    const s = niceStep(max);
    return { step: s, top: Math.max(s, Math.ceil(max / s) * s) };
  }, [data, valueKey]);

  const band = plotW / Math.max(data.length, 1);
  const barW = Math.min(24, Math.max(band - 2, 2)); // 2px surface gap between neighbours
  const y = (v) => pad.top + plotH - (v / top) * plotH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.ceil(data.length / 8);
  const fmtAxis = axisFormat || format;
  const hovered = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#E8ECF3" strokeWidth="1" />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">
              {fmtAxis(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = d[valueKey] || 0;
          const x = pad.left + i * band + (band - barW) / 2;
          const h = Math.max(plotH - (y(v) - pad.top), 0);
          const r = Math.min(4, barW / 2, h);
          const yTop = pad.top + plotH - h;
          // Rounded data end, square at the baseline.
          const path =
            h <= 0
              ? ""
              : `M${x},${pad.top + plotH} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${pad.top + plotH} Z`;
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.left + i * band} y={pad.top} width={band} height={plotH} fill="transparent" />
              {path && <path d={path} fill="#2C62E0" opacity={hover == null || hover === i ? 1 : 0.45} />}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[11px]">
                  {dayLabel(d.day)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="#CBD2DE" strokeWidth="1" />
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${((pad.left + (hover + 0.5) * band) / width) * 100}%` }}
        >
          <div className="font-medium text-slate-500">{dayLabel(hovered.day)}</div>
          <div className="text-sm font-semibold text-navy">{format(hovered[valueKey] || 0)}</div>
          {detail && <div className="text-slate-500">{detail(hovered)}</div>}
        </div>
      )}
      {/* Same numbers as a table, for screen readers. */}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th>{d.day}</th>
              <td>{format(d[valueKey] || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Horizontal bars for a short ranked list (top pages, sources). */
export function RankBars({ rows, labelKey, valueKey, format = String }) {
  const max = Math.max(1, ...rows.map((r) => r[valueKey] || 0));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r[labelKey]} className="text-sm">
          <div className="mb-1 flex justify-between gap-3">
            <span className="truncate text-slate-700" title={r[labelKey]}>
              {r[labelKey]}
            </span>
            <span className="shrink-0 tabular-nums text-slate-500">{format(r[valueKey])}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(((r[valueKey] || 0) / max) * 100, 1)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
