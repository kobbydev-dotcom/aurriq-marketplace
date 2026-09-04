import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api.js";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { FileText, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { formatCurrency } from "@/lib/utils.ts";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  quoted: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  accepted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  declined: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function SellerRfqsTab() {
  const rfqs = useQuery((api.rfq as any).getSellerRfqs, {}) as any[] | undefined;
  const respond = useMutation((api.rfq as any).respondToRfq);
  const [responding, setResponding] = useState<string | null>(null);
  const [quotePrice, setQuotePrice] = useState<Record<string, string>>({});
  const [quoteNote, setQuoteNote] = useState<Record<string, string>>({});

  const send = async (rfqId: string, status: "quoted" | "declined") => {
    setResponding(rfqId);
    try {
      await respond({
        rfqId,
        status,
        quotedPrice: status === "quoted" ? Number(quotePrice[rfqId] ?? 0) : undefined,
        sellerNote: quoteNote[rfqId]?.trim() || undefined,
      });
      toast.success(status === "quoted" ? "Quote sent to the buyer" : "Request declined");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Failed to respond";
      toast.error(msg);
    } finally {
      setResponding(null);
    }
  };

  if (rfqs === undefined) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>;
  }

  if (rfqs.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><FileText /></EmptyMedia>
          <EmptyTitle>No quote requests</EmptyTitle>
          <EmptyDescription>Buyers can request custom or bulk quotes from your product pages. They'll appear here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{rfqs.length} request{rfqs.length !== 1 ? "s" : ""}</p>
      {rfqs.map((r) => (
        <Card key={r._id}>
          <CardContent className="p-5">
            <div className="flex gap-4">
              <div className="size-14 rounded-lg overflow-hidden bg-muted shrink-0">
                {r.productImage ? <img src={r.productImage} alt="" className="w-full h-full object-cover" /> : <FileText className="m-4 size-6 text-muted-foreground/40" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{r.productName ?? "Custom request"}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.buyerName} · Qty {r.quantity}
                      {r.targetPrice ? ` · target ${formatCurrency(r.targetPrice)}/unit` : ""}
                      {" · "}{formatDistanceToNow(r._creationTime, { addSuffix: true })}
                    </p>
                    {r.message && <p className="text-xs text-muted-foreground italic mt-1">"{r.message}"</p>}
                  </div>
                  <Badge className={`text-[10px] border ${STATUS_COLORS[r.status] ?? STATUS_COLORS.open}`}>{r.status}</Badge>
                </div>

                {r.status === "open" && (
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <Input
                      type="number"
                      placeholder="Quoted price/unit (GHS)"
                      value={quotePrice[r._id] ?? ""}
                      onChange={(e) => setQuotePrice((prev) => ({ ...prev, [r._id]: e.target.value }))}
                      className="h-9 sm:w-44"
                    />
                    <Input
                      placeholder="Note (optional)"
                      value={quoteNote[r._id] ?? ""}
                      onChange={(e) => setQuoteNote((prev) => ({ ...prev, [r._id]: e.target.value }))}
                      className="h-9 flex-1"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={responding === r._id || !quotePrice[r._id]}
                        onClick={() => send(r._id, "quoted")}
                      >
                        {responding === r._id ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5" />}
                        Send quote
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" disabled={responding === r._id} onClick={() => send(r._id, "declined")}>
                        <XCircle className="size-3.5" /> Decline
                      </Button>
                    </div>
                  </div>
                )}

                {r.status === "quoted" && (
                  <p className="text-xs text-emerald-400 mt-2">Quoted {formatCurrency(r.quotedPrice ?? 0)}/unit{r.sellerNote ? ` — "${r.sellerNote}"` : ""}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
