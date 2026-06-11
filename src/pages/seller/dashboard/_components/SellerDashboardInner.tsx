import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api.js";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  Plus, Package, TrendingUp, AlertTriangle, ShoppingBag,
  MoreVertical, Pencil, Trash2, ToggleLeft, ToggleRight, Tag,
  Clock, CheckCircle, Truck, PackageCheck, XCircle
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
import type { Doc } from "../../../../../convex/_generated/dataModel.d.ts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
}

function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  if (stock === 0) return <Badge variant="destructive" className="text-[10px]">Out of Stock</Badge>;
  if (stock <= threshold) return <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30">Low Stock ({stock})</Badge>;
  return <Badge variant="secondary" className="text-[10px]">{stock} in stock</Badge>;
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
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  confirmed: { label: "Confirmed", icon: CheckCircle, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  shipped: { label: "Shipped", icon: Truck, color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  delivered: { label: "Delivered", icon: PackageCheck, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-red-500/10 text-red-400 border-red-500/20" },
} as const;
type SellerOrderStatus = keyof typeof ORDER_STATUSES;

function SellerOrdersTab() {
  const orders = useQuery(api.orders.getSellerOrders, {});
  const updateStatus = useMutation(api.orders.updateOrderStatus);
  const [updating, setUpdating] = useState<string | null>(null);

  const handleStatusChange = async (orderId: string, newStatus: SellerOrderStatus) => {
    setUpdating(orderId);
    try {
    await updateStatus({ orderId: orderId as Doc<"orders">["_id"], status: newStatus as "confirmed" | "shipped" | "delivered" | "cancelled" });
      toast.success("Order status updated");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Failed to update status";
      toast.error(msg);
    } finally {
      setUpdating(null);
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
      <p className="text-sm text-muted-foreground">{orders.length} order{orders.length !== 1 ? "s" : ""} total</p>
      {orders.map((order) => {
        const cfg = ORDER_STATUSES[order.status as SellerOrderStatus];
        const Icon = cfg.icon;
        return (
          <Card key={order._id}>
            <CardContent className="p-5">
              <div className="flex gap-4">
                <div className="size-14 rounded-lg overflow-hidden bg-muted shrink-0">
                  {order.product?.images[0] ? (
                    <img src={order.product.images[0]} alt={order.product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="size-6 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium truncate">{order.product?.name ?? "Deleted product"}</p>
                      <p className="text-xs text-muted-foreground">
                        Buyer: {order.buyerName} · Qty: {order.quantity} × {formatCurrency(order.priceAtPurchase)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(order._creationTime, { addSuffix: true })}
                      </p>
                      {order.buyerNote && (
                        <p className="text-xs text-muted-foreground italic mt-1">"{order.buyerNote}"</p>
                      )}
                    </div>
                    <p className="text-primary font-semibold shrink-0">{formatCurrency(order.totalAmount)}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <Badge className={`text-xs flex items-center gap-1 border ${cfg.color}`}>
                      <Icon className="size-3" /> {cfg.label}
                    </Badge>
                    {order.status !== "delivered" && order.status !== "cancelled" && (
                      <Select
                        value={order.status}
                        onValueChange={(val) => handleStatusChange(order._id, val as SellerOrderStatus)}
                        disabled={updating === order._id}
                      >
                        <SelectTrigger className="h-7 text-xs w-36">
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

export default function SellerDashboardInner() {
  const products = useQuery(api.products.getMyProducts, {});
  const stats = useQuery(api.products.getSellerStats, {});
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const updateProduct = useMutation(api.products.updateProduct);
  const deleteProduct = useMutation(api.products.deleteProduct);
  const updateProfile = useMutation(api.users.updateProfile);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Doc<"products"> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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
      await deleteProduct({ productId: deleteTarget as Parameters<typeof deleteProduct>[0]["productId"] });
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
    try {
      await updateProfile({ role: "seller" });
      toast.success("You're now a seller on Aurriq!");
    } catch {
      toast.error("Something went wrong");
    }
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
          </ul>
        </div>
        <Button size="lg" onClick={handleBecomeSeller} className="rounded-full px-10">
          Activate Seller Account
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Seller Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, {currentUser?.name ?? "Seller"}
          </p>
        </div>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="gap-2">
          <Plus className="size-4" /> Add Product
        </Button>
      </div>

      {/* Tabs: Products / Inventory & Revenue */}
      <Tabs defaultValue="products">
        <TabsList className="mb-6">
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
              {products.map((p) => (
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
          <SellerOrdersTab />
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
    </div>
  );
}
