import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft, Copy, ExternalLink, Mail, MessageCircle, Phone, Plus, Printer, Send, Settings2, Trash2, Truck } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { dateTime, money, ORDER_STATUS, STORE_URL } from "../lib/format";
import { Button, Card, ErrorBox, Field, Modal, OrderStatus, PageHeader, PaymentStatus, Spinner, Toggle } from "../components/ui";

const ACTION_LABEL = {
  CONFIRMED: "Confirm order",
  PACKED: "Mark packed",
  SHIPPED: "Mark shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Mark delivered",
  CANCELLED: "Cancel order",
  RETURNED: "Mark returned",
};

// Ready-made messages for the customer (the email and the order history).
// Pick one, then change it if needed. Delivered has none.
const PRESETS = {
  CONFIRMED: [
    "Your order is confirmed and will be packed soon.",
    "Confirmed! Expected delivery in 3–5 working days.",
    "Confirmed! We'll call you to fix a delivery and installation time.",
    "Confirmed! It will be ready for pick-up at our store soon.",
  ],
  PACKED: [
    "Your order is packed and will be handed to the courier shortly.",
    "Packed and ready to ship today.",
    "Packed and ready for pick-up at our store.",
    "Packed. Our team will deliver it and help with installation.",
  ],
  OUT_FOR_DELIVERY: [
    "Your order is out for delivery and will reach you today.",
    "Out for delivery. The delivery partner will call you before arriving.",
    "Out for delivery with our own team. Installation will be done on arrival.",
    "Out for delivery. Please keep the payment ready (cash on delivery).",
  ],
  CANCELLED: [
    "Out of stock with the supplier.",
    "We couldn't reach you to confirm the order.",
    "Delivery isn't available at your pincode yet.",
    "Cancelled as you asked.",
  ],
};

const EMPTY = { note: "", notify: true, courier: "", trackingId: "", trackingUrl: "" };

function StatusActions({ order }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [managing, setManaging] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const couriers = useQuery({ queryKey: ["couriers"], queryFn: () => adminApi.couriers(), enabled: confirming === "SHIPPED" });

  const open = (status) => {
    setForm({ ...EMPTY, notify: Boolean(order.customerEmail), note: PRESETS[status]?.[0] && status !== "CANCELLED" ? PRESETS[status][0] : "" });
    setConfirming(status);
  };

  const mutation = useMutation({
    mutationFn: (body) => adminApi.setOrderStatus(order.id, body),
    onSuccess: (updated, body) => {
      queryClient.setQueryData(["order", order.id], updated);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(
        `Order is now: ${ORDER_STATUS[updated.orderStatus]?.label || updated.orderStatus}${body.notify ? ". The customer is being emailed." : ""}`
      );
      setConfirming(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const next = order.nextStatuses || [];
  if (!next.length) return <p className="text-sm text-slate-500">This order is closed. Its status can't change any more.</p>;

  // The usual next step is the big button; skipping ahead and cancelling are smaller.
  const [main, ...rest] = next;
  const destructive = (s) => s === "CANCELLED" || s === "RETURNED";
  const paidOnline = order.paymentMethod === "ONLINE" && order.paymentStatus === "PAID";
  const presets = PRESETS[confirming] || [];
  const chosenCourier = couriers.data?.find((c) => c.name === form.courier);
  const autoLink =
    !form.trackingUrl && form.trackingId && chosenCourier?.trackingUrl
      ? chosenCourier.trackingUrl.replace("{id}", encodeURIComponent(form.trackingId.trim()))
      : "";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant={destructive(main) ? "danger" : "primary"} onClick={() => open(main)}>
          {ACTION_LABEL[main]}
        </Button>
        {rest.map((s) => (
          <Button key={s} variant={destructive(s) ? "ghost" : "secondary"} className={destructive(s) ? "!text-red-600" : ""} onClick={() => open(s)}>
            {ACTION_LABEL[s]}
          </Button>
        ))}
      </div>
      <Modal
        open={Boolean(confirming)}
        title={ACTION_LABEL[confirming]}
        onClose={() => setConfirming(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>Back</Button>
            <Button
              variant={destructive(confirming) ? "danger" : "primary"}
              loading={mutation.isPending}
              disabled={confirming === "SHIPPED" && !form.courier}
              onClick={() => mutation.mutate({ status: confirming, ...form })}
            >
              {ACTION_LABEL[confirming]}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {order.orderNumber} will show as <b>{ORDER_STATUS[confirming]?.label}</b> to the customer.
            {destructive(confirming) && paidOnline && ` They paid online, so ${money(order.pricing.total)} is refunded to them through Cashfree.`}
            {confirming === "DELIVERED" && order.paymentMethod === "COD" && " The cash payment is marked as collected."}
          </p>

          {confirming === "SHIPPED" && (
            <div className="space-y-3 rounded-lg border border-slate-200 p-3">
              <Field label="Courier / delivery partner">
                <div className="flex gap-2">
                  <select className="input" value={form.courier} onChange={(e) => set("courier", e.target.value)}>
                    <option value="">{couriers.isLoading ? "Loading…" : "Choose…"}</option>
                    {(couriers.data || [])
                      .filter((c) => c.isActive)
                      .map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                  </select>
                  <Button variant="secondary" onClick={() => setManaging(true)} title="Add or edit couriers">
                    <Settings2 className="size-4" />
                  </Button>
                </div>
              </Field>
              <Field label="Tracking number (AWB)">
                <input className="input" maxLength={80} value={form.trackingId} onChange={(e) => set("trackingId", e.target.value)} />
              </Field>
              <Field
                label="Tracking link (optional)"
                hint={
                  autoLink
                    ? `Made from the courier's link: ${autoLink}`
                    : chosenCourier && !chosenCourier.trackingUrl
                      ? "Paste the link to track it, or set this courier's tracking link (⚙) so it's made for you next time."
                      : undefined
                }
              >
                <input className="input" placeholder="https://…" value={form.trackingUrl} onChange={(e) => set("trackingUrl", e.target.value)} />
              </Field>
            </div>
          )}

          {presets.length > 0 && (
            <Field label={confirming === "CANCELLED" ? "Reason" : "Message"}>
              <select
                className="input"
                value={presets.includes(form.note) ? form.note : ""}
                onChange={(e) => set("note", e.target.value)}
              >
                <option value="">{confirming === "CANCELLED" ? "Choose a reason, or write your own below…" : "Write my own message…"}</option>
                {presets.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>
          )}
          <Field
            label={presets.length ? "Exactly what the customer sees (change it if you like)" : "Message for the customer (optional)"}
            hint="In the email and the order history."
          >
            <textarea className="input" rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} maxLength={300} />
          </Field>

          <label className={`flex items-start gap-2 text-sm ${order.customerEmail ? "" : "opacity-60"}`}>
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.notify}
              disabled={!order.customerEmail}
              onChange={(e) => set("notify", e.target.checked)}
            />
            <span>
              Email the customer
              <span className="block text-xs text-slate-500">
                {order.customerEmail ? `to ${order.customerEmail}` : "No email address on this order or account."}
              </span>
            </span>
          </label>
        </div>
      </Modal>
      <CouriersModal open={managing} onClose={() => setManaging(false)} />
    </>
  );
}

/** Add / edit the couriers in the Shipped dropdown, with their tracking links. */
function CouriersModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["couriers"], queryFn: () => adminApi.couriers(), enabled: open });
  const [adding, setAdding] = useState({ name: "", trackingUrl: "" });
  const [edits, setEdits] = useState({});
  const done = (list) => {
    queryClient.setQueryData(["couriers"], list);
    setEdits({});
  };
  const onError = (e) => toast.error(errorMessage(e));
  const add = useMutation({
    mutationFn: () => adminApi.createCourier(adding),
    onSuccess: (list) => {
      done(list);
      setAdding({ name: "", trackingUrl: "" });
      toast.success("Courier added");
    },
    onError,
  });
  const save = useMutation({ mutationFn: ({ id, body }) => adminApi.updateCourier(id, body), onSuccess: (list) => (done(list), toast.success("Saved")), onError });
  const remove = useMutation({ mutationFn: (id) => adminApi.deleteCourier(id), onSuccess: done, onError });

  return (
    <Modal open={open} title="Couriers" onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      <p className="mb-3 text-xs text-slate-500">
        Tracking link: the courier's tracking page with <b>{"{id}"}</b> where the tracking number goes, e.g.
        https://www.courier.com/track/{"{id}"}. Then customers get a “Track your order” button. Leave empty if you don't know it.
      </p>
      {isLoading ? (
        <Spinner />
      ) : (
        <ul className="mb-4 max-h-80 space-y-2 overflow-y-auto">
          {data.map((c) => {
            const edit = edits[c.id];
            return (
              <li key={c.id} className="rounded-lg border border-slate-200 p-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`flex-1 font-medium ${c.isActive ? "" : "text-slate-400 line-through"}`}>{c.name}</span>
                  <Toggle checked={c.isActive} label={`Show ${c.name}`} onChange={(v) => save.mutate({ id: c.id, body: { isActive: v } })} />
                  <button className="rounded p-1 text-red-500 hover:bg-red-50" title="Remove" onClick={() => confirm(`Remove ${c.name}?`) && remove.mutate(c.id)}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-1 flex gap-2">
                  <input
                    className="input !py-1 text-xs"
                    placeholder="Tracking link with {id}"
                    value={edit ?? c.trackingUrl}
                    onChange={(e) => setEdits({ ...edits, [c.id]: e.target.value })}
                  />
                  {edit !== undefined && edit !== c.trackingUrl && (
                    <Button className="!py-1 text-xs" loading={save.isPending} onClick={() => save.mutate({ id: c.id, body: { trackingUrl: edit } })}>
                      Save
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
        <p className="text-sm font-medium text-navy">Add a courier</p>
        <input className="input" placeholder="Name, e.g. Delhivery" maxLength={60} value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
        <input className="input" placeholder="Tracking link with {id} (optional)" value={adding.trackingUrl} onChange={(e) => setAdding({ ...adding, trackingUrl: e.target.value })} />
        <Button loading={add.isPending} disabled={adding.name.trim().length < 2} onClick={() => add.mutate()}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
    </Modal>
  );
}

/** Write to the customer from the shop's email address. */
function EmailCustomer({ order }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mail, setMail] = useState({ subject: "", message: "" });
  const send = useMutation({
    mutationFn: () => adminApi.emailOrderCustomer(order.id, mail),
    onSuccess: (updated) => {
      queryClient.setQueryData(["order", order.id], updated);
      setOpen(false);
      toast.success(`Email sent to ${order.customerEmail}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const name = order.shippingAddress?.fullName?.split(" ")[0] || "";
  return (
    <>
      <button
        onClick={() => {
          setMail({ subject: `About your order ${order.orderNumber}`, message: "" });
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"
      >
        <Mail className="size-3.5" /> Email
      </button>
      <Modal
        open={open}
        title={`Email ${name || "the customer"}`}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={send.isPending} disabled={mail.message.trim().length < 2} onClick={() => send.mutate()}>
              <Send className="size-4" /> Send
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            To <b>{order.customerEmail}</b>, from the shop's email address. It starts with “Hi {name || "…"},” and ends with a link to the order.
          </p>
          <Field label="Subject">
            <input className="input" maxLength={150} value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} />
          </Field>
          <Field label="Message">
            <textarea className="input min-h-36" autoFocus maxLength={5000} value={mail.message} onChange={(e) => setMail({ ...mail, message: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: order, isLoading, error, refetch } = useQuery({ queryKey: ["order", id], queryFn: () => adminApi.order(id) });

  // Opening an order marks it seen: refresh the bell and lists.
  useEffect(() => {
    if (order) {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={errorMessage(error)} retry={refetch} />;

  const a = order.shippingAddress || {};
  const address = [a.addressLine1, a.addressLine2, a.locality, a.city, a.district, a.state, a.pincode].filter(Boolean).join(", ");
  const phone = String(a.phone || "").replace(/\D/g, "").slice(-10);
  const copy = (text) => navigator.clipboard.writeText(text).then(() => toast.success("Copied"));

  return (
    <>
      <Link to="/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy print:hidden">
        <ArrowLeft className="size-4" /> Orders
      </Link>
      <PageHeader
        title={`Order ${order.orderNumber}`}
        subtitle={`Placed ${dateTime(order.createdAt)}`}
        actions={
          <>
            <OrderStatus status={order.orderStatus} />
            <PaymentStatus status={order.paymentStatus} method={order.paymentMethod} />
            <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
              <Printer className="size-4" /> Print
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-4 print:hidden">
            <h2 className="mb-3 text-sm font-semibold text-navy">Next step</h2>
            <StatusActions order={order} />
          </Card>

          <Card>
            <h2 className="px-4 pt-4 text-sm font-semibold text-navy">Items</h2>
            <ul className="divide-y divide-slate-100">
              {order.items.map((item, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" className="size-14 shrink-0 rounded-lg border border-slate-100 object-contain" />
                  ) : (
                    <div className="size-14 shrink-0 rounded-lg bg-slate-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <a href={`${STORE_URL}/products/${item.slug}`} target="_blank" rel="noreferrer" className="font-medium text-navy hover:text-brand">
                      {item.name}
                    </a>
                    <p className="text-xs text-slate-500">
                      {[item.brand, item.variantLabel, item.sku && `SKU ${item.sku}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <p className="font-medium">{money(item.total)}</p>
                    <p className="text-xs text-slate-500">
                      {item.quantity} × {money(item.price)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-slate-100 px-4 py-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{money(order.pricing.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Delivery</dt><dd className="tabular-nums">{order.pricing.shippingCharge ? money(order.pricing.shippingCharge) : "Free"}</dd></div>
              {order.pricing.discount > 0 && (
                <div className="flex justify-between"><dt className="text-slate-500">Discount</dt><dd className="tabular-nums">−{money(order.pricing.discount)}</dd></div>
              )}
              <div className="flex justify-between pt-1 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(order.pricing.total)}</dd></div>
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-navy">History</h2>
            <ol className="space-y-3 border-l-2 border-slate-100 pl-4">
              {[...order.statusHistory].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-brand ring-2 ring-white" />
                  <div className="flex flex-wrap items-center gap-2">
                    <OrderStatus status={h.status} />
                    <span className="text-xs text-slate-500">{dateTime(h.updatedAt)}</span>
                  </div>
                  {h.note && <p className="mt-0.5 text-sm text-slate-600">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-navy">Deliver to</h2>
            <p className="font-medium">{a.fullName}</p>
            <p className="mt-1 text-sm text-slate-600">{address}</p>
            <div className="mt-3 flex flex-wrap gap-2 print:hidden">
              <Button variant="secondary" className="!px-2.5 !py-1.5 text-xs" onClick={() => copy(`${a.fullName}\n${address}\n${a.phone}`)}>
                <Copy className="size-3.5" /> Copy address
              </Button>
            </div>
          </Card>
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-navy">Customer</h2>
            {order.user && (
              <Link to={`/customers/${order.user._id}`} className="font-medium text-brand hover:underline">
                {[order.user.firstName, order.user.lastName].filter(Boolean).join(" ") || order.user.email || order.user.phone}
              </Link>
            )}
            <p className="mt-1 text-sm text-slate-600">{a.phone}</p>
            <p className="text-sm text-slate-600">{order.customerEmail || order.contactEmail}</p>
            {(phone || order.customerEmail) && (
              <div className="mt-3 flex flex-wrap gap-2 print:hidden">
                {order.customerEmail && <EmailCustomer order={order} />}
                {phone && (
                <a href={`tel:+91${phone}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
                  <Phone className="size-3.5" /> Call
                </a>
                )}
                {phone && (
                <a
                  href={`https://wa.me/91${phone}?text=${encodeURIComponent(`Hello ${a.fullName}, this is Kreedum Sports about your order ${order.orderNumber}.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"
                >
                  <MessageCircle className="size-3.5" /> WhatsApp
                </a>
                )}
              </div>
            )}
            {order.customerEmails?.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-1 text-xs font-medium text-slate-500">Emails sent from here</p>
                <ul className="space-y-1.5">
                  {[...order.customerEmails].reverse().map((m, i) => (
                    <li key={i} className="text-xs">
                      <span className="font-medium text-navy">{m.subject}</span>
                      <span className="text-slate-400"> · {dateTime(m.at)}{m.by ? ` · ${m.by}` : ""}</span>
                      <p className="line-clamp-2 text-slate-500">{m.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
          {(order.shipment?.courier || order.shipment?.trackingId) && (
            <Card className="p-4 text-sm">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-navy">
                <Truck className="size-4" /> Shipment
              </h2>
              {order.shipment.courier && <p>{order.shipment.courier}</p>}
              {order.shipment.trackingId && (
                <p className="flex items-center gap-1 text-slate-600">
                  Tracking {order.shipment.trackingId}
                  <button className="rounded p-0.5 text-slate-400 hover:text-navy print:hidden" onClick={() => copy(order.shipment.trackingId)} title="Copy">
                    <Copy className="size-3.5" />
                  </button>
                </p>
              )}
              {order.shipment.trackingUrl && (
                <a href={order.shipment.trackingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-brand hover:underline print:hidden">
                  Track <ExternalLink className="size-3.5" />
                </a>
              )}
            </Card>
          )}
          <Card className="p-4 text-sm">
            <h2 className="mb-2 text-sm font-semibold text-navy">Payment</h2>
            <p>{order.paymentMethod === "COD" ? "Cash on delivery" : "Online (Cashfree)"}</p>
            {order.payment?.method && <p className="text-slate-500">Paid by {order.payment.method.replace(/_/g, " ")}</p>}
            {order.payment?.paidAt && <p className="text-slate-500">Paid {dateTime(order.payment.paidAt)}</p>}
            {order.payment?.paymentId && <p className="break-all text-xs text-slate-400">Cashfree payment {order.payment.paymentId}</p>}
            {order.payment?.refundStatus === "NOT_STARTED" && (
              <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-red-700">The automatic refund failed. Refund it from the Cashfree dashboard.</p>
            )}
          </Card>
          {order.notes && (
            <Card className="p-4 text-sm">
              <h2 className="mb-1 text-sm font-semibold text-navy">Customer's note</h2>
              <p className="text-slate-600">{order.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
