import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ShoppingBag, X } from "lucide-react";
import { adminApi } from "../lib/api";
import { money } from "../lib/format";

/**
 * Checks for new orders every 15 seconds, on every page of the dashboard
 * (also while the tab is in the background). For each order that appears:
 *   - a pop-up in the corner with "View order"
 *   - a short "ding" sound
 *   - a desktop notification, if allowed (works even in another tab/window)
 *   - the tab title shows "(2) New orders"
 * Orders already waiting when the dashboard opens don't pop up again; they
 * show in the count and on the home page.
 */
const POLL_MS = 15000;
const BASE_TITLE = "Kreedum Admin";

const WatcherContext = createContext({ count: 0, orders: [] });
export const useNewOrders = () => useContext(WatcherContext);

let audioContext;
function ding() {
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.frequency.value = freq;
      osc.connect(gain).connect(audioContext.destination);
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.35);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.4);
    });
  } catch {
    /* sound is a nice-to-have */
  }
}

export function NewOrderWatcher({ children }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const known = useRef(null); // order ids already shown (null until the first check)
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("kreedum_admin_sound") !== "off");

  const { data } = useQuery({
    queryKey: ["order-feed"],
    queryFn: adminApi.orderFeed,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  });

  const announce = useCallback(
    (order) => {
      const text = `${order.customer || "A customer"} · ${money(order.total)} · ${order.paymentMethod === "COD" ? "Cash on delivery" : "Paid online"}`;
      toast.custom(
        (t) => (
          <div className="flex w-80 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
            <div className="rounded-lg bg-tint p-2 text-brand">
              <ShoppingBag className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy">New order {order.orderNumber}</p>
              <p className="truncate text-xs text-slate-500">{text}</p>
              <button
                className="mt-2 rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark"
                onClick={() => {
                  toast.dismiss(t.id);
                  navigate(`/orders/${order.id}`);
                }}
              >
                View order
              </button>
            </div>
            <button onClick={() => toast.dismiss(t.id)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        ),
        { duration: 20000, position: "top-right", id: `order-${order.id}` }
      );

      if ("Notification" in window && Notification.permission === "granted") {
        const n = new Notification(`New order ${order.orderNumber}`, { body: text, icon: "/favicon-96x96.png", tag: order.id });
        n.onclick = () => {
          window.focus();
          navigate(`/orders/${order.id}`);
          n.close();
        };
      }
    },
    [navigate]
  );

  useEffect(() => {
    if (!data) return;
    const ids = data.orders.map((o) => o.id);
    if (known.current === null) {
      known.current = new Set(ids); // first check: just remember what's there
    } else {
      const fresh = data.orders.filter((o) => !known.current.has(o.id));
      fresh.reverse().forEach(announce);
      ids.forEach((id) => known.current.add(id));
      if (fresh.length) {
        if (soundOn) ding();
        // Fresh numbers everywhere (home page, order list).
        queryClient.invalidateQueries({ queryKey: ["overview"] });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      }
    }
    document.title = data.count ? `(${data.count}) New order${data.count > 1 ? "s" : ""} · ${BASE_TITLE}` : BASE_TITLE;
  }, [data, announce, soundOn, queryClient]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem("kreedum_admin_sound", next ? "on" : "off");
    if (next) ding();
  };

  return (
    <WatcherContext.Provider value={{ count: data?.count || 0, orders: data?.orders || [], soundOn, toggleSound }}>
      {children}
    </WatcherContext.Provider>
  );
}
