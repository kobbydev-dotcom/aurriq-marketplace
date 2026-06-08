import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import AppLayout from "./pages/_components/AppLayout.tsx";

// ---- IMPORT ALL YOUR REAL MARKETPLACE PAGES ----
import HomePage from "./pages/Index.tsx";
import ShopPage from "./pages/shop/page.tsx";
import CartPage from "./pages/cart/page.tsx";
import OrdersPage from "./pages/orders/page.tsx";
import MessagesPage from "./pages/messages/page.tsx";
import ProductDetailPage from "./pages/product/[productId]/page.tsx";
import NotFoundPage from "./pages/NotFound.tsx";

// 1. Import your secure SSO Gatekeeper Page
import { SSOLandingPage } from "./pages/admin/SSOLandingPage.tsx";

// 2. Import your REAL Seller Dashboard
import SellerDashboardPage from "./pages/seller/dashboard/page.tsx";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          {/* Outer layout container with top bar */}
          <Route element={<AppLayout />}>
            {/* Main Marketplace Content Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/product/:productId" element={<ProductDetailPage />} />
          </Route>

          {/* ========================================================= */}
          {/* THE SINGLE SIGN-ON RECEPTIONIST GATEWAY ROUTE             */}
          {/* ========================================================= */}
          <Route path="/admin/sso" element={<SSOLandingPage key={Date.now()} />} />

          {/* ========================================================= */}
          {/* REAL SELLER WORKSPACE ROUTE                              */}
          {/* ========================================================= */}
          <Route path="/seller/dashboard" element={<SellerDashboardPage />} />

          {/* Catch-all 404 page */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}