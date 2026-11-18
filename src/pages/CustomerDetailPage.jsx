import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import { adminApi, errorMessage } from "../lib/api";
import { date, dateTime, money } from "../lib/format";
import { Badge, Button, Card, Empty, ErrorBox, OrderStatus, PageHeader, PaymentStatus, Spinner, Table } from "../components/ui";

export default function CustomerDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: c, isLoading, error, refetch } = useQuery({ queryKey: ["customer", id], queryFn: () => adminApi.customer(id) });

  const setActive = useMutation({
    mutationFn: (isActive) => adminApi.setCustomerActive(id, isActive),
    onSuccess: (updated) => {
      queryClient.setQueryData(["customer", id], updated);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(updated.isActive ? "Account enabled" : "Account disabled: they can't sign in");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={errorMessage(error)} retry={refetch} />;

  return (
    <>
      <Link to="/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy">
        <ArrowLeft className="size-4" /> Customers
      </Link>
      <PageHeader
        title={c.name || c.email || c.phone}
        subtitle={`Customer since ${date(c.createdAt)}${c.lastLoginAt ? ` · last signed in ${dateTime(c.lastLoginAt)}` : ""}`}
        actions={
          <>
            {!c.isActive && <Badge tone="red">Disabled</Badge>}
            <Button
              variant={c.isActive ? "secondary" : "primary"}
              loading={setActive.isPending}
              onClick={() => (!c.isActive || confirm("Disable this account? They won't be able to sign in or order.")) && setActive.mutate(!c.isActive)}
            >
              {c.isActive ? "Disable account" : "Enable account"}
            </Button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-slate-500">Email</p><p className="truncate font-medium">{c.email || "—"}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Phone</p><p className="font-medium">{c.phone || "—"}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Orders</p><p className="text-xl font-semibold">{c.orders}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Total spent</p><p className="text-xl font-semibold">{money(c.spent)}</p></Card>
      </div>
      <Card>
        <h2 className="px-4 pt-4 text-sm font-semibold text-navy">Orders</h2>
        <OrdersTable orders={c.orderHistory} />
      </Card>
    </>
  );
}

function OrdersTable({ orders }) {
  if (!orders.length) return <Empty title="No orders yet" />;
  return (
    <Table head={["Order", "Date", "Status", "Payment", { label: "Total", right: true }]}>
      {orders.map((o) => (
        <tr key={o.id} className="hover:bg-slate-50">
          <td className="px-4 py-2.5"><Link to={`/orders/${o.id}`} className="font-medium text-brand hover:underline">{o.orderNumber}</Link></td>
          <td className="px-4 py-2.5 text-slate-600">{dateTime(o.createdAt)}</td>
          <td className="px-4 py-2.5"><OrderStatus status={o.orderStatus} /></td>
          <td className="px-4 py-2.5"><PaymentStatus status={o.paymentStatus} method={o.paymentMethod} /></td>
          <td className="px-4 py-2.5 text-right font-medium tabular-nums">{money(o.total)}</td>
        </tr>
      ))}
    </Table>
  );
}
