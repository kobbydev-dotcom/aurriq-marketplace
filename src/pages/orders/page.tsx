import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Link } from "react-router-dom";
import { Package, ArrowLeft, Clock, CheckCircle, Truck, XCircle, PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { formatDistanceToNow } from "date-fns";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
}

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  confirmed: { label: "Confirmed", icon: CheckCircle, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  shipped: { label: "Shipped", icon: Truck, color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  delivered: { label: "Delivered", icon: PackageCheck, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-red-500/10 text-red-400 border-red-500/20" },
} as const;

type OrderStatus = keyof typeof STATUS_CONFIG;

function OrderCard({
  order,
}: {
  order: {
    _id: string;
    _creationTime: number;
    quantity: number;
    priceAtPurchase: number;
    totalAmount: number;
    status: OrderStatus;
    buyerNote?: string;
    product: { _id: string; name: string; brand: string; images: string[] } | null;
    sellerName: string;
  };
}) {
  const cfg = STATUS_CONFIG[order.status];
  const Icon = cfg.icon;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="size-14 rounded-lg overflow-hidden bg-muted shrink-0">
            {order.product?.images[0] ? (
              <img src={order.product.images[0]} alt={order.product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="size-6 text-muted-foreground/30" />
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">
              {order.product?.brand ?? "—"}
            </p>
            {order.product ? (
              <Link to={`/product/${order.product._id}`} className="text-sm font-medium hover:text-primary transition-colors">
                {order.product.name}
              </Link>
            ) : (
              <p className="text-sm font-medium">Product removed</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Sold by {order.sellerName}</p>
          </div>
        </div>
        <Badge className={`text-xs shrink-0 flex items-center gap-1.5 border ${cfg.color}`}>
          <Icon className="size-3" />
          {cfg.label}
        </Badge>
      </div>

      <div className="flex items-center justify-between text-sm pt-2 border-t border-border/40">
        <div className="text-muted-foreground space-y-0.5">
          <p>Qty: {order.quantity} × {formatCurrency(order.priceAtPurchase)}</p>
          <p className="text-xs">{formatDistanceToNow(order._creationTime, { addSuffix: true })}</p>
        </div>
        <p className="font-semibold text-primary">{formatCurrency(order.totalAmount)}</p>
      </div>

      {order.buyerNote && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 italic">
          Note: {order.buyerNote}
        </p>
      )}
    </div>
  );
}

function OrdersInner() {
  const orders = useQuery(api.orders.getMyOrders, {});

  if (orders === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Package /></EmptyMedia>
          <EmptyTitle>No orders yet</EmptyTitle>
          <EmptyDescription>When you place an order it will appear here.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild size="sm">
            <Link to="/shop">Start Shopping</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <OrderCard
          key={order._id}
          order={{
            ...order,
            status: order.status as OrderStatus,
            quantity: (order as any).quantity ?? 1,
          } as any}
        />
      ))}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <>
      <Unauthenticated>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 text-center px-4">
          <p className="text-muted-foreground text-sm mb-2">Sign in to view your orders.</p>
          <div className="w-full flex justify-center">
            <SignInButton />
          </div>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </AuthLoading>
      <Authenticated>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors cursor-pointer">
            <ArrowLeft className="size-3.5" /> Back to Shop
          </Link>
          <h1 className="text-3xl font-light mb-8" style={{ fontFamily: "'Cormorant Garamond', serif" }}>My Orders</h1>
          <OrdersInner />
        </div>
      </Authenticated>
    </>
  );
}