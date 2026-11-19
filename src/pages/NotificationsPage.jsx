import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import clsx from "clsx";
import { BellRing, CheckCheck, Trash2, Volume2, VolumeX } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { ago, dateTime } from "../lib/format";
import { typeOf } from "../lib/notificationTypes";
import { Button, Card, Empty, PageHeader, Spinner } from "../components/ui";
import { useNotifications } from "../components/NotificationWatcher";

export default function NotificationsPage() {
  const { notifications, unread, loaded, soundOn, toggleSound } = useNotifications();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [permission, setPermission] = useState(() => ("Notification" in window ? Notification.permission : "unsupported"));

  const refresh = (data) => queryClient.setQueryData(["notifications"], data);
  const readAll = useMutation({ mutationFn: () => adminApi.markNotificationsRead(), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });
  const readOne = useMutation({ mutationFn: (id) => adminApi.markNotificationsRead(id), onSuccess: refresh });
  const clearAll = useMutation({
    mutationFn: adminApi.clearNotifications,
    onSuccess: (data) => {
      refresh(data);
      toast.success("All notifications cleared");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const open = (n) => {
    if (!n.read) readOne.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="New orders, cancellations by customers and enquiries. The newest 20 are kept, each for 2 days."
        actions={
          <>
            <Button variant="secondary" disabled={!unread} loading={readAll.isPending} onClick={() => readAll.mutate()}>
              <CheckCheck className="size-4" /> Mark all read
            </Button>
            <Button
              variant="secondary"
              className="!text-red-600"
              disabled={!notifications.length}
              loading={clearAll.isPending}
              onClick={() => confirm("Clear all notifications?") && clearAll.mutate()}
            >
              <Trash2 className="size-4" /> Clear all
            </Button>
          </>
        }
      />

      <Card>
        {!loaded ? (
          <Spinner />
        ) : notifications.length === 0 ? (
          <Empty title="No notifications">New orders, cancellations and enquiries will show up here, with a pop-up wherever you are in the dashboard.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((n) => {
              const { icon: Icon, tint, label } = typeOf(n.type);
              return (
                <li key={n.id}>
                  <button
                    onClick={() => open(n)}
                    className={clsx("flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50", !n.read && "bg-tint/40")}
                  >
                    <span className={`mt-0.5 rounded-lg p-2 ${tint}`}>
                      <Icon className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2">
                        <span className={clsx("text-sm text-navy", !n.read && "font-semibold")}>{n.title}</span>
                        {!n.read && <span className="size-2 rounded-full bg-brand" aria-label="unread" />}
                      </span>
                      {n.body && <span className="mt-0.5 block text-sm text-slate-600">{n.body}</span>}
                      <span className="mt-0.5 block text-xs text-slate-400" title={dateTime(n.createdAt)}>
                        {label} · {ago(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mt-5 space-y-3 p-4 text-sm">
        <h2 className="font-semibold text-navy">Alerts on this computer</h2>
        <button onClick={toggleSound} className="flex items-center gap-2 text-slate-700 hover:text-navy">
          {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          Sound for new notifications: <b>{soundOn ? "on" : "off"}</b> <span className="text-xs text-slate-400">(click to change)</span>
        </button>
        {permission === "default" && (
          <button onClick={() => Notification.requestPermission().then(setPermission)} className="flex items-center gap-2 font-medium text-brand hover:underline">
            <BellRing className="size-4" /> Turn on desktop alerts (they show even when the dashboard is in another tab)
          </button>
        )}
        {permission === "granted" && <p className="text-emerald-700">Desktop alerts are on.</p>}
        {permission === "denied" && <p className="text-slate-500">Desktop alerts are blocked for this site in the browser's settings.</p>}
      </Card>
    </>
  );
}
