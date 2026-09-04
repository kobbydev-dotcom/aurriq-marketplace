import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api.js";
import { useState, useEffect, useRef } from "react";
import { ShoppingCart, MessageCircle, Phone, ArrowLeft, Package, ChevronLeft, ChevronRight, Loader2, Plus, Minus, Flag, Video, Eye, Heart, Star, FileText } from "lucide-react";
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
import { FollowButton } from "@/components/follow-button.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { formatCurrency } from "@/lib/utils.ts";

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const product = useQuery(
    api.products.getById,
    productId ? { productId: productId as Id<"products"> } : "skip"
  );
  const addToCart = useMutation(api.cart.addToCart);
  const sendMessage = useMutation(api.messages.sendMessage);
  const trackEvent = useMutation((api.analytics as any).trackEvent);
  const viewCount = useQuery(
    (api.analytics as any).getProductViewCount,
    productId ? { productId: productId as Id<"products"> } : "skip"
  ) as number | undefined;

  const [selectedImage, setSelectedImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const trackedRef = useRef(false);

  // Wishlist + reviews
  const isWishlisted = useQuery(
    (api.wishlist as any).isWishlisted,
    productId ? { productId: productId as Id<"products"> } : "skip"
  ) as boolean | undefined;
  const toggleWishlist = useMutation((api.wishlist as any).toggleWishlist);
  const reviews = useQuery(
    (api.reviews as any).getProductReviews,
    productId ? { productId: productId as Id<"products"> } : "skip"
  ) as any[] | undefined;
  const myReview = useQuery(
    (api.reviews as any).getMyReview,
    productId ? { productId: productId as Id<"products"> } : "skip"
  ) as any;
  const addReview = useMutation((api.reviews as any).addReview);
  const submitRfq = useMutation((api.rfq as any).submitRfq);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [rfqOpen, setRfqOpen] = useState(false);
  const [rfqQty, setRfqQty] = useState(10);
  const [rfqTarget, setRfqTarget] = useState("");
  const [rfqMessage, setRfqMessage] = useState("");
  const [submittingRfq, setSubmittingRfq] = useState(false);

  const handleSubmitRfq = async () => {
    if (!product) return;
    setSubmittingRfq(true);
    try {
      await submitRfq({
        sellerId: product.sellerId,
        productId: product._id,
        quantity: rfqQty,
        targetPrice: rfqTarget ? Number(rfqTarget) : undefined,
        message: rfqMessage.trim() || undefined,
      });
      toast.success("Quote request sent to the seller");
      setRfqOpen(false);
      setRfqMessage("");
      setRfqTarget("");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Failed to send request";
      toast.error(msg);
    } finally {
      setSubmittingRfq(false);
    }
  };

  const ratingAvg = (product as any)?.ratingAvg as number | undefined;
  const ratingCount = (product as any)?.ratingCount as number | undefined;

  const handleWishlist = async () => {
    if (!productId) return;
    try {
      const res = await toggleWishlist({ productId: productId as Id<"products"> });
      toast.success(res.wishlisted ? "Added to your wishlist" : "Removed from wishlist");
    } catch {
      toast.error("Sign in to save items");
    }
  };

  const handleSubmitReview = async () => {
    if (!productId || myRating === 0) return;
    setSavingReview(true);
    try {
      await addReview({ productId: productId as Id<"products">, rating: myRating, comment: myComment.trim() || undefined });
      toast.success("Thanks for your review!");
      setMyComment("");
    } catch {
      toast.error("Couldn't save your review");
    } finally {
      setSavingReview(false);
    }
  };

  // Track the product view + seller shop view once per mount.
  useEffect(() => {
    if (!product || trackedRef.current) return;
    trackedRef.current = true;
    trackEvent({
      subjectType: "product",
      subjectId: String(product._id),
      kind: "product_view",
      productId: product._id,
      sellerId: product.sellerId,
    }).catch(() => {});
    trackEvent({
      subjectType: "seller",
      subjectId: String(product.sellerId),
      kind: "shop_view",
      sellerId: product.sellerId,
    }).catch(() => {});
  }, [product, trackEvent]);

  const sellerBusinessType = (product as any)?.seller?.businessType ?? (product as any)?.sellerBusinessType;
  const sellerPhone = (product as any)?.seller?.phone ?? (product as any)?.sellerPhone;
  const businessLabel =
    sellerBusinessType === "salon" ? "Salon Owner"
    : sellerBusinessType === "barbershop" ? "Barbershop Owner"
    : sellerBusinessType === "nail_tech" ? "Nail Tech"
    : sellerBusinessType === "lash_tech" ? "Lash Tech"
    : sellerBusinessType === "makeup" ? "Makeup Artist"
    : sellerBusinessType === "spa" ? "Spa / Wellness"
    : sellerBusinessType === "other" ? "Beauty Service"
    : null;

  const handleSendMessage = async () => {
    if (!product || !messageText.trim()) return;
    setSending(true);
    try {
      await sendMessage({
        receiverId: product.sellerId,
        productId: product._id,
        content: messageText.trim(),
        type: "message",
      });
      toast.success("Message sent to the seller");
      setMessageText("");
      setMessageOpen(false);
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Failed to send message";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleRequestCall = async () => {
    if (!product) return;
    try {
      await sendMessage({
        receiverId: product.sellerId,
        productId: product._id,
        content: "I'd like to talk to you about this product. Please call me.",
        type: "call_request",
      });
      toast.success("Call request sent to the seller");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Failed to send request";
      toast.error(msg);
    }
  };

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
  const videos = (product as any).videos as string[] | undefined;
  const isOutOfStock = product.stockQuantity === 0;

  // Wholesale / bulk pricing
  const wholesalePrice = (product as any).wholesalePrice as number | undefined;
  const wholesaleMinQty = (product as any).wholesaleMinQty as number | undefined;
  const wholesaleActive = wholesalePrice != null && wholesaleMinQty != null;
  const unitPrice = wholesaleActive && qty >= (wholesaleMinQty ?? Infinity) ? wholesalePrice! : activePrice;
  const wholesaleSavings = wholesaleActive ? Math.round(((activePrice - wholesalePrice!) / activePrice) * 100) : 0;

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
          {videos && videos.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Video className="size-3.5 text-primary" /> Product videos</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {videos.map((videoUrl, index) => (
                  <video key={videoUrl || index} src={videoUrl} controls preload="metadata" className="aspect-video w-full rounded-lg border border-border bg-black" aria-label={`${product.name} video ${index + 1}`} />
                ))}
              </div>
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
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="secondary" className="text-xs capitalize">{product.category}</Badge>
              {!isOutOfStock ? (
                <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  {product.stockQuantity} in stock
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
              )}
              {typeof viewCount === "number" && viewCount > 0 && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Eye className="size-3" /> {viewCount} view{viewCount !== 1 ? "s" : ""}
                </span>
              )}
              {typeof ratingCount === "number" && ratingCount > 0 && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Star className="size-3 fill-amber-400 text-amber-400" /> {ratingAvg} ({ratingCount})
                </span>
              )}
            </div>
          </div>

          {/* Price */}
          <div>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-primary">{formatCurrency(unitPrice)}</span>
              {(product.promoPrice || (wholesaleActive && unitPrice === wholesalePrice)) && (
                <span className="text-lg text-muted-foreground line-through pb-0.5">{formatCurrency(product.originalPrice)}</span>
              )}
              {wholesaleActive && qty >= (wholesaleMinQty ?? Infinity) && (
                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30 mb-1">Wholesale price</Badge>
              )}
            </div>
            {wholesaleActive && (
              <p className="text-xs text-muted-foreground mt-1">
                {qty >= (wholesaleMinQty ?? Infinity) ? (
                  <>You're getting the wholesale rate — save {wholesaleSavings}% per unit.</>
                ) : (
                  <>Buy {wholesaleMinQty}+ units and pay <span className="text-primary font-medium">{formatCurrency(wholesalePrice!)}</span> each (save {wholesaleSavings}%).</>
                )}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <p className="text-sm font-medium mb-2">About this product</p>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{product.description}</p>
          </div>

          {/* Seller */}
          <div className="bg-card border border-border rounded-lg px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Sold by</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium">{(product as any).seller?.name ?? "Aurriq Seller"}</p>
                  {(product as any).seller?.isVerified && <VerifiedBadge size="sm" />}
                  {businessLabel && (
                    <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">{businessLabel}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <Authenticated>
                  <ReportDialog
                    targetType="seller"
                    targetSellerId={product.sellerId}
                    sellerName={(product as any).seller?.name ?? "Seller"}
                  >
                    <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer">
                      <Flag className="size-3" /> Report Seller
                    </button>
                  </ReportDialog>
                </Authenticated>
              </div>
            </div>
            <FollowButton userId={product.sellerId} sellerName={(product as any).seller?.name} />
            <Authenticated>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRfqOpen(true)}>
                <FileText className="size-3.5" /> Request a quote
              </Button>
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
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleWishlist}
              >
                <Heart className={`size-4 ${isWishlisted ? "fill-red-500 text-red-500" : ""}`} />
                {isWishlisted ? "Saved to wishlist" : "Save to wishlist"}
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => setMessageOpen(true)}
                >
                  <MessageCircle className="size-4" /> Message Seller
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => setCallOpen(true)}
                >
                  <Phone className="size-4" /> Request Call
                </Button>
              </div>
            </Authenticated>
            <Unauthenticated>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">Sign in to purchase or contact the seller</p>
                <div className="w-full">
                  <SignInButton />
                </div>
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

      {/* Reviews */}
      <div className="mt-12 border-t border-border/40 pt-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-light flex items-center gap-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Reviews {typeof ratingCount === "number" && ratingCount > 0 && (
              <span className="text-sm text-muted-foreground font-normal flex items-center gap-1">
                <Star className="size-4 fill-amber-400 text-amber-400" /> {ratingAvg} · {ratingCount}
              </span>
            )}
          </h2>
        </div>

        {/* Write a review */}
        <Authenticated>
          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <p className="text-sm font-medium mb-2">{myReview ? "Update your review" : "Rate this product"}</p>
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMyRating(n)}
                  className="cursor-pointer"
                  aria-label={`${n} star${n !== 1 ? "s" : ""}`}
                >
                  <Star className={`size-5 ${n <= (myRating || myReview?.rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Share your experience (optional)..."
              value={myComment}
              onChange={(e) => setMyComment(e.target.value)}
              rows={2}
            />
            <Button
              size="sm"
              className="mt-3"
              disabled={myRating === 0 || savingReview}
              onClick={handleSubmitReview}
            >
              {savingReview && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              {myReview ? "Update review" : "Submit review"}
            </Button>
          </div>
        </Authenticated>

        {/* Review list */}
        {!reviews || reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet — be the first to share your experience.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r._id} className="border-b border-border/40 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{r.userName}</span>
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`size-3 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </span>
                </div>
                {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request a quote dialog */}
      <Dialog open={rfqOpen} onOpenChange={setRfqOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request a quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">
              Ask {(product as any).seller?.name ?? "the seller"} for a custom or bulk price on {product.name}.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={rfqQty}
                  onChange={(e) => setRfqQty(Math.max(1, Number(e.target.value)))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Target price/unit (optional)</label>
                <input
                  type="number"
                  placeholder="GHS"
                  value={rfqTarget}
                  onChange={(e) => setRfqTarget(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>
            <Textarea
              placeholder="Add details — delivery location, timeline, custom requirements..."
              value={rfqMessage}
              onChange={(e) => setRfqMessage(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRfqOpen(false)} disabled={submittingRfq}>Cancel</Button>
            <Button onClick={handleSubmitRfq} disabled={submittingRfq} className="gap-2">
              {submittingRfq && <Loader2 className="size-4 animate-spin" />} Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message seller dialog */}
      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Message {(product as any).seller?.name ?? "Seller"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <Textarea
              placeholder="Ask about this product..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMessageOpen(false)} disabled={sending}>Cancel</Button>
            <Button onClick={handleSendMessage} disabled={sending || !messageText.trim()} className="gap-2">
              {sending && <Loader2 className="size-4 animate-spin" />} Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request call dialog */}
      <Dialog open={callOpen} onOpenChange={setCallOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request a call</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2 text-sm text-muted-foreground">
            {sellerPhone ? (
              <>
                <p>You can call the seller directly:</p>
                <a href={`tel:${sellerPhone}`} className="text-primary font-semibold text-lg">{sellerPhone}</a>
                <p className="text-xs">Or send a call request and they'll reach out to you.</p>
              </>
            ) : (
              <p>Send a call request and the seller will reach out to you about this product.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCallOpen(false)}>Close</Button>
            <Button
              className="gap-2"
              onClick={async () => { await handleRequestCall(); setCallOpen(false); }}
            >
              <Phone className="size-4" /> Send Call Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}