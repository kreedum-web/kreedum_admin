import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Boxes, Mail, PackageCheck, PackageOpen, ShoppingCart, Truck } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { ago, money, number, shortMoney } from "../lib/format";
import { Card, ErrorBox, NewDot, OrderStatus, PageHeader, PaymentStatus, Spinner, Table } from "../components/ui";
import BarChart from "../components/BarChart";

function Stat({ label, value, sub }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-navy">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}

function ToDo({ to, icon: Icon, label, count, highlight }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-xl border p-3.5 transition hover:shadow-sm ${
        highlight && count ? "border-brand/40 bg-tint" : "border-slate-200 bg-white"
      }`}
    >
      <Icon className={`size-5 ${highlight && count ? "text-brand" : "text-slate-400"}`} />
      <span className="flex-1 text-sm text-slate-700">{label}</span>
      <span className="text-lg font-semibold tabular-nums text-navy">{count}</span>
    </Link>
  );
}

export default function HomePage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["overview"],
    queryFn: adminApi.overview,
    refetchInterval: 60_000,
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={errorMessage(error)} retry={refetch} />;

  const { today, last30Days, toDo, recentOrders, liveVisitors } = data;

  return (
    <>
      <PageHeader
        title="Home"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            {liveVisitors} {liveVisitors === 1 ? "person" : "people"} on the store right now
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales today" value={money(today.revenue)} sub={`${today.orders} order${today.orders === 1 ? "" : "s"}`} />
        <Stat label="Visitors today" value={number(today.visitors)} sub={`${number(today.pageViews)} pages viewed`} />
        <Stat label="Sales, last 30 days" value={money(last30Days.revenue)} sub={`${last30Days.orders} orders`} />
        <Stat label="New customers today" value={number(today.newCustomers)} sub={`${number(data.customersTotal)} in total`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-2.5">
          <h2 className="text-sm font-semibold text-navy">To do</h2>
          <ToDo to="/orders?status=NEW" icon={PackageOpen} label="New orders (not opened)" count={toDo.newOrders} highlight />
          <ToDo to="/orders?status=PENDING" icon={PackageCheck} label="Waiting for confirmation" count={toDo.toConfirm} highlight />
          <ToDo to="/orders?status=TO_SHIP" icon={Boxes} label="To pack & ship" count={toDo.toShip} />
          <ToDo to="/orders?status=IN_TRANSIT" icon={Truck} label="On the way" count={toDo.inTransit} />
          <ToDo to="/enquiries" icon={Mail} label="New enquiries" count={toDo.newEnquiries} highlight />
          <ToDo to="/carts?idle=24" icon={ShoppingCart} label="Carts waiting over a day" count={toDo.openCarts || 0} />
          <ToDo to="/products?stock=out_of_stock&state=live" icon={Boxes} label="Live products out of stock" count={toDo.outOfStock} />
        </div>

        <Card className="p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-navy">Sales per day, last 30 days</h2>
          <p className="mb-3 text-xs text-slate-500">Placed orders, not counting cancelled or returned ones</p>
          <BarChart
            data={last30Days.byDay}
            valueKey="revenue"
            format={money}
            axisFormat={shortMoney}
            detail={(d) => `${d.orders} order${d.orders === 1 ? "" : "s"}`}
            label="Sales per day, last 30 days"
          />
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold text-navy">Latest orders</h2>
          <Link to="/orders" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
            All orders <ArrowRight className="size-4" />
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="px-4 pb-6 text-sm text-slate-500">No orders yet. New ones will appear here and pop up wherever you are in the dashboard.</p>
        ) : (
          <Table head={["Order", "Customer", "Status", "Payment", { label: "Total", right: true }]}>
            {recentOrders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link to={`/orders/${o.id}`} className="font-medium text-brand hover:underline">
                    {o.orderNumber}
                  </Link>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    {ago(o.createdAt)} {o.isNew && <NewDot />}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {o.customer}
                  <div className="text-xs text-slate-500">{o.city}</div>
                </td>
                <td className="px-4 py-2.5"><OrderStatus status={o.orderStatus} /></td>
                <td className="px-4 py-2.5"><PaymentStatus status={o.paymentStatus} method={o.paymentMethod} /></td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{money(o.total)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
