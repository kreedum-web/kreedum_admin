import clsx from "clsx";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { ORDER_STATUS, PAYMENT_STATUS } from "../lib/format";

export function Card({ className, children, ...props }) {
  return (
    <div className={clsx("rounded-xl border border-slate-200 bg-white", className)} {...props}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-navy">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const BUTTON = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-slate-600 hover:bg-slate-100",
};

export function Button({ variant = "primary", loading, className, children, disabled, ...props }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

const TONES = {
  gray: "bg-slate-100 text-slate-700",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
  indigo: "bg-indigo-100 text-indigo-800",
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-700",
};

export function Badge({ tone = "gray", children, className }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", TONES[tone], className)}>
      {children}
    </span>
  );
}

export const OrderStatus = ({ status }) => {
  const s = ORDER_STATUS[status] || { label: status, tone: "gray" };
  return <Badge tone={s.tone}>{s.label}</Badge>;
};

export const PaymentStatus = ({ status, method }) => {
  const s = PAYMENT_STATUS[status] || { label: status, tone: "gray" };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs font-medium text-slate-500">{method === "COD" ? "COD" : "Online"}</span>
      <Badge tone={s.tone}>{s.label}</Badge>
    </span>
  );
};

export const NewDot = () => <Badge tone="amber" className="!bg-brand !text-white">NEW</Badge>;

export function Spinner({ className }) {
  return (
    <div className={clsx("flex items-center justify-center py-16 text-slate-400", className)}>
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {children && <p className="mt-1 text-sm text-slate-500">{children}</p>}
    </div>
  );
}

export function ErrorBox({ error, retry }) {
  return (
    <Card className="p-6 text-center">
      <p className="text-sm text-red-700">{error}</p>
      {retry && (
        <Button variant="secondary" className="mt-3" onClick={retry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

export function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50",
        checked ? "bg-emerald-500" : "bg-slate-300"
      )}
    >
      <span className={clsx("inline-block size-5 rounded-full bg-white shadow transition", checked ? "translate-x-5.5" : "translate-x-0.5")} />
    </button>
  );
}

export function Pagination({ page, pages, onPage, total }) {
  if (pages <= 1) return total ? <p className="px-4 py-3 text-xs text-slate-500">{total} total</p> : null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
      <span className="text-xs text-slate-500">
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-1">
        <Button variant="secondary" className="!px-2" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="secondary" className="!px-2" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition",
            value === t.value ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          {t.label}
          {t.count ? <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-navy">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

/** Table shell: horizontal scroll on phones. */
export function Table({ head, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} className={clsx("px-4 py-2.5 font-medium", h?.right && "text-right")}>
                {h?.label ?? h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
