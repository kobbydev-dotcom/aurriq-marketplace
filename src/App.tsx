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
import AuthPage from "./pages/auth/page.tsx"; // Linked your brand new auth page

import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          {/* Home page gets its own luxury header — NOT inside AppLayout */}
          <Route path="/" element={<HomePage />} />

          {/* All inner app pages use AppLayout's navbar */}
          <Route element={<AppLayout />}>
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/product/:productId" element={<ProductDetailPage />} />
          </Route>

          {/* Registered Auth route to handle your incoming sign-ins */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/admin/sso" element={<SSOLandingPage />} />
          <Route path="/seller/dashboard" element={<SellerDashboardPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </DefaultProviders>
  );
}