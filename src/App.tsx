import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import AppLayout from "./pages/_components/AppLayout.tsx";

import HomePage from "./pages/Index.tsx";
import ShopPage from "./pages/shop/page.tsx";
import CartPage from "./pages/cart/page.tsx";
import OrdersPage from "./pages/orders/page.tsx";
import MessagesPage from "./pages/messages/page.tsx";
import ProductDetailPage from "./pages/product/[productId]/page.tsx";
import NotFoundPage from "./pages/NotFound.tsx";

import SSOLandingPage from "./pages/admin/SSOLandingPage.tsx";
import SellerDashboardPage from "./pages/seller/dashboard/page.tsx";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/product/:productId" element={<ProductDetailPage />} />
          </Route>

          <Route path="/admin/sso" element={<SSOLandingPage />} />
          <Route path="/seller/dashboard" element={<SellerDashboardPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
