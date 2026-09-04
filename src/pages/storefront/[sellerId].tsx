import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useParams, Link } from "react-router-dom";
import { Package, MapPin, Star, ExternalLink, Store } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

const BUSINESS_LABEL: Record<string, string> = {
  salon: "Salon",
  barbershop: "Barbershop",
  nail_tech: "Nail Tech",
  lash_tech: "Lash Tech",
  makeup: "Makeup Artist",
  spa: "Spa",
  other: "Beauty Pro",
};

/**
 * Embeddable / standalone storefront for a single seller.
 * Used on DOABookPro client booking pages (iframe or redirect) so a client
 * booking with an owner can also browse + buy that owner's products.
 */
export default function StorefrontPage() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const data = useQuery(
    (api.users as any).getStorefront,
    sellerId ? { sellerId: sellerId as any } : "skip"
  ) as any;

  if (data === undefined) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-center px-4">
        <Store className="size-10 text-muted-foreground/40" />
        <h2 className="text-xl font-medium">Shop not found</h2>
        <p className="text-sm text-muted-foreground">This seller hasn't set up a storefront yet.</p>
        <Button asChild variant="secondary"><Link to="/shop">Browse the marketplace</Link></Button>
      </div>
    );
  }

  const { seller, products, productCount, followerCount } = data;
  const marketplaceUrl = `${window.location.origin}/shop?sellerId=${seller._id}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Seller header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center gap-4">
          <div className="size-14 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center shrink-0">
            {seller.image ? (
              <img src={seller.image} alt={seller.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <Store className="size-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{seller.name}</h1>
              {seller.businessType && (
                <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">
                  {BUSINESS_LABEL[seller.businessType] ?? "Beauty Pro"}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              <span>{productCount} product{productCount !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>{followerCount} follower{followerCount !== 1 ? "s" : ""}</span>
              {seller.locationLabel && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1"><MapPin className="size-3 text-primary" /> {seller.locationLabel}</span>
                </>
              )}
            </div>
          </div>
          <Button asChild size="sm" className="gap-1.5 shrink-0">
            <a href={marketplaceUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" /> Open in marketplace
            </a>
          </Button>
        </div>
      </div>

      {/* Products */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {products.length === 0 ? (
          <div className="text-center py-14">
            <Package className="size-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No products listed yet — check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.map((p: any) => (
              <a
                key={p._id}
                href={`${window.location.origin}/product/${p._id}`}
                target="_blank"
                rel="noreferrer"
                className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors"
              >
                <div className="aspect-square bg-muted overflow-hidden relative">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Package className="size-8 text-muted-foreground/30" /></div>
                  )}
                  {p.originalPrice > p.price && (
                    <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded-full">SALE</span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium line-clamp-1 group-hover:text-primary transition-colors">{p.name}</p>
                  {p.ratingCount > 0 && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Star className="size-2.5 fill-amber-400 text-amber-400" /> {p.ratingAvg} ({p.ratingCount})
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs font-bold text-primary">{formatCurrency(p.price)}</span>
                    {p.originalPrice > p.price && (
                      <span className="text-[10px] text-muted-foreground line-through">{formatCurrency(p.originalPrice)}</span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground mt-8">
          Powered by <span className="text-primary font-medium">Aurriq</span> · shop securely in the marketplace
        </p>
      </div>
    </div>
  );
}
