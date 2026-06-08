import { Outlet, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

export default function AppLayout() {
  const user = useQuery(api.users.getCurrentUser, {});
  const cartItems = useQuery(api.cart.getCartItems, {});
  const unread = useQuery(api.messages.getUnreadCount, {});

  const cartCount = cartItems?.length ?? 0;
  const unreadCount = unread ?? 0;

  return (
    <div>
      {/* TOP BAR */}
      <div
        style={{
          padding: 12,
          borderBottom: "1px solid #ddd",
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <h2>AURRIQ</h2>

        <Link to="/">Home</Link>
        <Link to="/shop">Shop</Link>
        <Link to="/cart">Cart ({cartCount})</Link>
        <Link to="/orders">Orders</Link>

        <Link to="/messages">Messages ({unreadCount})</Link>

        {/* USER AREA */}
        <div style={{ marginLeft: "auto" }}>
          {user === undefined && "Loading..."}
          {user === null && "Not logged in"}
          {user && `Hi, ${user.name ?? "User"}`}
        </div>
      </div>

      <main>
        <Outlet />
      </main>
    </div>
  );
}