import axios from "axios";

export const TOKEN_KEY = "kreedum_admin_token";
export const SIGNED_OUT_EVENT = "kreedum-admin:signed-out";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const isLogin = /\/auth\/login/.test(error.config?.url || "");
    if ((status === 401 || status === 403) && !isLogin) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
    }
    return Promise.reject(error);
  }
);

/** The message the API sent, or a plain fallback. */
export const errorMessage = (error) =>
  error?.response?.data?.message || (error?.code === "ECONNABORTED" ? "The server took too long. Try again." : "Couldn't reach the server.");

const data = (res) => res.data.data;

export const adminApi = {
  me: () => api.get("/admin/me").then(data),
  overview: () => api.get("/admin/overview").then(data),
  traffic: (days) => api.get("/admin/traffic", { params: { days } }).then(data),

  orders: (params) => api.get("/admin/orders", { params }).then(data),
  orderFeed: () => api.get("/admin/orders/feed").then(data),
  markAllSeen: () => api.post("/admin/orders/seen").then(data),
  order: (id) => api.get(`/admin/orders/${id}`).then(data),
  setOrderStatus: (id, body) => api.patch(`/admin/orders/${id}/status`, body).then(data),

  products: (params) => api.get("/admin/products", { params }).then(data),
  product: (id) => api.get(`/admin/products/${id}`).then(data),
  createProduct: (body) => api.post("/admin/products", body).then(data),
  updateProduct: (id, body) => api.patch(`/admin/products/${id}`, body).then(data),
  deleteProduct: (id) => api.delete(`/admin/products/${id}`).then(data),
  addProductImage: (id, body) => api.post(`/admin/products/${id}/images`, body).then(data),
  resetProduct: (id) => api.post(`/admin/products/${id}/reset`).then(data),
  brands: () => api.get("/admin/brands").then(data),
  updateBrand: (slug, body) => api.patch(`/admin/brands/${slug}`, body).then(data),

  categories: () => api.get("/admin/categories").then(data),
  createCategory: (body) => api.post("/admin/categories", body).then(data),
  updateCategory: (slug, body) => api.patch(`/admin/categories/${slug}`, body).then(data),
  deleteCategory: (slug) => api.delete(`/admin/categories/${slug}`).then(data),
  resetCategory: (slug) => api.post(`/admin/categories/${slug}/reset`).then(data),

  content: (kind) => api.get(`/admin/content/${kind}`).then(data),
  addContent: (kind, body) => api.post(`/admin/content/${kind}`, body).then(data),
  updateContent: (kind, id, body) => api.patch(`/admin/content/${kind}/${id}`, body).then(data),
  deleteContent: (kind, id) => api.delete(`/admin/content/${kind}/${id}`).then(data),
  reorderContent: (kind, ids) => api.put(`/admin/content/${kind}/order`, { ids }).then(data),

  customers: (params) => api.get("/admin/customers", { params }).then(data),
  customer: (id) => api.get(`/admin/customers/${id}`).then(data),
  setCustomerActive: (id, isActive) => api.patch(`/admin/customers/${id}`, { isActive }).then(data),
  notifications: () => api.get("/admin/notifications").then(data),
  markNotificationsRead: (id) => api.post("/admin/notifications/read", id ? { id } : {}).then(data),
  clearNotifications: () => api.delete("/admin/notifications").then(data),

  carts: (params) => api.get("/admin/carts", { params }).then(data),
  cartDetail: (userId) => api.get(`/admin/carts/${userId}`).then(data),
  addFollowUp: (userId, body) => api.post(`/admin/carts/${userId}/follow-ups`, body).then(data),

  enquiries: (params) => api.get("/admin/enquiries", { params }).then(data),
  setEnquiryStatus: (id, status) => api.patch(`/admin/enquiries/${id}`, { status }).then(data),
};

export default api;
