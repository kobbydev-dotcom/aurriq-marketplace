import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Authenticated, Unauthenticated } from "convex/react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Trash2, ArrowLeft, ShoppingCart, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

export default function WishlistPage() {
  const navigate = useNavigate();
  const items = useQuery((api.wishlist as any).getMyWishlist, {}) as any[] | undefined;
  const toggle = useMutation((api.wishlist as any).toggleWishlist);
  const addToCart = useMutation(api.cart.addToCart);

  const remove = async (productId: string) => {
    try {
      await toggle({ productId });
      toast.success("Removed from wishlist");
    } catch {
      toast.error("Couldn't remove item");
    }
  };

  const moveToCart = async (productId: string) => {
    try {
      await addToCart({ productId: productId as any, quantity: 1 });
      await toggle({ productId: productId as any });
      toast.success("Moved to cart");
    } catch {
      toast.error("Couldn't add to cart");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Button variant="ghost" onClick={() => navigate("/shop")} className="mb-6 gap-2">
        <ArrowLeft className="size-4" /> Back to Shop
      </Button>

      <Unauthenticated>
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">Sign in to view your wishlist.</p>
          <SignInButton />
        </div>
      </Unauthenticated>

      <Authenticated>
        <div className="mb-8">
          <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>My Wishlist</h1>
          <p className="text-muted-foreground text-sm">{items ? `${items.length} saved item${items.length !== 1 ? "s" : ""}` : "Loading..."}</p>
        </div>

        {items === undefined ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square w-full rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Heart /></EmptyMedia>
              <EmptyTitle>Your wishlist is empty</EmptyTitle>
              <EmptyDescription>Tap the heart on any product to save it here. We'll notify you if a saved item comes back in stock.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild><Link to="/shop">Browse products</Link></Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {items.map((p) => {
              const price = p.promoPrice ?? p.originalPrice;
              const outOfStock = p.stockQuantity === 0;
              return (
                <div key={p._id} className="group rounded-xl border border-border bg-card overflow-hidden">
                  <Link to={`/product/${p._id}`} className="block relative aspect-square bg-muted overflow-hidden">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="size-10 text-muted-foreground/30" /></div>
                    )}
                    {outOfStock && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <span className="text-xs font-medium text-muted-foreground">Out of stock</span>
                      </div>
                    )}
                  </Link>
                  <div className="p-3">
                    <Link to={`/product/${p._id}`} className="text-sm font-medium line-clamp-1 hover:text-primary transition-colors">{p.name}</Link>
                    <p className="text-sm font-bold text-primary mt-0.5">{formatCurrency(price)}</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="flex-1 gap-1.5 h-8 text-xs" disabled={outOfStock} onClick={() => moveToCart(p._id)}>
                        <ShoppingCart className="size-3.5" /> {outOfStock ? "Out" : "Add"}
                      </Button>
                      <Button size="icon" variant="outline" className="size-8 shrink-0" onClick={() => remove(p._id)} aria-label="Remove">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Authenticated>
    </div>
  );
}
