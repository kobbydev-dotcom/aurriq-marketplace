import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import type { Id } from "../../../convex/_generated/dataModel.d.ts";
import { formatCurrency } from "@/lib/utils.ts";

type CartItem = {
  _id: Id<"cartItems">;
  quantity: number;
  product: {
    _id: Id<"products">;
    name: string;
    brand: string;
    images: string[];
    originalPrice: number;
    promoPrice?: number;
    stockQuantity: number;
    isActive: boolean;
    seller?: { name?: string } | null;
    paymentOptions?: { mode: string; percent?: number } | null;
  } | null;
};

function CartItemRow({ item, onRemove }: { item: CartItem; onRemove: () => void }) {
  const updateQty = useMutation(api.cart.updateCartItemQty);
  const removeItem = useMutation(api.cart.removeFromCart);
  const [loading, setLoading] = useState(false);

  if (!item.product) return null;

  const product = item.product;
  const price = product.promoPrice ?? product.originalPrice;
  const subtotal = price * item.quantity;

  const handleQty = async (newQty: number) => {
    setLoading(true);
    try {
      await updateQty({ cartItemId: item._id, quantity: newQty });
      if (newQty <= 0) onRemove();
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Failed to update";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      await removeItem({ cartItemId: item._id });
      onRemove();
    } catch {
      toast.error("Failed to remove item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-4 py-5 border-b border-border/40">
      {/* Image */}
      <Link to={`/product/${product._id}`} className="shrink-0">
        <div className="size-20 rounded-lg overflow-hidden bg-muted">
          {product.images[0] ? (
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="size-6 text-muted-foreground/30" />
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">{product.brand}</p>
        <Link to={`/product/${product._id}`} className="text-sm font-medium hover:text-primary transition-colors line-clamp-1">
          {product.name}
        </Link>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-primary font-semibold text-sm">{formatCurrency(price)}</span>
          {product.promoPrice && (
            <span className="text-xs text-muted-foreground line-through">{formatCurrency(product.originalPrice)}</span>
          )}
        </div>

        {/* Qty controls */}
        <div className="flex items-center gap-2 mt-3">
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => handleQty(item.quantity - 1)}
              disabled={loading}
              className="px-2.5 py-1 hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
            >
              <Minus className="size-3" />
            </button>
            <span className="px-3 text-sm font-medium min-w-[2rem] text-center">{item.quantity}</span>
            <button
              onClick={() => handleQty(item.quantity + 1)}
              disabled={loading || item.quantity >= product.stockQuantity}
              className="px-2.5 py-1 hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus className="size-3" />
            </button>
          </div>
          <button
            onClick={handleRemove}
            disabled={loading}
            className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer disabled:opacity-50 ml-2"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Subtotal */}
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold">{formatCurrency(subtotal)}</p>
      </div>
    </div>
  );
}

function CheckoutDialog({
  open,
  onClose,
  total,
  items,
}: {
  open: boolean;
  onClose: () => void;
  total: number;
  items: CartItem[];
}) {
  const placeOrder = useMutation((api.orders as any).placeOrder) as any;
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [receiptEmail, setReceiptEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("mobile_money");
  const [paymentNetwork, setPaymentNetwork] = useState("mtn");
  const [paymentAccount, setPaymentAccount] = useState("");
  const [loading, setLoading] = useState(false);

  // Determine effective payment mode per item (default: online/momo).
  const modeOf = (p: CartItem["product"]) => {
    const m = p?.paymentOptions?.mode;
    return m === "cod" || m === "negotiable" || m === "partial" ? m : "momo";
  };
  const hasOnline = items.some((i) => {
    const m = modeOf(i.product);
    return m === "momo" || m === "partial";
  });

  // Amount due online right now (full for momo, deposit % for partial).
  const dueNow = items.reduce((sum, i) => {
    const p = i.product;
    if (!p) return sum;
    const price = (p.promoPrice ?? p.originalPrice) * i.quantity;
    const m = modeOf(p);
    if (m === "momo") return sum + price;
    if (m === "partial") {
      const pct = Math.min(100, Math.max(1, p.paymentOptions?.percent ?? 50));
      return sum + Math.round(price * (pct / 100) * 100) / 100;
    }
    return sum; // cod / negotiable → nothing online
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await placeOrder({
        buyerPhone: phone || undefined,
        buyerNote: note || undefined,
        paymentMethod,
        paymentNetwork: paymentMethod === "mobile_money" ? paymentNetwork : undefined,
        paymentAccount: paymentMethod === "mobile_money" ? paymentAccount || phone || undefined : undefined,
        receiptEmail: receiptEmail || undefined,
      });
      if (result.paymentPending) {
        toast.success("Payment initiated. Complete it on your phone — your receipt follows by SMS + email.");
      } else {
        toast.success(`Order placed! ${result.orderIds.length} item(s) confirmed.`);
      }
      onClose();
      navigate("/orders");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Failed to place order";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Cormorant Garamond', serif" }}>Confirm Your Order</DialogTitle>
          <DialogDescription>
            Total: <span className="text-primary font-bold">{formatCurrency(total)}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone number (for SMS receipt)</Label>
            <Input
              id="phone"
              placeholder="+233 24 000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="receiptEmail">Email for your receipt</Label>
            <Input
              id="receiptEmail"
              type="email"
              placeholder="you@example.com"
              value={receiptEmail}
              onChange={(e) => setReceiptEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">We'll email your receipt here after payment.</p>
          </div>

          {/* Per-item payment mode summary */}
          <div className="space-y-1.5">
            <Label>Payment breakdown</Label>
            <div className="rounded-lg border border-border divide-y divide-border/50 overflow-hidden">
              {items.map((i) => {
                const p = i.product;
                if (!p) return null;
                const m = modeOf(p);
                const price = (p.promoPrice ?? p.originalPrice) * i.quantity;
                const label =
                  m === "cod" ? "Cash on delivery"
                  : m === "negotiable" ? "Negotiable with seller"
                  : m === "partial" ? `Deposit ${Math.min(100, Math.max(1, p.paymentOptions?.percent ?? 50))}% now`
                  : "Pay online now";
                return (
                  <div key={i._id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="truncate pr-2">{p.name} × {i.quantity}</span>
                    <span className="text-muted-foreground whitespace-nowrap">{label}</span>
                  </div>
                );
              })}
            </div>
            {hasOnline && (
              <p className="text-xs text-muted-foreground">
                Due online now: <span className="text-primary font-semibold">{formatCurrency(dueNow)}</span>
                {dueNow < total && <> · rest on delivery/arranged</>}
              </p>
            )}
          </div>

          {hasOnline && (
          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { value: "mobile_money", label: "Mobile Money", description: "MoMo-ready checkout for instant payment confirmation" },
                { value: "cash_on_delivery", label: "Cash on Delivery", description: "Pay when you receive the items" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPaymentMethod(option.value)}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer ${paymentMethod === option.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                </button>
              ))}
            </div>
          </div>
          )}
          {hasOnline && paymentMethod === "mobile_money" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mobile Money Network</Label>
                <select
                  value={paymentNetwork}
                  onChange={(e) => setPaymentNetwork(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="mtn">MTN MoMo</option>
                  <option value="telecel">Telecel Cash</option>
                  <option value="airteltigo">AirtelTigo Money</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>MoMo Number</Label>
                <Input
                  placeholder="e.g. +233 24 000 0000"
                  value={paymentAccount}
                  onChange={(e) => setPaymentAccount(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="note">Order note (optional)</Label>
            <Textarea
              id="note"
              placeholder="Any special instructions for the seller..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex gap-2 text-xs text-amber-400">
            <Shield className="size-4 shrink-0 mt-0.5" />
            <span>Only pay through official Aurriq checkout. Mobile Money details are captured here so your order can be confirmed inside the marketplace.</span>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="size-4 animate-spin" />}
              Place Order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CartPageInner() {
  const cartItems = useQuery(api.cart.getCartItems, {}) as CartItem[] | undefined;
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [, forceRefresh] = useState(0);

  if (cartItems === undefined) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const validItems = cartItems.filter((item) => item.product !== null);
  const subtotal = validItems.reduce((sum, item) => {
    const price = item.product!.promoPrice ?? item.product!.originalPrice;
    return sum + price * item.quantity;
  }, 0);

  if (validItems.length === 0) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-5 text-center px-4">
        <div className="size-20 rounded-full bg-muted flex items-center justify-center">
          <ShoppingBag className="size-9 text-muted-foreground/40" />
        </div>
        <div>
          <h2 className="text-2xl font-light mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Your cart is empty</h2>
          <p className="text-muted-foreground text-sm">Browse our marketplace and find something you love.</p>
        </div>
        <Button asChild>
          <Link to="/shop">Explore Shop</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors cursor-pointer">
          <ArrowLeft className="size-3.5" /> Continue Shopping
        </Link>

        <h1 className="text-3xl font-light mb-8" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          Shopping Cart <span className="text-muted-foreground text-lg">({validItems.length})</span>
        </h1>

        <div>
          {validItems.map((item) => (
            <CartItemRow
              key={item._id}
              item={item}
              onRemove={() => forceRefresh((n) => n + 1)}
            />
          ))}
        </div>

        {/* Order summary */}
        <div className="mt-8 bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-widest">Order Summary</h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal ({validItems.length} items)</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery</span>
            <span className="text-muted-foreground">Arranged with seller</span>
          </div>
          <div className="border-t border-border pt-4 flex justify-between font-semibold">
            <span>Total</span>
            <span className="text-primary text-lg">{formatCurrency(subtotal)}</span>
          </div>
          <Button className="w-full" size="lg" onClick={() => setCheckoutOpen(true)}>
            Proceed to Checkout
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            By placing an order you agree to our marketplace guidelines and buyer protection terms.
          </p>
        </div>
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        total={subtotal}
        items={validItems}
      />
    </>
  );
}

export default function CartPage() {
  return (
    <>
      <Unauthenticated>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 text-center px-4">
          <div className="size-20 rounded-full bg-muted flex items-center justify-center">
            <ShoppingBag className="size-9 text-muted-foreground/40" />
          </div>
          <div>
            <h2 className="text-2xl font-light mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Sign in to view your cart</h2>
            <p className="text-muted-foreground text-sm mb-4">Your saved items are waiting for you.</p>
            <SignInButton />
          </div>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </AuthLoading>
      <Authenticated>
        <CartPageInner />
      </Authenticated>
    </>
  );
}
