import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList, MessageSquare, Package, ShoppingBag, UserRound, Eye, Heart, Users, Wallet } from "lucide-react";
import { api } from "../../../../convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { formatCurrency } from "@/lib/utils.ts";

function DashboardLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

function BuyerDashboardContent() {
  const user = useQuery(api.users.current);
  const orders = useQuery(api.orders.getMyOrders, {});
  const cartItems = useQuery(api.cart.getCartItems, {});
  const inbox = useQuery(api.messages.getInbox, {});
  const buyerAnalytics = useQuery((api.analytics as any).getBuyerAnalytics, {}) as any;

  if (user === undefined || orders === undefined || cartItems === undefined || inbox === undefined) {
    return <DashboardLoading />;
  }

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const unreadMessages = inbox.reduce((total, conversation) => total + conversation.unreadCount, 0);
  const activeOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length;
  const displayName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-primary">Your Aurriq space</p>
          <h1 className="mt-2 text-4xl font-light tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Welcome back, {displayName}.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Keep an eye on your orders, conversations, and next beauty find.
          </p>
        </div>
        <Button asChild className="w-fit gap-2">
          <Link to="/shop">Explore the marketplace <ArrowRight className="size-4" /></Link>
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Account overview">
        <Link to="/orders" className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50">
          <ClipboardList className="size-5 text-primary" />
          <p className="mt-5 text-2xl font-semibold">{activeOrders}</p>
          <p className="text-sm text-muted-foreground">Active orders</p>
        </Link>
        <Link to="/cart" className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50">
          <ShoppingBag className="size-5 text-primary" />
          <p className="mt-5 text-2xl font-semibold">{cartCount}</p>
          <p className="text-sm text-muted-foreground">Items in cart</p>
        </Link>
        <Link to="/messages" className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50">
          <MessageSquare className="size-5 text-primary" />
          <p className="mt-5 text-2xl font-semibold">{unreadMessages}</p>
          <p className="text-sm text-muted-foreground">Unread messages</p>
        </Link>
        <Link to="/profile" className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50">
          <UserRound className="size-5 text-primary" />
          <p className="mt-5 text-2xl font-semibold">{user?.isVerified ? "Verified" : "Ready"}</p>
          <p className="text-sm text-muted-foreground">Account status</p>
        </Link>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border/60 p-5">
          <div>
            <h2 className="text-xl font-medium" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Recent orders</h2>
            <p className="text-sm text-muted-foreground">Track your latest marketplace activity.</p>
          </div>
          <Button variant="ghost" size="sm" asChild><Link to="/orders">View all</Link></Button>
        </div>
        {orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <Package className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Your first order will appear here.</p>
            <Button variant="outline" size="sm" asChild><Link to="/shop">Start shopping</Link></Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {orders.slice(0, 4).map((order) => (
              <div key={order._id} className="flex items-center justify-between gap-4 p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {order.product?.images?.[0] ? <img src={order.product.images[0]} alt="" className="h-full w-full object-cover" /> : <Package className="m-3 size-5 text-muted-foreground/50" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{order.product?.name ?? "Product removed"}</p>
                    <p className="text-xs text-muted-foreground">Sold by {order.sellerName}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant="secondary" className="capitalize">{order.status.replace(/_/g, " ")}</Badge>
                  <p className="mt-1 text-xs font-medium text-primary">{formatCurrency(order.totalAmount)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Activity & insights */}
      {buyerAnalytics && (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-medium" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Your activity</h2>
            <p className="text-sm text-muted-foreground">A snapshot of how you shop on Aurriq.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <Wallet className="size-5 text-primary" />
              <p className="mt-5 text-2xl font-semibold">{formatCurrency(buyerAnalytics.totalSpent)}</p>
              <p className="text-sm text-muted-foreground">Total spent · {buyerAnalytics.itemsBought} items</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <Eye className="size-5 text-primary" />
              <p className="mt-5 text-2xl font-semibold">{buyerAnalytics.productsViewed}</p>
              <p className="text-sm text-muted-foreground">Products viewed</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <Heart className="size-5 text-primary" />
              <p className="mt-5 text-2xl font-semibold">{buyerAnalytics.wishlistCount}</p>
              <p className="text-sm text-muted-foreground">In your wishlist</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <Users className="size-5 text-primary" />
              <p className="mt-5 text-2xl font-semibold">{buyerAnalytics.followingCount}</p>
              <p className="text-sm text-muted-foreground">Following</p>
            </div>
          </div>

          {buyerAnalytics.recentlyViewed.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">Recently viewed</h3>
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4">
                {buyerAnalytics.recentlyViewed.map((p: any) => (
                  <Link key={p._id} to={`/product/${p._id}`} className="group shrink-0 w-36">
                    <div className="aspect-square rounded-xl overflow-hidden bg-muted border border-border mb-2">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center"><Package className="size-7 text-muted-foreground/30" /></div>
                      )}
                    </div>
                    <p className="truncate text-xs font-medium group-hover:text-primary transition-colors">{p.name}</p>
                    <p className="text-xs font-bold text-primary">{formatCurrency(p.promoPrice ?? p.originalPrice)}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function BuyerDashboardPage() {
  return (
    <>
      <Unauthenticated>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Your buyer dashboard awaits</h1>
          <p className="text-sm text-muted-foreground">Sign in to view orders, messages, and your marketplace activity.</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <AuthLoading><DashboardLoading /></AuthLoading>
      <Authenticated><BuyerDashboardContent /></Authenticated>
    </>
  );
}