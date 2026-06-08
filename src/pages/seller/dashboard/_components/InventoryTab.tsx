import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  Package, TrendingUp, AlertTriangle, CheckCircle2,
  Plus, Minus, RefreshCw, BarChart3, ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n);
}

type InventoryItem = {
  _id: Id<"products">;
  name: string;
  brand: string;
  category: string;
  images: string[];
  originalPrice: number;
  promoPrice?: number;
  stockQuantity: number;
  lowStockThreshold: number;
  totalSold: number;
  totalRevenue: number;
  isActive: boolean;
  stockStatus: "ok" | "low" | "out";
};

function StockBar({ stock, threshold }: { stock: number; threshold: number }) {
  const max = Math.max(stock, threshold * 3, 10);
  const pct = Math.round((stock / max) * 100);
  const color =
    stock === 0
      ? "bg-destructive"
      : stock <= threshold
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RestockDialog({
  product,
  open,
  onClose,
}: {
  product: InventoryItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [qty, setQty] = useState("1");
  const restock = useMutation(api.inventory.restockProduct);
  const [loading, setLoading] = useState(false);

  const handleRestock = async () => {
    if (!product) return;
    const addQty = parseInt(qty, 10);
    if (isNaN(addQty) || addQty <= 0) {
      toast.error("Enter a valid quantity to add");
      return;
    }
    setLoading(true);
    try {
      await restock({ productId: product._id, addQuantity: addQty });
      toast.success(
        `Restocked! "${product.name}" now has ${product.stockQuantity + addQty} units.`
      );
      onClose();
      setQty("1");
    } catch (err) {
      if (err instanceof ConvexError) {
        toast.error((err.data as { message: string }).message);
      } else {
        toast.error("Failed to restock");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setQty("1"); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Restock Product</DialogTitle>
          <DialogDescription>
            Add units to <span className="font-medium text-foreground">{product?.name}</span>.
            Current stock: <span className="font-medium text-foreground">{product?.stockQuantity}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Units to Add</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-9"
                onClick={() => setQty((v) => String(Math.max(1, parseInt(v || "1", 10) - 1)))}
              >
                <Minus className="size-3.5" />
              </Button>
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="text-center"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-9"
                onClick={() => setQty((v) => String(parseInt(v || "0", 10) + 1))}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
          {product && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              After restock: <span className="font-semibold text-foreground">{product.stockQuantity + (parseInt(qty, 10) || 0)} units</span>
              {product.lowStockThreshold && (
                <> (alert threshold: {product.lowStockThreshold})</>
              )}
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { onClose(); setQty("1"); }} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleRestock} disabled={loading} className="flex-1">
              {loading ? "Saving..." : "Add Stock"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function InventoryTab() {
  const inventory = useQuery(api.inventory.getInventoryReport, {});
  const stats = useQuery(api.products.getSellerStats, {});
  const [restockTarget, setRestockTarget] = useState<InventoryItem | null>(null);

  if (inventory === undefined || stats === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const totalRevenue = inventory.reduce((s, p) => s + p.totalRevenue, 0);
  const totalSold = inventory.reduce((s, p) => s + p.totalSold, 0);
  const outItems = inventory.filter((p) => p.stockStatus === "out");
  const lowItems = inventory.filter((p) => p.stockStatus === "low");

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: TrendingUp,
            label: "Total Revenue",
            value: formatCurrency(totalRevenue),
            sub: "from all sales",
            color: "text-primary",
          },
          {
            icon: Package,
            label: "Units Sold",
            value: totalSold,
            sub: "across all products",
            color: "text-foreground",
          },
          {
            icon: AlertTriangle,
            label: "Low Stock",
            value: lowItems.length,
            sub: "need restocking soon",
            color: "text-amber-400",
            alert: lowItems.length > 0,
          },
          {
            icon: AlertTriangle,
            label: "Out of Stock",
            value: outItems.length,
            sub: "currently unavailable",
            color: "text-destructive",
            alert: outItems.length > 0,
          },
        ].map((s) => (
          <Card key={s.label} className={s.alert ? "border-amber-500/30" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`size-4 ${s.color}`} />
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alert banners */}
      {outItems.length > 0 && (
        <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm">
          <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive mb-1">
              {outItems.length} product{outItems.length > 1 ? "s are" : " is"} out of stock
            </p>
            <p className="text-muted-foreground text-xs">
              {outItems.map((p) => p.name).join(", ")} — restock to resume selling
            </p>
          </div>
        </div>
      )}
      {lowItems.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm">
          <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-400 mb-1">
              {lowItems.length} product{lowItems.length > 1 ? "s are" : " is"} running low
            </p>
            <p className="text-muted-foreground text-xs">
              {lowItems.map((p) => `${p.name} (${p.stockQuantity} left)`).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* SMS info notice */}
      <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg p-4 text-xs text-muted-foreground">
        <RefreshCw className="size-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-foreground mb-0.5">Automatic SMS Alerts</p>
          <p>
            You'll receive an SMS on your registered phone number when any product hits its low-stock threshold,
            and again when it reaches 0. Make sure your phone number is saved in your profile to receive alerts.
          </p>
        </div>
      </div>

      {/* Inventory table */}
      <div>
        <h3 className="text-lg font-light mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          Product Inventory & Revenue
        </h3>

        {inventory.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No products yet. Add products to see your inventory here.
          </p>
        ) : (
          <div className="space-y-3">
            {inventory.map((p) => {
              const activePrice = p.promoPrice ?? p.originalPrice;
              return (
                <Card key={p._id} className={
                  p.stockStatus === "out"
                    ? "border-destructive/30"
                    : p.stockStatus === "low"
                      ? "border-amber-500/30"
                      : ""
                }>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Thumbnail */}
                      <div className="size-12 rounded-lg bg-muted overflow-hidden shrink-0">
                        {p.images[0] ? (
                          <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="size-5 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <span className="text-[10px] text-muted-foreground">{p.brand}</span>
                          {p.stockStatus === "out" && (
                            <Badge variant="destructive" className="text-[10px] py-0">Out of Stock</Badge>
                          )}
                          {p.stockStatus === "low" && (
                            <Badge className="text-[10px] py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">
                              Low Stock
                            </Badge>
                          )}
                          {p.stockStatus === "ok" && (
                            <Badge className="text-[10px] py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              In Stock
                            </Badge>
                          )}
                        </div>

                        {/* Stock bar */}
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs">
                          <div>
                            <p className="text-muted-foreground">Stock</p>
                            <p className={`font-semibold ${p.stockStatus === "out" ? "text-destructive" : p.stockStatus === "low" ? "text-amber-400" : "text-foreground"}`}>
                              {p.stockQuantity} / alert at {p.lowStockThreshold}
                            </p>
                            <StockBar stock={p.stockQuantity} threshold={p.lowStockThreshold} />
                          </div>
                          <div>
                            <p className="text-muted-foreground">Price</p>
                            <p className="font-semibold">{formatCurrency(activePrice)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Units Sold</p>
                            <p className="font-semibold">{p.totalSold}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Revenue Earned</p>
                            <p className="font-semibold text-primary">{formatCurrency(p.totalRevenue)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Restock button */}
                      <Button
                        size="sm"
                        variant={p.stockStatus === "out" ? "default" : "secondary"}
                        className="shrink-0 gap-1.5 cursor-pointer"
                        onClick={() => setRestockTarget(p)}
                      >
                        <Plus className="size-3.5" />
                        <span className="hidden sm:inline">Restock</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <RestockDialog
        product={restockTarget}
        open={!!restockTarget}
        onClose={() => setRestockTarget(null)}
      />
    </div>
  );
}
