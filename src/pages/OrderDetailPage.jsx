import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft, Copy, MessageCircle, Phone, Printer } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { dateTime, money, ORDER_STATUS, STORE_URL } from "../lib/format";
import { Button, Card, ErrorBox, Field, Modal, OrderStatus, PageHeader, PaymentStatus, Spinner } from "../components/ui";

const ACTION_LABEL = {
  CONFIRMED: "Confirm order",
  PACKED: "Mark packed",
  SHIPPED: "Mark shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Mark delivered",
  CANCELLED: "Cancel order",
  RETURNED: "Mark returned",
};

function StatusActions({ order }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(null);
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: ({ status, note }) => adminApi.setOrderStatus(order.id, { status, note }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["order", order.id], updated);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(`Order is now: ${ORDER_STATUS[updated.orderStatus]?.label || updated.orderStatus}`);
      setConfirming(null);
      setNote("");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const next = order.nextStatuses || [];
  if (!next.length) return <p className="text-sm text-slate-500">This order is closed. Its status can't change any more.</p>;

  // The usual next step is the big button; skipping ahead and cancelling are smaller.
  const [main, ...rest] = next;
  const destructive = (s) => s === "CANCELLED" || s === "RETURNED";
  const paidOnline = order.paymentMethod === "ONLINE" && order.paymentStatus === "PAID";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant={destructive(main) ? "danger" : "primary"} onClick={() => setConfirming(main)}>
          {ACTION_LABEL[main]}
        </Button>
        {rest.map((s) => (
          <Button key={s} variant={destructive(s) ? "ghost" : "secondary"} className={destructive(s) ? "!text-red-600" : ""} onClick={() => setConfirming(s)}>
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
              onClick={() => mutation.mutate({ status: confirming, note })}
            >
              {ACTION_LABEL[confirming]}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">
          {order.orderNumber} will show as <b>{ORDER_STATUS[confirming]?.label}</b> to the customer.
          {confirming === "CANCELLED" && " The customer gets a cancellation email."}
          {destructive(confirming) && paidOnline && ` They paid online, so ${money(order.pricing.total)} is refunded to them through Cashfree.`}
          {confirming === "DELIVERED" && order.paymentMethod === "COD" && " The cash payment is marked as collected."}
        </p>
        <Field label="Note for the order history (optional)" hint={confirming === "SHIPPED" ? "e.g. courier name and tracking number" : undefined}>
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
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
            <p className="text-sm text-slate-600">{order.contactEmail}</p>
            {phone && (
              <div className="mt-3 flex flex-wrap gap-2 print:hidden">
                <a href={`tel:+91${phone}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
                  <Phone className="size-3.5" /> Call
                </a>
                <a
                  href={`https://wa.me/91${phone}?text=${encodeURIComponent(`Hello ${a.fullName}, this is Kreedum Sports about your order ${order.orderNumber}.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"
                >
                  <MessageCircle className="size-3.5" /> WhatsApp
                </a>
              </div>
            )}
          </Card>
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
