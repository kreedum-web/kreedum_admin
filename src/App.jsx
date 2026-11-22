import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import ProductsPage from "./pages/ProductsPage";
import ProductEditPage from "./pages/ProductEditPage";
import ProductNewPage from "./pages/ProductNewPage";
import BrandsPage from "./pages/BrandsPage";
import CategoriesPage from "./pages/CategoriesPage";
import ContentPage from "./pages/ContentPage";
import CustomersPage from "./pages/CustomersPage";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import EnquiriesPage from "./pages/EnquiriesPage";
import TrafficPage from "./pages/TrafficPage";
import NotificationsPage from "./pages/NotificationsPage";
import CartsPage from "./pages/CartsPage";
import CartDetailPage from "./pages/CartDetailPage";

export default function App() {
  const { admin, checking } = useAuth();
  if (checking) return <Spinner className="min-h-screen" />;
  if (!admin) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/new" element={<ProductNewPage />} />
        <Route path="products/:id" element={<ProductEditPage />} />
        <Route path="brands" element={<BrandsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="content" element={<ContentPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="enquiries" element={<EnquiriesPage />} />
        <Route path="traffic" element={<TrafficPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="carts" element={<CartsPage />} />
        <Route path="carts/:userId" element={<CartDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
