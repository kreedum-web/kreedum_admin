import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  BarChart3, Bell, BellRing, Boxes, ExternalLink, Home, Image, LogOut, Mail, Menu, Package,
  Tags, Users, Volume2, VolumeX, X,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { adminApi } from "../lib/api";
import { ago, money, STORE_URL } from "../lib/format";
import { NewOrderWatcher, useNewOrders } from "./NewOrderWatcher";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/orders", label: "Orders", icon: Package, badge: "orders" },
  { to: "/products", label: "Products", icon: Boxes },
  { to: "/brands", label: "Brands", icon: Tags },
  { to: "/content", label: "Website content", icon: Image },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/enquiries", label: "Enquiries", icon: Mail },
  { to: "/traffic", label: "Traffic", icon: BarChart3 },
];

function Sidebar({ onNavigate }) {
  const { count } = useNewOrders();
  const { admin, signOut } = useAuth();
  return (
    <div className="flex h-full flex-col bg-navy text-slate-300">
      <div className="flex items-center gap-2 px-5 py-5">
        <img src="/images/logo.png" alt="" className="h-8 w-8 rounded bg-white object-contain p-0.5" />
        <div>
          <p className="text-sm font-semibold text-white">Kreedum Sports</p>
          <p className="text-xs text-slate-400">Admin</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                isActive ? "bg-white/10 font-medium text-white" : "hover:bg-white/5 hover:text-white"
              )
            }
          >
            <Icon className="size-4.5" />
            <span className="flex-1">{label}</span>
            {badge === "orders" && count > 0 && (
              <span className="rounded-full bg-brand px-1.5 text-xs font-semibold text-white">{count}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-white/10 px-3 py-3 text-sm">
        <a href={STORE_URL} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white">
          <ExternalLink className="size-4.5" /> Open store
        </a>
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/5 hover:text-white">
          <LogOut className="size-4.5" /> Sign out
        </button>
        <p className="truncate px-3 pt-1 text-xs text-slate-500">{admin?.email}</p>
      </div>
    </div>
  );
}

/** Bell with the waiting orders, alert settings and "mark all seen". */
function OrderBell() {
  const { count, orders, soundOn, toggleSound } = useNewOrders();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState(() => ("Notification" in window ? Notification.permission : "unsupported"));
  const ref = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const seenAll = useMutation({
    mutationFn: adminApi.markAllSeen,
    onSuccess: () => {
      queryClient.invalidateQueries();
      setOpen(false);
    },
  });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        aria-label={`${count} new orders`}
      >
        {count > 0 ? <BellRing className="size-5 text-brand" /> : <Bell className="size-5" />}
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-navy">New orders</p>
            {count > 0 && (
              <button onClick={() => seenAll.mutate()} className="text-xs font-medium text-brand hover:underline">
                Mark all seen
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {orders.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No new orders. You'll get a pop-up when one comes in.</p>
            ) : (
              orders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    setOpen(false);
                    navigate(`/orders/${o.id}`);
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-50 px-4 py-2.5 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy">{o.orderNumber}</p>
                    <p className="truncate text-xs text-slate-500">
                      {o.customer} · {ago(o.createdAt)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{money(o.total)}</span>
                </button>
              ))
            )}
          </div>
          <div className="space-y-2 border-t border-slate-100 px-4 py-3 text-xs">
            <button onClick={toggleSound} className="flex items-center gap-2 text-slate-600 hover:text-navy">
              {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              Sound for new orders: {soundOn ? "on" : "off"}
            </button>
            {permission === "default" && (
              <button
                onClick={() => Notification.requestPermission().then(setPermission)}
                className="flex items-center gap-2 font-medium text-brand hover:underline"
              >
                <BellRing className="size-4" /> Turn on desktop alerts (even in other tabs)
              </button>
            )}
            {permission === "granted" && <p className="text-emerald-700">Desktop alerts are on.</p>}
            {permission === "denied" && <p className="text-slate-500">Desktop alerts are blocked in this browser's site settings.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 lg:block">
        <Sidebar />
      </aside>
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
            <button onClick={() => setMenuOpen(false)} className="absolute right-2 top-5 text-slate-300" aria-label="Close menu">
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur lg:px-8">
        <button onClick={() => setMenuOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <Link to="/" className="text-sm font-semibold text-navy lg:hidden">
          Kreedum Admin
        </Link>
        <div className="ml-auto">
          <OrderBell />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

export default function Layout() {
  return (
    <NewOrderWatcher>
      <Shell />
    </NewOrderWatcher>
  );
}
