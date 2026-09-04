import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Eye, Store, ShoppingBag, TrendingUp, Users, DollarSign, Percent, Package, BarChart3,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils.ts";
import { Link } from "react-router-dom";

export default function AnalyticsTab() {
  const analytics = useQuery((api.analytics as any).getSellerAnalytics, {}) as any;
  const topProducts = useQuery((api.analytics as any).getTopProducts, {}) as any[] | undefined;

  if (analytics === undefined || topProducts === undefined) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!analytics) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Sign in to view analytics.</p>;
  }

  const stats = [
    { label: "Product views", value: analytics.productViews, icon: Eye },
    { label: "Shop visits", value: analytics.shopViews, icon: Store },
    { label: "Orders", value: analytics.ordersCount, icon: ShoppingBag },
    { label: "Followers", value: analytics.followers, icon: Users },
    { label: "Revenue", value: formatCurrency(analytics.totalRevenue), icon: DollarSign },
    { label: "Units sold", value: analytics.totalUnits, icon: Package },
    { label: "Conversion", value: `${analytics.conversionRate}%`, icon: Percent },
    { label: "Avg order value", value: formatCurrency(analytics.avgOrderValue), icon: TrendingUp },
  ];

  const maxViews = Math.max(1, ...analytics.viewsSeries.map((d: any) => d.views));

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <s.icon className="size-4 text-primary" />
              </div>
              <p className="text-2xl font-light mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Views over time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" /> Product views — last 14 days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1.5 h-40">
            {analytics.viewsSeries.map((d: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {d.views}
                </span>
                <div
                  className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors"
                  style={{ height: `${(d.views / maxViews) * 100}%`, minHeight: d.views > 0 ? 4 : 2 }}
                  title={`${d.day}: ${d.views} views`}
                />
                <span className="text-[9px] text-muted-foreground hidden sm:block">{d.day}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top products</CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No products yet.</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p: any, idx: number) => (
                <Link
                  key={p._id}
                  to={`/product/${p._id}`}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 hover:border-primary/40 transition-colors"
                >
                  <span className="text-xs text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                  <div className="size-10 rounded-md overflow-hidden bg-muted shrink-0">
                    {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <Package className="m-2 size-5 text-muted-foreground/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.views} views · {p.totalSold} sold</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-primary">{formatCurrency(p.totalRevenue)}</p>
                    <Badge variant="secondary" className="text-[9px]">{formatCurrency(p.price)}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
