import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react"; // 1. Import these
import { DefaultProviders } from "./components/providers/default.tsx";
// ... (keep all your other imports)

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        {/* 2. Add AuthLoading to prevent flickering/loops while checking status */}
        <AuthLoading>
          <div className="flex h-screen w-full items-center justify-center bg-[#0A0600] text-[#C9930A]">
            Loading...
          </div>
        </AuthLoading>

        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/admin/sso" element={<SSOLandingPage />} />
          
          {/* Protected Routes (Wrapped in Authenticated) */}
          <Route element={<AuthenticatedWrapper />}>
            <Route element={<AppLayout />}>
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/seller/dashboard" element={<SellerDashboardPage />} />
              <Route path="/product/:productId" element={<ProductDetailPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </DefaultProviders>
  );
}

// 3. Create a helper component to force redirect
import { Outlet, Navigate } from "react-router-dom";

function AuthenticatedWrapper() {
  return (
    <Authenticated>
      <Outlet />
    </Authenticated>
  );
}