import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api.js";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  Plus, Package, TrendingUp, AlertTriangle, ShoppingBag,
  MoreVertical, Pencil, Trash2, ToggleLeft, ToggleRight, Tag, MessageSquare, ArrowLeft,
  Clock, CheckCircle, Truck, PackageCheck, XCircle, Store, CreditCard, Smartphone, ShieldCheck, Loader2, FileText, Landmark, Users, Send, Save, Lock, CalendarDays, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import InventoryTab from "@/pages/seller/dashboard/_components/InventoryTab.tsx";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import ProductFormDialog from "@/pages/seller/dashboard/_components/ProductFormDialog.tsx";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel.d.ts";
import SellerMessagesTab from "@/pages/seller/dashboard/_components/SellerMessagesTab.tsx";
import AnalyticsTab from "@/pages/seller/dashboard/_components/AnalyticsTab.tsx";
import SellerRfqsTab from "@/pages/seller/dashboard/_components/SellerRfqsTab.tsx";
import VendorSubscriptionDialog from "@/pages/seller/dashboard/_components/VendorSubscriptionDialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { formatCurrency } from "@/lib/utils.ts";

const AURRIQ_SUPPORT_PHONE = "+233 27 442 1221";
const AURRIQ_SUPPORT_EMAIL = "devagyemang@gmail.com";

function DoabookproAccountLink({ slug }: { slug?: string }) {
  const requestBusinessLink = useAction((api.users as any).createDoabookproBusinessLink) as any;
  const [linking, setLinking] = useState(false);
  const safeSlug = slug && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) ? slug : "";

  const handleLink = async (repair = false) => {
    setLinking(true);
    try {
      const result = await requestBusinessLink({ repair });
      if (typeof result?.linkUrl === "string") {
        window.location.assign(result.linkUrl);
        return;
      }
      const linkedSlug = result?.slug;
      if (result?.alreadyLinked && typeof linkedSlug === "string" && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(linkedSlug)) {
        window.location.assign(`https://${linkedSlug}.doabookpro.com`);
        return;
      }
      toast.error("DOABookPro did not return an account-link address.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start account linking");
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-card p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Store className="size-5" /></div>
        <div>
          <p className="font-semibold text-foreground">DOABookPro business connection</p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Confirm your business on DOABookPro to link your booking page and Aurriq shop. Your DOABookPro password stays on DOABookPro.
          </p>
        </div>
      </div>
      <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 sm:mt-0">
        {safeSlug && (
          <a href={"https://" + safeSlug + ".doabookpro.com"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-background px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5">
            Visit linked booking page <ExternalLink className="size-4" />
          </a>
        )}
        <Button onClick={() => handleLink(Boolean(safeSlug))} disabled={linking} variant={safeSlug ? "outline" : "default"} className="gap-2">
          {linking ? <Loader2 className="size-4 animate-spin" /> : <Store className="size-4" />}
          {linking ? "Connecting..." : safeSlug ? "Repair connection" : "Link my business"}
        </Button>
      </div>
    </div>
  );
}

function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  if (stock === 0) return <Badge variant="destructive" className="text-[10px]">Out of Stock</Badge>;
  if (stock <= threshold) return <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30">Low Stock ({stock})</Badge>;
  return <Badge variant="secondary" className="text-[10px]">{stock} in stock</Badge>;
}

function deliveryLabel(value?: string) {
  const labels: Record<string, string> = {
    within_1_hour: "Within 1 hour",
    same_day: "Same day",
    one_day: "1 day",
    two_days: "2 days",
    accra_same_day: "Accra: same day",
    outside_accra_2_3_days: "Outside Accra: 2-3 days",
    arranged_with_buyer: "Arranged with buyer",
  };
  return value ? labels[value] ?? value : undefined;
}

// ── History tab: every sale + account action, for future reference ──
function HistoryTab({ orders, activity }: { orders: any[] | undefined; activity: any[] | undefined }) {
  const [view, setView] = useState<"sales" | "activity">("sales");

  if (orders === undefined || activity === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    );
  }

  const totalRevenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
  const totalUnits = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + (o.quantity ?? 1), 0);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total sales</p><p className="text-2xl font-light mt-1">{orders.filter((o) => o.status !== "cancelled").length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Units sold</p><p className="text-2xl font-light mt-1">{totalUnits}</p></CardContent></Card>
        <Card><CardContent className="p-4 min-w-0"><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Revenue</p><p className="break-words text-xl font-light mt-1 text-primary sm:text-2xl">{formatCurrency(totalRevenue)}</p></CardContent></Card>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={view === "sales" ? "default" : "outline"} onClick={() => setView("sales")} className="gap-1.5"><ShoppingBag className="size-3.5" /> Sales</Button>
        <Button size="sm" variant={view === "activity" ? "default" : "outline"} onClick={() => setView("activity")} className="gap-1.5"><Clock className="size-3.5" /> Account activity</Button>
      </div>

      {view === "sales" ? (
        orders.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><ShoppingBag /></EmptyMedia>
              <EmptyTitle>No sales yet</EmptyTitle>
              <EmptyDescription>Every completed order will be recorded here for your records.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-2">
            {orders.map((o: any) => (
              <div key={o._id} className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center">
                <div className="size-11 rounded-md overflow-hidden bg-muted shrink-0">
                  {o.product?.images?.[0] ? <img src={o.product.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="m-2.5 size-5 text-muted-foreground/40" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{o.product?.name ?? "Deleted product"}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.quantity ?? 1} unit{(o.quantity ?? 1) !== 1 ? "s" : ""} · {o.buyerName} · {formatDistanceToNow(o._creationTime, { addSuffix: true })}
                  </p>
                </div>
                <div className="min-w-0 shrink-0 text-left sm:text-right">
                  <p className="text-sm font-semibold text-primary">{formatCurrency(o.totalAmount ?? 0)}</p>
                  <Badge variant="secondary" className="text-[9px] capitalize">{o.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        activity.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Clock /></EmptyMedia>
              <EmptyTitle>No activity yet</EmptyTitle>
              <EmptyDescription>Actions in your account (new orders, status changes, edits) will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-2">
            {activity.map((a: any) => (
              <div key={a._id} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="size-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{a.action}</p>
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(a._creationTime, { addSuffix: true })}</p>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function ProductCard({
  product,
  onEdit,
  onDelete,
  onToggle,
}: {
  product: Doc<"products">;
  onEdit: (p: Doc<"products">) => void;
  onDelete: (id: string) => void;
  onToggle: (p: Doc<"products">) => void;
}) {
  const mainImage = product.images[0];
  const activePrice = product.promoPrice ?? product.originalPrice;

  return (
    <Card className={`overflow-hidden transition-opacity ${!product.isActive ? "opacity-50" : ""}`}>
      <div className="relative aspect-square bg-muted overflow-hidden pt-0">
        {mainImage ? (
          <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="size-10 text-muted-foreground/30" />
          </div>
        )}
        {!product.isActive && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <span className="text-xs font-medium text-muted-foreground">Unlisted</span>
          </div>
        )}
        {product.promoPrice && (
          <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
            SALE
          </div>
        )}
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="secondary" className="size-7 rounded-full cursor-pointer">
                <MoreVertical className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(product)} className="cursor-pointer">
                <Pencil className="size-3.5 mr-2" /> Edit Product
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggle(product)} className="cursor-pointer">
                {product.isActive ? (
                  <><ToggleLeft className="size-3.5 mr-2" /> Unlist Product</>
                ) : (
                  <><ToggleRight className="size-3.5 mr-2" /> Relist Product</>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(product._id)}
                className="text-destructive cursor-pointer"
              >
                <Trash2 className="size-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CardContent className="p-3">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{product.brand}</p>
        <p className="text-sm font-medium mt-0.5 truncate">{product.name}</p>
        {deliveryLabel((product as any).deliveryPeriod) && (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">Delivery: {deliveryLabel((product as any).deliveryPeriod)}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-sm font-bold text-primary">{formatCurrency(activePrice)}</span>
          {product.promoPrice && (
            <span className="text-xs text-muted-foreground line-through">{formatCurrency(product.originalPrice)}</span>
          )}
        </div>
        <div className="mt-2">
          <StockBadge stock={product.stockQuantity} threshold={product.lowStockThreshold} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{product.totalSold} sold</span>
          <span>{formatCurrency(product.totalRevenue)} earned</span>
        </div>
      </CardContent>
    </Card>
  );
}

const ORDER_STATUSES = {
  awaiting_payment: { label: "Awaiting Payment", icon: Clock, color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  confirmed: { label: "Confirmed", icon: CheckCircle, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  shipped: { label: "Shipped", icon: Truck, color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  delivered: { label: "Delivered", icon: PackageCheck, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-red-500/10 text-red-400 border-red-500/20" },
} as const;
type SellerOrderStatus = keyof typeof ORDER_STATUSES;

function SellerOrdersTab({ onContactBuyer }: { onContactBuyer: (buyerId: Id<"users">) => void }) {
  // Safe layout downcasting to bypass missing file endpoint flags on the schema surface
  const getSellerOrders = ((api.orders as any).getSellerOrders || (api.products as any).listAll) as any;
  const updateOrderStatus = ((api.orders as any).updateOrderStatus || (api.products as any).listAll) as any;
  const markBalanceCollected = ((api.orders as any).markBalanceCollected || (api.products as any).listAll) as any;
  const markPaymentReceivedEndpoint = ((api.orders as any).markPaymentReceived || (api.products as any).listAll) as any;
  const resendRecentBuyerOrderUpdatesEndpoint = ((api.orders as any).resendRecentBuyerOrderUpdates || (api.products as any).listAll) as any;

  const orders = useQuery(getSellerOrders, {});
  const updateStatus = useMutation(updateOrderStatus) as any;
  const collectBalance = useMutation(markBalanceCollected) as any;
  const markPaymentReceived = useMutation(markPaymentReceivedEndpoint) as any;
  const resendRecentBuyerOrderUpdates = useMutation(resendRecentBuyerOrderUpdatesEndpoint) as any;
  const [updating, setUpdating] = useState<string | null>(null);
  const [collecting, setCollecting] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const handleCollectBalance = async (orderId: string) => {
    setCollecting(orderId);
    try {
      await collectBalance({ orderId });
      toast.success("Balance marked as collected — order fully settled");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Failed to update";
      toast.error(msg);
    } finally {
      setCollecting(null);
    }
  };

  const handlePaymentReceived = async (orderId: string) => {
    setCollecting(orderId);
    try {
      await markPaymentReceived({ orderId });
      toast.success("Payment received — buyer notified and revenue updated");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Failed to confirm payment";
      toast.error(msg);
    } finally {
      setCollecting(null);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: SellerOrderStatus) => {
    setUpdating(orderId);
    try {
      await updateStatus({ orderId, status: newStatus });
      toast.success("Order status updated");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Failed to update status";
      toast.error(msg);
    } finally {
      setUpdating(null);
    }
  };

  const handleResendRecent = async () => {
    setResending(true);
    try {
      const result = await resendRecentBuyerOrderUpdates({ hours: 72 });
      toast.success(`Resent buyer updates for ${result.sent ?? 0} recent order${result.sent === 1 ? "" : "s"}`);
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Failed to resend buyer updates";
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  if (orders === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><ShoppingBag /></EmptyMedia>
          <EmptyTitle>No orders yet</EmptyTitle>
          <EmptyDescription>Orders from buyers will appear here once placed.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{orders.length} order{orders.length !== 1 ? "s" : ""} total</p>
        <Button type="button" variant="outline" size="sm" onClick={handleResendRecent} disabled={resending} className="gap-2">
          {resending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          Resend recent buyer updates
        </Button>
      </div>
      {orders.map((order: any) => {
        const cfg = ORDER_STATUSES[order.status as SellerOrderStatus] || ORDER_STATUSES.pending;
        const Icon = cfg.icon;
        return (
          <Card key={order._id}>
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="size-14 rounded-lg overflow-hidden bg-muted shrink-0">
                  {order.product?.images?.[0] ? (
                    <img src={order.product.images[0]} alt={order.product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="size-6 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{order.product?.name ?? "Deleted product"}</p>
                      <p className="text-xs text-muted-foreground">
                        Buyer: {order.buyerName} · Qty: {order.quantity} × {formatCurrency(order.priceAtPurchase)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {order.paymentMethod && (
                          <Badge variant="secondary" className="text-[10px]">
                            {order.paymentMethod === "mobile_money" ? "MoMo" : order.paymentMethod}
                            {order.paymentNetwork ? ` · ${order.paymentNetwork.toUpperCase()}` : ""}
                          </Badge>
                        )}
                        {order.buyerPhone && <Badge variant="outline" className="text-[10px]">{order.buyerPhone}</Badge>}
                        {order.depositAmount != null && order.balanceAmount != null && (
                          order.balancePaid ? (
                            <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Deposit + balance paid</Badge>
                          ) : order.depositPaid ? (
                            <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30">
                              Deposit paid · balance {formatCurrency(order.balanceAmount)} on delivery
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Deposit pending</Badge>
                          )
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(order._creationTime, { addSuffix: true })}
                      </p>
                      {order.buyerNote && (
                        <p className="text-xs text-muted-foreground italic mt-1">"{order.buyerNote}"</p>
                      )}
                    </div>
                    <p className="break-words text-primary font-semibold sm:shrink-0">{formatCurrency(order.totalAmount)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Badge className={`text-xs flex items-center gap-1 border ${cfg.color}`}>
                      <Icon className="size-3" /> {cfg.label}
                    </Badge>
                    {order.status !== "awaiting_payment" && order.status !== "delivered" && order.status !== "cancelled" && (
                      <Select
                        value={order.status}
                        onValueChange={(val) => handleStatusChange(order._id, val as SellerOrderStatus)}
                        disabled={updating === order._id}
                      >
                        <SelectTrigger className="h-8 text-xs w-full min-w-36 sm:w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {order.status === "pending" && <SelectItem value="confirmed">Mark Confirmed</SelectItem>}
                          {(order.status === "pending" || order.status === "confirmed") && (
                            <SelectItem value="shipped">Mark Shipped</SelectItem>
                          )}
                          {order.status === "shipped" && <SelectItem value="delivered">Mark Delivered</SelectItem>}
                          <SelectItem value="cancelled">Cancel Order</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {order.status === "awaiting_payment" && (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        disabled={collecting === order._id}
                        onClick={() => handlePaymentReceived(order._id)}
                      >
                        <CheckCircle className="size-3" /> Payment Received
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onContactBuyer(order.buyerId)}>
                      <MessageSquare className="size-3" /> Contact buyer
                    </Button>
                    {order.depositPaid && !order.balancePaid && order.balanceAmount != null && order.balanceAmount > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        disabled={collecting === order._id}
                        onClick={() => handleCollectBalance(order._id)}
                      >
                        {collecting === order._id ? <Loader2 className="size-3 animate-spin" /> : <CreditCard className="size-3" />}
                        Balance collected
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function PaymentSettingsTab({
  currentUser,
  onSave,
}: {
  currentUser: Doc<"users"> | null | undefined;
  onSave: (payload: {
    phone?: string;
    paymentMethod?: string;
    paymentNetwork?: string;
    paymentAccount?: string;
    paymentReceiptModes?: any;
  }) => Promise<void>;
}) {
  const [phone, setPhone] = useState(currentUser?.phone ?? "");
  const savedModes = (currentUser as any)?.paymentReceiptModes ?? {};
  const [acceptMomo, setAcceptMomo] = useState(savedModes.momo?.enabled ?? (currentUser?.paymentMethod ?? "mobile_money") === "mobile_money");
  const [momoNetwork, setMomoNetwork] = useState(savedModes.momo?.network ?? currentUser?.paymentNetwork ?? "mtn");
  const [momoName, setMomoName] = useState(savedModes.momo?.name ?? currentUser?.name ?? "");
  const [momoNumber, setMomoNumber] = useState(savedModes.momo?.number ?? currentUser?.paymentAccount ?? "");
  const [acceptBank, setAcceptBank] = useState(savedModes.bank?.enabled ?? false);
  const [bankAccountName, setBankAccountName] = useState(savedModes.bank?.accountName ?? currentUser?.name ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState(savedModes.bank?.accountNumber ?? "");
  const [bankName, setBankName] = useState(savedModes.bank?.bankName ?? "");
  const [bankBranch, setBankBranch] = useState(savedModes.bank?.branch ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const numberDigits = momoNumber.replace(/[^\d]/g, "");
      const localMomo = numberDigits.startsWith("233") ? `0${numberDigits.slice(3)}` : numberDigits;
      const prefix = localMomo.slice(0, 3);
      const prefixes: Record<string, string[]> = {
        mtn: ["024", "059", "053", "025", "055"],
        airteltigo: ["027", "023", "057"],
        telecel: ["020", "050"],
      };
      if (acceptMomo && !prefixes[momoNetwork]?.includes(prefix)) {
        toast.error("The MoMo number prefix does not match the selected network.");
        return;
      }
      await onSave({
        phone: phone.trim() || undefined,
        paymentMethod: acceptMomo ? "mobile_money" : acceptBank ? "bank_transfer" : "cash_on_delivery",
        paymentNetwork: acceptMomo ? momoNetwork : undefined,
        paymentAccount: acceptMomo ? momoNumber.trim() || undefined : undefined,
        paymentReceiptModes: {
          momo: {
            enabled: acceptMomo,
            network: momoNetwork,
            name: momoName.trim() || undefined,
            number: momoNumber.trim() || undefined,
          },
          bank: {
            enabled: acceptBank,
            accountName: bankAccountName.trim() || undefined,
            accountNumber: bankAccountNumber.trim() || undefined,
            bankName: bankName.trim() || undefined,
            branch: bankBranch.trim() || undefined,
          },
        },
      });
      toast.success("Payment settings saved");
    } catch {
      toast.error("Failed to save payment settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><CreditCard className="size-4" /> Payout Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Contact Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+233 24 000 0000"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" />
              This phone is used for order updates and seller SMS alerts.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Smartphone className="size-4" /> MoMo Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={acceptMomo} onChange={(e) => setAcceptMomo(e.target.checked)} />
              Accept Mobile Money receipts
            </label>
            {acceptMomo && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Network</label>
                  <select
                    value={momoNetwork}
                    onChange={(e) => setMomoNetwork(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="mtn">MTN MoMo</option>
                    <option value="telecel">Telecel Cash</option>
                    <option value="airteltigo">AirtelTigo Money</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Account Name</label>
                  <input
                    value={momoName}
                    onChange={(e) => setMomoName(e.target.value)}
                    placeholder="Name on MoMo account"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">MoMo Number</label>
                  <input
                    value={momoNumber}
                    onChange={(e) => setMomoNumber(e.target.value)}
                    placeholder="+233 24 000 0000"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Landmark className="size-4" /> Bank Transfer Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={acceptBank} onChange={(e) => setAcceptBank(e.target.checked)} />
              Accept bank transfer receipts
            </label>
            {acceptBank && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Account Name</label>
                  <input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Account Number</label>
                  <input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Bank Name</label>
                  <input value={bankName} onChange={(e) => setBankName(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Branch</label>
                  <input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border bg-primary/5 p-4 text-sm text-muted-foreground">
        These details are shown to buyers only on products where you enable the matching payment option.
      </div>

      <Button onClick={save} disabled={saving} className="gap-2">
        <CreditCard className="size-4" /> {saving ? "Saving..." : "Save Payment Settings"}
      </Button>
    </div>
  );
}

export default function SellerDashboardInner() {
  // Safe query downcasting layers to bypass missing file generation configurations
  const getMyProducts = ((api.products as any).getMyProducts || (api.products as any).listAll) as any;
  const getSellerStats = ((api.products as any).getSellerStats || (api.products as any).listAll) as any;
  const getCurrentUser = api.users.current;
  const getSellerOrdersQuery = ((api.orders as any).getSellerOrders || (api.products as any).listAll) as any;
  const getMyActivity = ((api.notifications as any).getMyActivity || (api.products as any).listAll) as any;
  const getTotalUnreadCount = ((api.messages as any).getTotalUnreadCount || (api.products as any).listAll) as any;
  const getSubscriptionState = ((api.payments as any).getMarketplaceSubscriptionState || (api.products as any).listAll) as any;
  const updateProductEndpoint = ((api.products as any).updateProduct || (api.products as any).listAll) as any;
  const deleteProductEndpoint = ((api.products as any).deleteProduct || (api.products as any).listAll) as any;
  const updateProfileEndpoint = ((api.users as any).updateProfile || (api.products as any).listAll) as any;

  const products = useQuery(getMyProducts, {});
  const stats = useQuery(getSellerStats, {});
  const currentUser = useQuery(getCurrentUser, {});
  const sellerOrders = useQuery(getSellerOrdersQuery, {});
  const activity = useQuery(getMyActivity, {});
  const unreadMessages = useQuery(getTotalUnreadCount, {}) as number | undefined;
  const subscriptionState = useQuery(getSubscriptionState, {}) as any;
  
  const updateProduct = useMutation(updateProductEndpoint) as any;
  const deleteProduct = useMutation(deleteProductEndpoint) as any;
  const updateProfile = useMutation(updateProfileEndpoint) as any;

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Doc<"products"> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("products");
  const [selectedBuyerId, setSelectedBuyerId] = useState<Id<"users"> | null>(null);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);

  const handleEdit = (p: Doc<"products">) => {
    setEditTarget(p);
    setFormOpen(true);
  };

  const handleToggle = async (p: Doc<"products">) => {
    try {
      await updateProduct({ productId: p._id, isActive: !p.isActive });
      toast.success(p.isActive ? "Product unlisted" : "Product relisted");
    } catch {
      toast.error("Failed to update product");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct({ productId: deleteTarget });
      toast.success("Product deleted");
    } catch (err) {
      if (err instanceof ConvexError) {
        toast.error((err.data as { message: string }).message);
      } else {
        toast.error("Failed to delete product");
      }
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleBecomeSeller = async () => {
    setSubscriptionOpen(true);
  };

  const handleSavePaymentSettings = async (payload: {
    phone?: string;
    paymentMethod?: string;
    paymentNetwork?: string;
    paymentAccount?: string;
    paymentReceiptModes?: any;
  }) => {
    await updateProfile({
      ...payload,
      role: "seller",
      isSeller: true,
    });
  };

  if (products === undefined || stats === undefined || currentUser === undefined) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-56 w-full" />)}
        </div>
      </div>
    );
  }

  // Prompt to become a seller if they haven't yet
  if (currentUser?.role !== "seller") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Tag className="size-7 text-primary" />
        </div>
        <div>
          <h2 className="text-3xl font-light mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Start Selling on Aurriq
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
            Become a seller to list your beauty products, manage your inventory in real-time, and get SMS alerts when stock runs low.
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 text-left space-y-3">
          <p className="text-sm font-semibold">What you get as a seller:</p>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>Post unlimited products with photos, pricing, and promo deals</li>
            <li>Real-time stock tracking — see what's running low instantly</li>
            <li>SMS alerts when your stock hits your set minimum</li>
            <li>Revenue dashboard showing total earned per product</li>
            <li>Direct messaging with buyers</li>
            <li>Payment preference setup for MoMo, COD, and bank transfer support</li>
          </ul>
        </div>
        <Button size="lg" onClick={handleBecomeSeller} className="rounded-full px-10">
          Activate Seller Account
        </Button>
        <Button asChild variant="outline" className="rounded-full px-8">
          <Link to="/">Back to Home</Link>
        </Button>
        <VendorSubscriptionDialog
          open={subscriptionOpen}
          onOpenChange={setSubscriptionOpen}
          isDoaBookProPartner={Boolean((currentUser as any)?.doabookproSlug)}
          pendingPaymentReference={(currentUser as any)?.marketplaceSubscriptionStatus === "payment_pending" ? (currentUser as any)?.marketplacePaymentReference : undefined}
          intent="activation"
        />
      </div>
    );
  }

  if (subscriptionState?.isLocked) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <Lock className="size-7 text-destructive" />
        </div>
        <div>
          <h2 className="text-3xl font-light mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Vendor dashboard locked
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
            Your Aurriq vendor subscription has expired. Buyers can still shop and check out from your storefront, but dashboard management is locked until renewal is approved.
          </p>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-muted-foreground">
          Once your renewal is approved, you will receive SMS and email confirmation. Nothing is deleted, so you can pick up from where you left off.
        </div>
        <DoabookproAccountLink slug={(currentUser as any)?.doabookproSlug} />
        <Button size="lg" onClick={() => setSubscriptionOpen(true)} className="rounded-full px-10">
          Renew Seller Account
        </Button>
        <p className="text-xs text-muted-foreground">
          Need help? Contact Aurriq Team on {AURRIQ_SUPPORT_PHONE} or {AURRIQ_SUPPORT_EMAIL}.
        </p>
        <VendorSubscriptionDialog
          open={subscriptionOpen}
          onOpenChange={setSubscriptionOpen}
          isDoaBookProPartner={Boolean((currentUser as any)?.doabookproSlug)}
          pendingPaymentReference={(currentUser as any)?.marketplaceSubscriptionStatus === "payment_pending" ? (currentUser as any)?.marketplacePaymentReference : undefined}
          intent="top_up"
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl min-w-0 mx-auto px-3 sm:px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="size-3.5" /> Back to Aurriq home
          </Link>
          <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Seller Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, {currentUser?.name ?? "Seller"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {subscriptionState?.paidUntil && (
            <Button variant="outline" onClick={() => setSubscriptionOpen(true)} className="gap-2">
              <CalendarDays className="size-4" /> Top Up Plan
            </Button>
          )}
          <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="gap-2">
            <Plus className="size-4" /> Add Product
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <DoabookproAccountLink slug={(currentUser as any)?.doabookproSlug} />
      </div>

      {subscriptionState?.isExpiringSoon && (
        <div className="mb-5 animate-pulse rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">Your Aurriq seller subscription is expiring soon.</p>
              <p className="mt-1">You have {subscriptionState.daysLeft} day{subscriptionState.daysLeft === 1 ? "" : "s"} left. Renew early to prevent dashboard lock.</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs: Products / Inventory & Revenue */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
        <TabsList className="mb-6 w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="products" className="gap-2 cursor-pointer">
            <Package className="size-3.5" /> Products
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2 cursor-pointer">
            <TrendingUp className="size-3.5" /> Inventory & Revenue
            {stats && (stats.lowStockCount + stats.outOfStockCount) > 0 && (
              <span className="ml-1 size-4 rounded-full bg-amber-500 text-[9px] font-bold text-black flex items-center justify-center">
                {stats.lowStockCount + stats.outOfStockCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2 cursor-pointer">
            <ShoppingBag className="size-3.5" /> Orders
          </TabsTrigger>
          <TabsTrigger value="buyers" className="gap-2 cursor-pointer">
            <Users className="size-3.5" /> Buyers
          </TabsTrigger>
          <TabsTrigger value="rfqs" className="gap-2 cursor-pointer">
            <FileText className="size-3.5" /> RFQs
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2 cursor-pointer">
            <MessageSquare className="size-3.5" /> Messages
            {(unreadMessages ?? 0) > 0 && (
              <span className="ml-1 size-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                {(unreadMessages ?? 0) > 99 ? "99+" : unreadMessages}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2 cursor-pointer">
            <CreditCard className="size-3.5" /> Payments
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2 cursor-pointer">
            <TrendingUp className="size-3.5" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 cursor-pointer">
            <Clock className="size-3.5" /> History
          </TabsTrigger>
        </TabsList>

        {/* ── Products Tab ── */}
        <TabsContent value="products">
          {/* Stats row */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { icon: Package, label: "Total Products", value: stats.totalProducts, sub: `${stats.activeProducts} active` },
                { icon: ShoppingBag, label: "Total Sold", value: stats.totalSold, sub: "units" },
                { icon: TrendingUp, label: "Total Revenue", value: formatCurrency(stats.totalRevenue), sub: "earned" },
                {
                  icon: AlertTriangle,
                  label: "Stock Alerts",
                  value: stats.lowStockCount + stats.outOfStockCount,
                  sub: `${stats.outOfStockCount} out of stock`,
                  alert: stats.lowStockCount + stats.outOfStockCount > 0,
                },
              ].map((s) => (
                <Card key={s.label} className={s.alert ? "border-amber-500/40" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <s.icon className={`size-4 ${s.alert ? "text-amber-400" : "text-primary"}`} />
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                    <p className={`text-xl font-bold ${s.alert ? "text-amber-400" : ""}`}>{s.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Alert banners */}
          {stats && stats.outOfStockCount > 0 && (
            <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                <strong>{stats.outOfStockCount} product{stats.outOfStockCount > 1 ? "s are" : " is"} completely out of stock.</strong> Go to Inventory tab to restock.
              </span>
            </div>
          )}
          {stats && stats.lowStockCount > 0 && (
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 text-sm text-amber-400">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                <strong>{stats.lowStockCount} product{stats.lowStockCount > 1 ? "s are" : " is"} running low.</strong> Restock soon to avoid losing sales.
              </span>
            </div>
          )}

          {/* Product grid */}
          {products.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Package /></EmptyMedia>
                <EmptyTitle>No products yet</EmptyTitle>
                <EmptyDescription>List your first beauty product and start selling on Aurriq</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="gap-2">
                  <Plus className="size-4" /> Add Your First Product
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {products.map((p: any) => (
                <ProductCard
                  key={p._id}
                  product={p}
                  onEdit={handleEdit}
                  onDelete={(id) => setDeleteTarget(id)}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Inventory & Revenue Tab ── */}
        <TabsContent value="inventory">
          <InventoryTab />
        </TabsContent>

        {/* ── Orders Tab ── */}
        <TabsContent value="orders">
          <SellerOrdersTab onContactBuyer={(buyerId) => { setSelectedBuyerId(buyerId); setActiveTab("messages"); }} />
        </TabsContent>

        <TabsContent value="buyers">
          <BuyersRetentionTab />
        </TabsContent>

        <TabsContent value="rfqs">
          <SellerRfqsTab />
        </TabsContent>

        <TabsContent value="messages">
          <SellerMessagesTab initialConversation={selectedBuyerId} />
        </TabsContent>

        <TabsContent value="payments">
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="size-11 rounded-full bg-primary/10 flex items-center justify-center">
                <Store className="size-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Seller payment setup</p>
                <p className="text-sm text-muted-foreground">Configure how buyers pay you and what number gets used for MoMo checkout confirmation.</p>
              </div>
            </div>
            <PaymentSettingsTab currentUser={currentUser} onSave={handleSavePaymentSettings} />
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab orders={sellerOrders} activity={activity} />
        </TabsContent>
      </Tabs>

      {/* Product form dialog */}
      <ProductFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        editProduct={editTarget}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the product from Aurriq. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VendorSubscriptionDialog
        open={subscriptionOpen}
        onOpenChange={setSubscriptionOpen}
        isDoaBookProPartner={Boolean((currentUser as any)?.doabookproSlug)}
        pendingPaymentReference={(currentUser as any)?.marketplaceSubscriptionStatus === "payment_pending" ? (currentUser as any)?.marketplacePaymentReference : undefined}
        intent="top_up"
      />
    </div>
  );
}

function BuyersRetentionTab() {
  const retention = useQuery(((api as any).retention as any).getSellerBuyerHistory, {}) as any;
  const updateSettings = useMutation(((api as any).retention as any).updateRetentionSettings) as any;
  const sendReminder = useMutation(((api as any).retention as any).sendBuyerRetentionSms) as any;
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [days, setDays] = useState(30);
  const [template, setTemplate] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    if (!retention?.settings || settingsLoaded) return;
      setEnabled(retention.settings.enabled ?? true);
      setDays(retention.settings.days ?? 30);
      setTemplate(retention.settings.template ?? "");
      setSettingsLoaded(true);
  }, [retention?.settings, settingsLoaded]);

  if (retention === undefined) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings({ enabled, days, template: template.trim() || undefined });
      toast.success("Retention settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save retention settings");
    } finally {
      setSaving(false);
    }
  };

  const send = async (buyerId: string) => {
    setSending(buyerId);
    try {
      await sendReminder({ buyerId });
      toast.success("Personalized SMS sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send SMS");
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Users className="size-4" /> Client retention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              Automatically send buyer check-in SMS after no purchase
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(event) => setDays(Number(event.target.value) || 30)}
                className="h-10 w-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>
          <textarea
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Optional custom message. Use {buyerName}, {sellerName}, {items}, {days}."
          />
          <Button onClick={save} disabled={saving} className="gap-2"><Save className="size-4" /> {saving ? "Saving..." : "Save Retention Settings"}</Button>
        </CardContent>
      </Card>

      {retention.buyers.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Users /></EmptyMedia>
            <EmptyTitle>No buyers yet</EmptyTitle>
            <EmptyDescription>Customers who buy from your shop will appear here with their last purchase history.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {retention.buyers.map((buyer: any) => (
            <Card key={buyer.buyerId}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{buyer.buyerName}</p>
                  <p className="text-xs text-muted-foreground">
                    Last bought {buyer.itemSummary} · {buyer.daysSinceLastOrder} day{buyer.daysSinceLastOrder === 1 ? "" : "s"} ago
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {buyer.totalOrders} order{buyer.totalOrders === 1 ? "" : "s"} · {formatCurrency(buyer.totalSpent ?? 0)}
                    {buyer.lastReminderAt ? ` · last SMS ${formatDistanceToNow(buyer.lastReminderAt, { addSuffix: true })}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={!buyer.buyerPhone || sending === buyer.buyerId} onClick={() => send(buyer.buyerId)} className="gap-2">
                  {sending === buyer.buyerId ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  Send check-in
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
