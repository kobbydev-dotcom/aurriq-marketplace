import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import {
  ShieldCheck, Users, Flag, CheckCircle, XCircle, Clock,
  BadgeCheck, BadgeMinus, Loader2, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { SignInButton } from "@/components/ui/signin.tsx";
import { formatDistanceToNow } from "date-fns";
import type { Id } from "../../../convex/_generated/dataModel.d.ts";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select.tsx";

const REPORT_STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  reviewed: { label: "Reviewed", icon: Eye, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  resolved: { label: "Resolved", icon: CheckCircle, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  dismissed: { label: "Dismissed", icon: XCircle, color: "bg-muted text-muted-foreground border-border" },
} as const;

type ReportStatus = keyof typeof REPORT_STATUS_CONFIG;

// ── Sellers Panel ──
function SellersPanel() {
  const sellers = useQuery(api.admin.listSellers, {});
  const verifySeller = useMutation(api.admin.verifySellerById);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleVerify = async (userId: Id<"users">, verified: boolean) => {
    setLoadingId(userId);
    try {
      await verifySeller({ userId, verified });
      toast.success(verified ? "Seller verified!" : "Verification removed");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Failed";
      toast.error(msg);
    } finally {
      setLoadingId(null);
    }
  };

  if (sellers === undefined) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  if (sellers.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Users /></EmptyMedia>
          <EmptyTitle>No sellers yet</EmptyTitle>
          <EmptyDescription>Sellers will appear here once they activate their accounts.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {sellers.map((seller) => (
        <Card key={seller._id}>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {seller.avatar ? (
                <img src={seller.avatar} alt={seller.name} className="size-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="size-4 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium truncate">{seller.name ?? "Unknown"}</p>
                  {seller.isVerified && <BadgeCheck className="size-4 text-primary fill-primary/20 shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground">{seller.email} · {seller.productCount} product{seller.productCount !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant={seller.isVerified ? "secondary" : "default"}
              disabled={loadingId === seller._id}
              onClick={() => handleVerify(seller._id as Id<"users">, !seller.isVerified)}
              className="shrink-0 gap-1.5"
            >
              {loadingId === seller._id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : seller.isVerified ? (
                <><BadgeMinus className="size-3.5" /> Remove Verification</>
              ) : (
                <><BadgeCheck className="size-3.5" /> Verify Seller</>
              )}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Reports Panel ──
function ReportsPanel() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const reports = useQuery(api.admin.listReportsAdmin, { status: statusFilter });
  const updateStatus = useMutation(api.admin.updateReportStatusAdmin);

  const [resolveTarget, setResolveTarget] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [resolveAction, setResolveAction] = useState<"resolved" | "dismissed" | "reviewed">("resolved");
  const [submitting, setSubmitting] = useState(false);

  const handleAction = async () => {
    if (!resolveTarget) return;
    setSubmitting(true);
    try {
      await updateStatus({
        reportId: resolveTarget as Id<"reports">,
        status: resolveAction,
        adminNote: noteText.trim() || undefined,
      });
      toast.success(`Report marked as ${resolveAction}`);
      setResolveTarget(null);
      setNoteText("");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (reports === undefined) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{reports.length} report{reports.length !== 1 ? "s" : ""}</p>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {reports.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Flag /></EmptyMedia>
            <EmptyTitle>No {statusFilter} reports</EmptyTitle>
            <EmptyDescription>All clear!</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        reports.map((r) => {
          const cfg = REPORT_STATUS_CONFIG[r.status as ReportStatus];
          const StatusIcon = cfg.icon;
          return (
            <Card key={r._id}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-xs border flex items-center gap-1 ${cfg.color}`}>
                        <StatusIcon className="size-3" /> {cfg.label}
                      </Badge>
                      <Badge variant="secondary" className="text-xs capitalize">{r.targetType}</Badge>
                    </div>
                    <p className="text-sm font-medium">
                      {r.targetType === "product" ? r.productName ?? "Deleted product" : r.sellerName ?? "Deleted seller"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Reported by <strong>{r.reporterName}</strong> · {formatDistanceToNow(r._creationTime, { addSuffix: true })}
                    </p>
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs gap-1"
                        onClick={() => { setResolveTarget(r._id); setResolveAction("reviewed"); }}
                      >
                        <Eye className="size-3" /> Review
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => { setResolveTarget(r._id); setResolveAction("resolved"); }}
                      >
                        <CheckCircle className="size-3" /> Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1 text-muted-foreground"
                        onClick={() => { setResolveTarget(r._id); setResolveAction("dismissed"); }}
                      >
                        <XCircle className="size-3" /> Dismiss
                      </Button>
                    </div>
                  )}
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs space-y-1">
                  <p><span className="font-medium">Reason:</span> {r.reason}</p>
                  {r.details && <p className="text-muted-foreground">{r.details}</p>}
                </div>
                {r.adminNote && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                    Admin note: {r.adminNote}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={!!resolveTarget} onOpenChange={(v) => { if (!v) setResolveTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">{resolveAction} Report</DialogTitle>
            <DialogDescription>Optionally add a note about your decision.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Label htmlFor="note">Admin note (optional)</Label>
            <Textarea
              id="note"
              placeholder="e.g. Confirmed scam, seller suspended"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="ghost" onClick={() => setResolveTarget(null)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleAction} disabled={submitting} className="gap-2 capitalize">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {resolveAction} Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Admin Page ──
function AdminPageInner() {
  const currentUser = useQuery(api.users.current, {});

  if (currentUser === undefined) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== "seller" || !currentUser.isVerified) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldCheck className="size-7 text-destructive" />
        </div>
        <h2 className="text-2xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Admin Access Only</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          This area is restricted to verified Aurriq administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Admin Panel</h1>
          <p className="text-xs text-muted-foreground">Trust & Safety — Aurriq Marketplace</p>
        </div>
      </div>

      <Tabs defaultValue="reports">
        <TabsList className="mb-6">
          <TabsTrigger value="reports" className="gap-2 cursor-pointer">
            <Flag className="size-3.5" /> Reports
          </TabsTrigger>
          <TabsTrigger value="sellers" className="gap-2 cursor-pointer">
            <Users className="size-3.5" /> Sellers
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reports">
          <ReportsPanel />
        </TabsContent>
        <TabsContent value="sellers">
          <SellersPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdminPage() {
  return (
    <>
      <Unauthenticated>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
          <p className="text-muted-foreground text-sm">Sign in to access the admin panel.</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
          <Skeleton className="h-10 w-48" />
        </div>
      </AuthLoading>
      <Authenticated>
        <AdminPageInner />
      </Authenticated>
    </>
  );
}
