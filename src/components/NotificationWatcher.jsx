import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { adminApi } from "../lib/api";
import { typeOf } from "../lib/notificationTypes";

/**
 * Checks for new notifications every 15 seconds, on every page of the
 * dashboard (also while the tab is in the background). For each new one:
 *   - a pop-up in the corner with "Open"
 *   - a short "ding" (can be turned off on the Notifications page)
 *   - a desktop notification, if allowed (works even in another tab/window)
 *   - the tab title shows the unread count
 * Notifications already there when the dashboard opens don't pop up again.
 */
const POLL_MS = 15000;
const BASE_TITLE = "Kreedum Admin";
const SOUND_KEY = "kreedum_admin_sound";

const WatcherContext = createContext({ unread: 0, newOrders: 0, notifications: [] });
export const useNotifications = () => useContext(WatcherContext);

let audioContext;
export function ding() {
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

// Which lists to refresh when a notification of this type arrives.
const REFRESH = {
  NEW_ORDER: [["overview"], ["orders"]],
  ORDER_CANCELLED: [["overview"], ["orders"], ["order"]],
  BULK_ENQUIRY: [["enquiries"], ["overview"]],
  CONTACT_ENQUIRY: [["enquiries"], ["overview"]],
  PRODUCT_ENQUIRY: [["enquiries"], ["overview"]],
  WHATSAPP_ENQUIRY: [["enquiries"], ["overview"]],
};

export function NotificationWatcher({ children }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const known = useRef(null); // ids already seen (null until the first check)
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem(SOUND_KEY) !== "off");

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: adminApi.notifications,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  });

  const announce = useCallback(
    (n) => {
      const { icon: Icon, tint } = typeOf(n.type);
      const open = () => {
        adminApi.markNotificationsRead(n.id).then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }));
        if (n.link) navigate(n.link);
      };
      toast.custom(
        (t) => (
          <div className="flex w-80 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
            <div className={`rounded-lg p-2 ${tint}`}>
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy">{n.title}</p>
              {n.body && <p className="line-clamp-2 text-xs text-slate-500">{n.body}</p>}
              {n.link && (
                <button
                  className="mt-2 rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark"
                  onClick={() => {
                    toast.dismiss(t.id);
                    open();
                  }}
                >
                  Open
                </button>
              )}
            </div>
            <button onClick={() => toast.dismiss(t.id)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        ),
        { duration: 20000, position: "top-right", id: `n-${n.id}` }
      );

      if ("Notification" in window && Notification.permission === "granted") {
        const desktop = new Notification(n.title, { body: n.body, icon: "/favicon-96x96.png", tag: n.id });
        desktop.onclick = () => {
          window.focus();
          open();
          desktop.close();
        };
      }
    },
    [navigate, queryClient]
  );

  useEffect(() => {
    if (!data) return;
    const ids = data.notifications.map((n) => n.id);
    if (known.current === null) {
      known.current = new Set(ids); // first check: just remember what's there
    } else {
      const fresh = data.notifications.filter((n) => !known.current.has(n.id) && !n.read);
      [...fresh].reverse().forEach(announce);
      ids.forEach((id) => known.current.add(id));
      if (fresh.length) {
        if (soundOn) ding();
        const keys = new Set(fresh.flatMap((n) => (REFRESH[n.type] || []).map((k) => JSON.stringify(k))));
        keys.forEach((k) => queryClient.invalidateQueries({ queryKey: JSON.parse(k) }));
      }
    }
    document.title = data.unread ? `(${data.unread}) ${BASE_TITLE}` : BASE_TITLE;
  }, [data, announce, soundOn, queryClient]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    if (next) ding();
  };

  return (
    <WatcherContext.Provider
      value={{
        unread: data?.unread || 0,
        newOrders: data?.newOrders || 0,
        notifications: data?.notifications || [],
        loaded: Boolean(data),
        soundOn,
        toggleSound,
      }}
    >
      {children}
    </WatcherContext.Provider>
  );
}
