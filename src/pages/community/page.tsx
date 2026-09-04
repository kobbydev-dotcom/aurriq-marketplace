import { useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Package, ShoppingBag, Store, Users } from "lucide-react";
import { api } from "../../../convex/_generated/api.js";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { FollowButton } from "@/components/follow-button.tsx";
import { formatCurrency } from "@/lib/utils.ts";

type View = "members" | "vendors" | "products" | "sales";

const titles: Record<View, { title: string; description: string }> = {
  members: { title: "Aurriq members", description: "Meet the people building their beauty routines and businesses on Aurriq." },
  vendors: { title: "Aurriq vendors", description: "Discover verified beauty professionals and their live storefronts." },
  products: { title: "Live products", description: "Browse products currently available from Aurriq vendors." },
  sales: { title: "Sales completed", description: "A live pulse of marketplace activity, with buyer privacy protected." },
};

function Presence({ lastSeenAt }: { lastSeenAt?: number }) {
  const online = typeof lastSeenAt === "number" && Date.now() - lastSeenAt < 5 * 60 * 1000;
  return <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className={`size-2 rounded-full ${online ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/50"}`} />{online ? "Online now" : "Offline"}</span>;
}

export default function CommunityPage() {
  const requested = useParams<{ view: string }>().view as View;
  const view: View = requested in titles ? requested : "members";
  const data = useQuery(((api as any).platform.getDirectory), { view }) as any;
  const meta = titles[view];

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> Back to Aurriq</Link>
        <div className="mb-8 flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-primary">Live marketplace</p><h1 className="text-4xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{meta.title}</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">{meta.description}</p></div>
          <nav className="flex max-w-full gap-2 overflow-x-auto pb-1 text-xs">
            {(Object.keys(titles) as View[]).map((key) => <Link key={key} to={`/community/${key}`} className={`shrink-0 rounded-full border px-3 py-1.5 capitalize ${key === view ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{key}</Link>)}
          </nav>
        </div>

        {data === undefined ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div> : view === "products" ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{data.items.map((item: any) => <Link key={item._id} to={`/product/${item._id}`} className="group overflow-hidden rounded-xl border border-border bg-card"><div className="aspect-square bg-muted">{item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" /> : <Package className="m-auto mt-16 size-8 text-muted-foreground/40" />}</div><div className="p-3"><p className="truncate text-sm font-medium">{item.name}</p><p className="truncate text-xs text-muted-foreground">{item.sellerName}</p><p className="mt-2 text-sm font-semibold text-primary">{formatCurrency(item.price)}</p></div></Link>)}</div>
        ) : view === "sales" ? (
          <div className="space-y-3">{data.items.map((item: any) => <div key={item._id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10"><ShoppingBag className="size-4 text-primary" /></div><div className="min-w-0 flex-1"><p className="text-sm">A buyer purchased <Link className="font-medium hover:text-primary" to={`/product/${item.productId}`}>{item.productName}</Link></p><p className="text-xs text-muted-foreground">from <Link className="hover:text-primary" to={`/storefront/${item.sellerId}`}>{item.sellerName}</Link> · {item.quantity} item{item.quantity !== 1 ? "s" : ""}</p></div><span className="shrink-0 text-xs text-muted-foreground">{item.when}</span></div>)}</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((item: any) => <div key={item._id} className="rounded-xl border border-border bg-card p-4"><div className="flex items-start gap-3"><div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">{item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" /> : <Users className="size-5 text-muted-foreground" />}</div><div className="min-w-0 flex-1"><p className="truncate font-medium">{item.name}</p><div className="mt-1 flex flex-wrap items-center gap-2"><Presence lastSeenAt={item.lastSeenAt} />{item.businessType && <Badge variant="secondary" className="text-[10px]">{item.businessType.replace("_", " ")}</Badge>}</div></div></div><p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{item.customServiceDescription || (item.serviceTypes?.length ? item.serviceTypes.join(" · ") : "Aurriq community member")}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-2"><FollowButton userId={item._id} sellerName={item.name} /><Button asChild size="sm" variant="outline" className="gap-1"><Link to={`/storefront/${item._id}`}><Store className="size-3.5" /> Visit shop</Link></Button></div></div>)}</div>)}
        {data?.items?.length === 0 && <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">Nothing to show yet. Check back as the marketplace grows.</div>}
      </div>
    </div>
  );
}