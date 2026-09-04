import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api.js";
import { useSearchParams, Link } from "react-router-dom";
import { Search, Package, MapPin, Loader2, Navigation, Store, Map as MapIcon, List, Heart } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { cn } from "@/lib/utils.ts";
import { VerifiedBadge } from "@/components/trust/VerifiedBadge.tsx";
import { Id } from "../../../convex/_generated/dataModel"; // Imported to type-cast the sellerId safely
import { formatCurrency } from "@/lib/utils.ts";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "hair", label: "Hair" },
  { value: "cosmetics", label: "Cosmetics" },
  { value: "skincare", label: "Skincare" },
  { value: "nails", label: "Nails" },
  { value: "fragrance", label: "Fragrance" },
  { value: "tools", label: "Tools" },
];

const BUSINESS_LABEL: Record<string, string> = {
  salon: "Salon",
  barbershop: "Barbershop",
  nail_tech: "Nail Tech",
  lash_tech: "Lash Tech",
  makeup: "Makeup Artist",
  spa: "Spa",
  other: "Beauty Pro",
};

// Fix Leaflet's default marker icons (broken by bundlers).
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const buyerIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 3px rgba(59,130,246,0.35)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

type Coords = { lat: number; lng: number };

// "From people you follow" — latest products from sellers the buyer follows.
function FollowingFeed() {
  const feed = useQuery((api.follows as any).getFollowedProducts, {}) as any[] | undefined;

  if (!feed || feed.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="text-lg font-medium flex items-center gap-2 mb-4">
        <Heart className="size-4 text-primary" /> From people you follow
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4">
        {feed.map((p) => {
          const price = p.promoPrice ?? p.originalPrice;
          return (
            <Link key={p._id} to={`/product/${p._id}`} className="group shrink-0 w-40">
              <div className="aspect-square rounded-xl overflow-hidden bg-muted border border-border mb-2">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Package className="size-8 text-muted-foreground/30" /></div>
                )}
              </div>
              <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">{p.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{p.sellerName}</p>
              <p className="text-xs font-bold text-primary mt-0.5">{formatCurrency(price)}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// "Near You" — opt-in buyer geolocation listing nearby shops/sellers + map view.
function NearYouSection({ coords, locating, enabled, onDetect }: {
  coords: Coords | null;
  locating: boolean;
  enabled: boolean;
  onDetect: () => void;
}) {
  const [view, setView] = useState<"list" | "map">("list");

  const nearby = useQuery(
    (api.users as any).getNearbyShops,
    enabled && coords ? { latitude: coords.lat, longitude: coords.lng } : "skip"
  ) as any[] | undefined;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Navigation className="size-4 text-primary" /> Shops near you
          </h2>
          <p className="text-xs text-muted-foreground">Salons, barbershops, nail & lash techs and sellers close to you.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {enabled && nearby && nearby.length > 0 && (
            <div className="flex rounded-full border border-border overflow-hidden">
              <button
                onClick={() => setView("list")}
                className={cn("px-2.5 py-1.5 text-xs flex items-center gap-1 cursor-pointer", view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              >
                <List className="size-3.5" /> List
              </button>
              <button
                onClick={() => setView("map")}
                className={cn("px-2.5 py-1.5 text-xs flex items-center gap-1 cursor-pointer", view === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              >
                <MapIcon className="size-3.5" /> Map
              </button>
            </div>
          )}
          <button
            onClick={onDetect}
            disabled={locating}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer",
              enabled ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            {locating ? <Loader2 className="size-3.5 animate-spin" /> : <MapPin className="size-3.5" />}
            {enabled ? "Location on" : "Use my location"}
          </button>
        </div>
      </div>

      {!enabled ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-xl px-4 py-6 text-center">
          Turn on location to discover shops and beauty pros around you. We only use it to sort by distance — nothing is stored or shared.
        </p>
      ) : nearby === undefined ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : nearby.length === 0 ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-xl px-4 py-6 text-center">
          No shops near you yet. Sellers who share their location will appear here.
        </p>
      ) : view === "map" && coords ? (
        <div className="rounded-xl overflow-hidden border border-border">
          <MapContainer center={[coords.lat, coords.lng]} zoom={13} style={{ height: "380px", width: "100%" }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Circle center={[coords.lat, coords.lng]} radius={800} pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.08, weight: 1 }} />
            <Marker position={[coords.lat, coords.lng]} icon={buyerIcon}>
              <Popup>You are here</Popup>
            </Marker>
            <MarkerClusterGroup chunkedLoading maxClusterRadius={48} showCoverageOnHover={false}>
              {nearby.map((s) =>
                typeof s.latitude === "number" && typeof s.longitude === "number" ? (
                  <Marker key={s._id} position={[s.latitude, s.longitude]}>
                    <Popup>
                      <div style={{ minWidth: 140 }}>
                        <strong>{s.name}</strong>
                        {s.businessType && <div style={{ fontSize: 11, color: "#c9930a" }}>{BUSINESS_LABEL[s.businessType] ?? "Beauty Pro"}</div>}
                        <div style={{ fontSize: 11, color: "#666" }}>{s.distanceKm < 1 ? `${Math.round(s.distanceKm * 1000)} m` : `${s.distanceKm.toFixed(1)} km`} away</div>
                        <a href={`/shop?sellerId=${s._id}`} style={{ fontSize: 12, color: "#c9930a", fontWeight: 600 }}>Visit shop →</a>
                      </div>
                    </Popup>
                  </Marker>
                ) : null
              )}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {nearby.map((s) => (
            <Link
              key={s._id}
              to={`/shop?sellerId=${s._id}`}
              className="group rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0 border border-border">
                  {s.image ? (
                    <img src={s.image} alt={s.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Store className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors flex items-center gap-1">
                    {s.name}
                    {s.isVerified && <VerifiedBadge size="xs" />}
                  </p>
                  {s.businessType && (
                    <span className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 mt-0.5">
                      {BUSINESS_LABEL[s.businessType] ?? "Beauty Pro"}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="size-3 text-primary shrink-0" />
                <span className="truncate">{s.locationLabel ?? "Nearby"}</span>
                <span className="ml-auto shrink-0 font-medium text-foreground">{s.distanceKm < 1 ? `${Math.round(s.distanceKm * 1000)} m` : `${s.distanceKm.toFixed(1)} km`}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category") ?? "";
  
  // UPGRADE: Grab the seller ID from the URL if a client clicks over from DOABookPro
  const sellerIdParam = searchParams.get("sellerId") as Id<"users"> | null;

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch] = useDebounce(searchInput, 350);

  // Shared buyer location (used by the Near You map + the product distance filter)
  const [buyerCoords, setBuyerCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);

  const detectLocation = () => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuyerCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationEnabled(true);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // UPGRADE: Pass the optional sellerId down into your backend query hook
  const products = useQuery(api.products.listAll, {
      category: categoryParam || undefined,
      search: debouncedSearch || undefined,
      sellerId: sellerIdParam || undefined,
      nearLat: maxDistance != null && buyerCoords ? buyerCoords.lat : undefined,
      nearLng: maxDistance != null && buyerCoords ? buyerCoords.lng : undefined,
      maxDistanceKm: maxDistance ?? undefined,
    } as any);

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
              ? `${products && products.length > 0 ? (products[0] as any).sellerName : "Salon"} Showcase`
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

      {/* Nearby shops discovery */}
      {!sellerIdParam && (
        <NearYouSection coords={buyerCoords} locating={locating} enabled={locationEnabled} onDetect={detectLocation} />
      )}

      {/* Products from people the buyer follows */}
      {!sellerIdParam && <FollowingFeed />}

      {/* Distance filter for the product grid */}
      {!sellerIdParam && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <MapPin className="size-3.5 text-primary" /> Distance:
          </span>
          {([null, 5, 10, 25, 50] as const).map((d) => (
            <button
              key={String(d)}
              onClick={() => {
                if (d != null && !locationEnabled) detectLocation();
                setMaxDistance(d);
              }}
              className={cn(
                "px-3 py-1.5 text-xs rounded-full border transition-all cursor-pointer",
                maxDistance === d
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {d == null ? "Any distance" : `Within ${d} km`}
            </button>
          ))}
          {maxDistance != null && !locationEnabled && (
            <span className="text-[11px] text-amber-500">enable location to apply</span>
          )}
        </div>
      )}

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
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    <p className="text-[11px] text-muted-foreground">by {(p as any).sellerName}</p>
                    {(p as any).sellerIsVerified && <VerifiedBadge size="xs" />}
                    {(p as any).sellerBusinessType && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                        {(p as any).sellerBusinessType === "salon" ? "Salon"
                          : (p as any).sellerBusinessType === "barbershop" ? "Barbershop"
                          : (p as any).sellerBusinessType === "nail_tech" ? "Nail Tech"
                          : (p as any).sellerBusinessType === "lash_tech" ? "Lash Tech"
                          : (p as any).sellerBusinessType === "makeup" ? "Makeup Artist"
                          : (p as any).sellerBusinessType === "spa" ? "Spa"
                          : "Beauty Pro"}
                      </span>
                    )}
                    {typeof (p as any).distanceKm === "number" && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-0.5">
                        <MapPin className="size-2.5" />
                        {(p as any).distanceKm < 1 ? `${Math.round((p as any).distanceKm * 1000)} m` : `${(p as any).distanceKm.toFixed(1)} km`}
                      </span>
                    )}
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
