import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useSearchParams, Link } from "react-router-dom";
import { Search, Package } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { cn } from "@/lib/utils.ts";
import { VerifiedBadge } from "@/components/trust/VerifiedBadge.tsx";
import { Id } from "@/convex/_generated/dataModel"; // Imported to type-cast the sellerId safely

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "hair", label: "Hair" },
  { value: "cosmetics", label: "Cosmetics" },
  { value: "skincare", label: "Skincare" },
  { value: "nails", label: "Nails" },
  { value: "fragrance", label: "Fragrance" },
  { value: "tools", label: "Tools" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
}

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category") ?? "";
  
  // UPGRADE: Grab the seller ID from the URL if a client clicks over from DOABookPro
  const sellerIdParam = searchParams.get("sellerId") as Id<"users"> | null;

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch] = useDebounce(searchInput, 350);

  // UPGRADE: Pass the optional sellerId down into your backend query hook
  const products = useQuery(api.products.listProducts, {
    category: categoryParam || undefined,
    search: debouncedSearch || undefined,
    sellerId: sellerIdParam || undefined,
  });

  const setCategory = (cat: string) => {
    const nextParams: Record<string, string> = {};
    if (cat) nextParams.category = cat;
    // Keep the sellerId in the URL if it's there when switching categories
    if (sellerIdParam) nextParams.sellerId = sellerIdParam; 
    setSearchParams(nextParams);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light mb-1" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {/* UPGRADE: Change title contextually if looking at a specific salon's inventory */}
            {sellerIdParam 
              ? `${products && products.length > 0 ? products[0].sellerName : "Salon"} Showcase` 
              : (categoryParam ? CATEGORIES.find((c) => c.value === categoryParam)?.label ?? "Shop" : "All Products")
            }
          </h1>
          <p className="text-sm text-muted-foreground">
            {products ? `${products.length} product${products.length !== 1 ? "s" : ""}` : "Loading..."}
          </p>
        </div>
        
        {/* Subtle badge indicating it's deep-linked from your booking application */}
        {sellerIdParam && products && products.length > 0 && (
          <Badge variant="secondary" className="w-fit self-start md:self-end font-normal text-xs bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/30 dark:text-purple-400">
            Exclusive Salon Storefront
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search products, brands..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-full border transition-all cursor-pointer",
                categoryParam === c.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {products === undefined ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Package /></EmptyMedia>
            <EmptyTitle>No products found</EmptyTitle>
            <EmptyDescription>
              {debouncedSearch ? `No results for "${debouncedSearch}"` : "No products available in this view yet. Check back soon!"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map((p) => {
            const activePrice = p.promoPrice ?? p.originalPrice;
            const mainImage = p.images[0];
            return (
              <Link
                key={p._id}
                to={`/product/${p._id}`}
                className="group cursor-pointer flex flex-col justify-between h-full"
              >
                <div>
                  <div className="relative aspect-square bg-muted rounded-xl overflow-hidden mb-3">
                    {mainImage ? (
                      <img
                        src={mainImage}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="size-10 text-muted-foreground/30" />
                      </div>
                    )}
                    {p.promoPrice && (
                      <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                        SALE
                      </div>
                    )}
                    {p.stockQuantity === 0 && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-xl">
                        <span className="text-xs text-muted-foreground font-medium">Out of Stock</span>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{p.brand}</p>
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{p.name}</p>
                  
                  {/* UPGRADE: Elegant color variations display using your micro styling rules */}
                  {p.variants && p.variants.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1 max-h-12 overflow-hidden">
                      {p.variants.map((v, idx) => (
                        <span 
                          key={idx} 
                          className="inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/40"
                        >
                          {v.color}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-primary">{formatCurrency(activePrice)}</span>
                    {p.promoPrice && (
                      <span className="text-xs text-muted-foreground line-through">{formatCurrency(p.originalPrice)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <p className="text-[11px] text-muted-foreground">by {p.sellerName}</p>
                    {(p as any).sellerIsVerified && <VerifiedBadge size="xs" />}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}