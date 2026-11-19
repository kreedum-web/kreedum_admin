import { Building2, Mail, MessageCircle, MessageSquareText, ShoppingBag, XCircle } from "lucide-react";

/** How each kind of notification looks (icon + colours). */
export const NOTIFICATION_TYPES = {
  NEW_ORDER: { label: "New order", icon: ShoppingBag, tint: "bg-tint text-brand" },
  ORDER_CANCELLED: { label: "Cancelled by customer", icon: XCircle, tint: "bg-red-50 text-red-600" },
  BULK_ENQUIRY: { label: "Bulk enquiry", icon: Building2, tint: "bg-amber-50 text-amber-700" },
  CONTACT_ENQUIRY: { label: "Contact form", icon: Mail, tint: "bg-indigo-50 text-indigo-600" },
  PRODUCT_ENQUIRY: { label: "Product enquiry", icon: MessageSquareText, tint: "bg-emerald-50 text-emerald-700" },
  WHATSAPP_ENQUIRY: { label: "WhatsApp chat", icon: MessageCircle, tint: "bg-emerald-50 text-emerald-700" },
};

export const typeOf = (type) => NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.NEW_ORDER;
