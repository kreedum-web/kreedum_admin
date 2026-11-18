export const STORE_URL = import.meta.env.VITE_STORE_URL || "https://shop.kreedum.com";

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const money = (n) => rupees.format(Number(n) || 0);
export const number = (n) => new Intl.NumberFormat("en-IN").format(Number(n) || 0);

/** ₹1.2L, ₹15K: for chart axes. */
export const shortMoney = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${+(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `₹${+(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `₹${+(v / 1e3).toFixed(1)}K`;
  return `₹${v}`;
};

const TZ = { timeZone: "Asia/Kolkata" };
export const dateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { ...TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";
export const date = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { ...TZ, day: "numeric", month: "short", year: "numeric" }) : "—";
export const dayLabel = (day) =>
  new Date(`${day}T12:00:00+05:30`).toLocaleDateString("en-IN", { ...TZ, day: "numeric", month: "short" });

/** "5 min ago" */
export const ago = (d) => {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return date(d);
};

export const ORDER_STATUS = {
  AWAITING_PAYMENT: { label: "Awaiting payment", tone: "gray" },
  PENDING: { label: "New – to confirm", tone: "amber" },
  CONFIRMED: { label: "Confirmed", tone: "blue" },
  PACKED: { label: "Packed", tone: "blue" },
  SHIPPED: { label: "Shipped", tone: "indigo" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", tone: "indigo" },
  DELIVERED: { label: "Delivered", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "red" },
  RETURNED: { label: "Returned", tone: "red" },
};

export const PAYMENT_STATUS = {
  PENDING: { label: "Not paid yet", tone: "amber" },
  PAID: { label: "Paid", tone: "green" },
  FAILED: { label: "Payment failed", tone: "red" },
  REFUND_INITIATED: { label: "Refund in progress", tone: "amber" },
  REFUNDED: { label: "Refunded", tone: "gray" },
};

export const STOCK = {
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  enquiry_only: "Enquiry only",
  preorder: "Pre-order",
};

/** Read a chosen file as data:image/…;base64 (what the API accepts). */
export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
