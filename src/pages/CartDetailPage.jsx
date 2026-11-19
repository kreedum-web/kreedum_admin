import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft, Mail, MessageCircle, Phone } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { ago, date, dateTime, money, STORE_URL } from "../lib/format";
import { Badge, Button, Card, Empty, ErrorBox, Field, OrderStatus, PageHeader, Spinner } from "../components/ui";

const CHANNELS = { call: "Call", whatsapp: "WhatsApp", email: "Email", other: "Other" };

/** Ready-to-send WhatsApp messages (opened in your own WhatsApp, edit before sending). */
function messages(name, cart, wishlist) {
  const hello = `Hello${name ? ` ${name.split(" ")[0]}` : ""}, this is Kreedum Sports.`;
  const list = (items) => items.slice(0, 3).map((i) => `• ${i.name}${i.option ? ` (${i.option})` : ""}`).join("\n");
  return {
    cart: [
      hello,
      "",
      "We noticed you left these in your cart:",
      list(cart.items),
      "",
      `Complete your order here: ${STORE_URL}/cart`,
      "Any questions about the products, delivery or payment? Just reply here and we'll help.",
    ].join("\n"),
    wishlist: [
      hello,
      "",
      "You saved these to your wishlist:",
      list(wishlist.items),
      "",
      "Would you like help choosing, or a quote? Just reply here.",
      `${STORE_URL}/wishlist`,
    ].join("\n"),
  };
}

function Items({ items, cart }) {
  if (!items.length) return <Empty title={cart ? "Cart is empty" : "Wishlist is empty"} />;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((i) => (
        <li key={`${i.productId}-${i.option}`} className="flex items-center gap-3 px-4 py-3">
          {i.thumbnail ? (
            <img src={i.thumbnail} alt="" className="size-14 shrink-0 rounded-lg border border-slate-100 object-contain" />
          ) : (
            <div className="size-14 shrink-0 rounded-lg bg-slate-100" />
          )}
          <div className="min-w-0 flex-1">
            <a href={`${STORE_URL}/products/${i.slug}`} target="_blank" rel="noreferrer" className="font-medium text-navy hover:text-brand">
              {i.name}
            </a>
            <p className="text-xs text-slate-500">
              {[i.option, `added ${ago(i.addedAt)}`].filter(Boolean).join(" · ")}
              {!i.available && <Badge tone="red" className="ml-2">Not available now</Badge>}
            </p>
          </div>
          <div className="text-right text-sm tabular-nums">
            <p className="font-medium">{money(cart ? i.total : i.price)}</p>
            {cart && i.quantity > 1 && <p className="text-xs text-slate-500">{i.quantity} × {money(i.price)}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function CartDetailPage() {
  const { userId } = useParams();
  const [params] = useSearchParams();
  const from = params.get("from") === "wishlist" ? "wishlist" : "cart";
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState("call");
  const [about, setAbout] = useState(from);

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["cart", userId], queryFn: () => adminApi.cartDetail(userId) });

  const save = useMutation({
    mutationFn: () => adminApi.addFollowUp(userId, { note, channel, about }),
    onSuccess: (d) => {
      queryClient.setQueryData(["cart", userId], d);
      queryClient.invalidateQueries({ queryKey: ["carts"] });
      setNote("");
      toast.success("Note saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={errorMessage(error)} retry={refetch} />;

  const { customer: c, cart, wishlist, orders, followUps } = data;
  const phone = String(c.phone || "").replace(/\D/g, "").slice(-10);
  const text = messages(c.name, cart, wishlist);

  return (
    <>
      <Link to={`/carts${from === "wishlist" ? "?type=wishlist" : ""}`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy">
        <ArrowLeft className="size-4" /> Carts & wishlists
      </Link>
      <PageHeader
        title={c.name || c.email || c.phone}
        subtitle={`Customer since ${date(c.createdAt)}${c.lastLoginAt ? ` · last signed in ${ago(c.lastLoginAt)}` : ""}`}
        actions={
          <Link to={`/customers/${c.id}`} className="text-sm font-medium text-brand hover:underline">
            Customer page
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className="text-sm font-semibold text-navy">Cart</h2>
              <span className="text-sm font-semibold tabular-nums">{money(cart.value)}</span>
            </div>
            <Items items={cart.items} cart />
          </Card>
          <Card>
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className="text-sm font-semibold text-navy">Wishlist</h2>
              <span className="text-sm text-slate-500">{wishlist.items.length} product{wishlist.items.length === 1 ? "" : "s"}</span>
            </div>
            <Items items={wishlist.items} />
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-navy">Follow-up notes</h2>
            <div className="space-y-3">
              <textarea
                className="input"
                rows={2}
                placeholder="e.g. Called, wants the 10 kg set in black, will order Friday"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
              />
              <div className="flex flex-wrap items-end gap-2">
                <Field label="How">
                  <select className="input !w-auto" value={channel} onChange={(e) => setChannel(e.target.value)}>
                    {Object.entries(CHANNELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </Field>
                <Field label="About">
                  <select className="input !w-auto" value={about} onChange={(e) => setAbout(e.target.value)}>
                    <option value="cart">Cart</option>
                    <option value="wishlist">Wishlist</option>
                    <option value="general">General</option>
                  </select>
                </Field>
                <Button disabled={!note.trim()} loading={save.isPending} onClick={() => save.mutate()}>
                  Save note
                </Button>
              </div>
            </div>
            {followUps.length > 0 && (
              <ol className="mt-4 space-y-3 border-l-2 border-slate-100 pl-4">
                {followUps.map((f) => (
                  <li key={f.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-brand ring-2 ring-white" />
                    <p className="text-xs text-slate-500">
                      {dateTime(f.createdAt)} · {CHANNELS[f.channel]} · {f.about}
                      {f.by && ` · ${f.by}`}
                    </p>
                    <p className="text-sm text-slate-700">{f.note}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-navy">Contact</h2>
            {c.phone && <p className="text-sm">{c.phone}</p>}
            {c.email && <p className="break-all text-sm">{c.email}</p>}
            <div className="flex flex-col gap-2">
              {phone && (
                <>
                  {cart.items.length > 0 && (
                    <a
                      href={`https://wa.me/91${phone}?text=${encodeURIComponent(text.cart)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      <MessageCircle className="size-4" /> WhatsApp: complete your purchase
                    </a>
                  )}
                  {wishlist.items.length > 0 && (
                    <a
                      href={`https://wa.me/91${phone}?text=${encodeURIComponent(text.wishlist)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                    >
                      <MessageCircle className="size-4" /> WhatsApp about wishlist
                    </a>
                  )}
                  <a href={`tel:+91${phone}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
                    <Phone className="size-4" /> Call
                  </a>
                </>
              )}
              {c.email && (
                <a
                  href={`mailto:${c.email}?subject=${encodeURIComponent("Your Kreedum Sports cart")}&body=${encodeURIComponent(text.cart)}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  <Mail className="size-4" /> Email
                </a>
              )}
            </div>
            <p className="text-xs text-slate-400">WhatsApp opens in your own WhatsApp with the message ready. You can edit it before sending.</p>
          </Card>
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-navy">Recent orders</h2>
            {orders.length === 0 ? (
              <p className="text-sm text-slate-500">Never ordered.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2">
                    <Link to={`/orders/${o.id}`} className="font-medium text-brand hover:underline">{o.orderNumber}</Link>
                    <OrderStatus status={o.orderStatus} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
