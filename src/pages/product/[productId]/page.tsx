import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api.js";
import { useState } from "react";
import { ShoppingCart, MessageCircle, Phone, ArrowLeft, Package, ChevronLeft, ChevronRight, Loader2, Plus, Minus, Flag } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "../../../../convex/_generated/dataModel.d.ts";
import { VerifiedBadge } from "@/components/trust/VerifiedBadge.tsx";
import { TrustSafetyBanner } from "@/components/trust/TrustSafetyBanner.tsx";
import { ReportDialog } from "@/components/trust/ReportDialog.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
}

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const product = useQuery(
    api.products.getProductById,
    productId ? { productId: productId as Id<"products"> } : "skip"
  );
  const addToCart = useMutation(api.cart.addToCart);

  const [selectedImage, setSelectedImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  const handleAddToCart = async () => {
    if (!productId) return;
    setAddingToCart(true);
    try {
      await addToCart({ productId: productId as Id<"products">, quantity: qty });
      toast.success("Added to cart!");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Failed to add to cart";
      toast.error(msg);
    } finally {
      setAddingToCart(false);
    }
  };

  if (product === undefined) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-10">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <Package className="size-12 text-muted-foreground/30" />
        <h2 className="text-xl font-medium">Product not found</h2>
        <Button asChild variant="secondary">
          <Link to="/shop">Back to Shop</Link>
        </Button>
      </div>
    );
  }

  const activePrice = product.promoPrice ?? product.originalPrice;
  const discountPct = product.promoPrice
    ? Math.round(((product.originalPrice - product.promoPrice) / product.originalPrice) * 100)
    : null;
  const images = product.images.length > 0 ? product.images : [];
  const isOutOfStock = product.stockQuantity === 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors cursor-pointer">
        <ArrowLeft className="size-3.5" /> Back to Shop
      </Link>

      <div className="grid md:grid-cols-2 gap-10">
        {/* Images */}
        <div className="space-y-3">
          <div className="relative aspect-square bg-muted rounded-xl overflow-hidden">
            {images[selectedImage] ? (
              <img src={images[selectedImage]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="size-16 text-muted-foreground/30" />
              </div>
            )}
            {product.promoPrice && discountPct && (
              <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                {discountPct}% OFF
              </div>
            )}
            {isOutOfStock && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded-xl">
                <span className="text-lg font-medium text-muted-foreground">Out of Stock</span>
              </div>
            )}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setSelectedImage((prev) => (prev - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-background/80 flex items-center justify-center cursor-pointer hover:bg-background transition-colors"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={() => setSelectedImage((prev) => (prev + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-background/80 flex items-center justify-center cursor-pointer hover:bg-background transition-colors"
                >
                  <ChevronRight className="size-4" />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`size-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${selectedImage === i ? "border-primary" : "border-transparent"}`}
                >
                  <img src={img} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-5">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{product.brand}</p>
            <h1 className="text-3xl font-light mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              {product.name}
            </h1>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-xs capitalize">{product.category}</Badge>
              {!isOutOfStock ? (
                <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  {product.stockQuantity} in stock
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-primary">{formatCurrency(activePrice)}</span>
            {product.promoPrice && (
              <span className="text-lg text-muted-foreground line-through pb-0.5">{formatCurrency(product.originalPrice)}</span>
            )}
          </div>

          {/* Description */}
          <div>
            <p className="text-sm font-medium mb-2">About this product</p>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{product.description}</p>
          </div>

          {/* Seller */}
          <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Sold by</p>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium">{product.seller?.name ?? "Aurriq Seller"}</p>
                {product.seller?.isVerified && <VerifiedBadge size="sm" />}
              </div>
            </div>
            <Authenticated>
              <ReportDialog
                targetType="seller"
                targetSellerId={product.sellerId}
                sellerName={product.seller?.name ?? "Seller"}
              >
                <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer">
                  <Flag className="size-3" /> Report Seller
                </button>
              </ReportDialog>
            </Authenticated>
          </div>

          {/* Trust & Safety Banner */}
          <TrustSafetyBanner variant="buyer" compact />

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <Authenticated>
              {/* Qty selector */}
              {!isOutOfStock && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Quantity</span>
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="px-3 py-1.5 hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="px-4 text-sm font-medium min-w-[2.5rem] text-center">{qty}</span>
                    <button
                      onClick={() => setQty((q) => Math.min(product.stockQuantity, q + 1))}
                      className="px-3 py-1.5 hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                </div>
              )}
              <Button
                className="w-full gap-2"
                size="lg"
                disabled={isOutOfStock || addingToCart}
                onClick={handleAddToCart}
              >
                {addingToCart ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
                {isOutOfStock ? "Out of Stock" : "Add to Cart"}
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => toast.info("Messaging coming in a future milestone!")}
                >
                  <MessageCircle className="size-4" /> Message Seller
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => toast.info("Call request coming in a future milestone!")}
                >
                  <Phone className="size-4" /> Request Call
                </Button>
              </div>
            </Authenticated>
            <Unauthenticated>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">Sign in to purchase or contact the seller</p>
                <SignInButton className="w-full" />
              </div>
            </Unauthenticated>
          </div>

          {/* Report product */}
          <Authenticated>
            <div className="pt-1 border-t border-border/30">
              <ReportDialog
                targetType="product"
                targetProductId={productId as Id<"products">}
                productName={product.name}
              >
                <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer w-full justify-center py-1">
                  <Flag className="size-3" /> Report this listing
                </button>
              </ReportDialog>
            </div>
          </Authenticated>
        </div>
      </div>
    </div>
  );
}
