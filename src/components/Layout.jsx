import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  BarChart3, Bell, BellRing, Boxes, ExternalLink, FolderTree, Home, Image, LayoutList, LogOut, Mail, Menu, Package, Search,
  ShoppingCart, Tags, Users, X,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { STORE_URL } from "../lib/format";
import { NotificationWatcher, useNotifications } from "./NotificationWatcher";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/orders", label: "Orders", icon: Package, badge: "orders" },
  { to: "/products", label: "Products", icon: Boxes },
  { to: "/categories", label: "Categories", icon: FolderTree },
  { to: "/brands", label: "Brands", icon: Tags },
  { to: "/homepage", label: "Home page sections", icon: LayoutList },
  { to: "/content", label: "Website content", icon: Image },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/carts", label: "Carts & wishlists", icon: ShoppingCart },
  { to: "/enquiries", label: "Enquiries", icon: Mail },
  { to: "/traffic", label: "Traffic", icon: BarChart3 },
  { to: "/search", label: "Search", icon: Search },
];

function Sidebar({ onNavigate }) {
  const { newOrders: count } = useNotifications();
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

/** Bell: opens the Notifications page; red count = unread. */
function NotificationBell() {
  const { unread } = useNotifications();
  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) => clsx("relative inline-flex rounded-lg p-2 hover:bg-slate-100", isActive ? "text-brand" : "text-slate-600")}
      aria-label={`Notifications: ${unread} unread`}
    >
      {unread > 0 ? <BellRing className="size-5 text-brand" /> : <Bell className="size-5" />}
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </NavLink>
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
          <NotificationBell />
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
    <NotificationWatcher>
      <Shell />
    </NotificationWatcher>
  );
}
