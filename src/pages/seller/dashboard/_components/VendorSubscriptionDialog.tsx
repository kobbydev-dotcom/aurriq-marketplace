import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Check, Loader2, Store, Sparkles, SearchCheck } from "lucide-react";
import { toast } from "sonner";

type PlanKey = "monthly" | "quarterly" | "biannual" | "annual";

const DIRECT_PLANS: Record<PlanKey, { label: string; amount: number; months: number; note: string }> = {
  monthly: { label: "Monthly", amount: 169, months: 1, note: "Flexible month-to-month access" },
  quarterly: { label: "Quarterly", amount: 479, months: 3, note: "Save GHS 28 vs monthly" },
  biannual: { label: "Biannual", amount: 899, months: 6, note: "Save GHS 115 vs monthly" },
  annual: { label: "Annual", amount: 1590, months: 12, note: "Best value — save GHS 438" },
};

const PARTNER_PLANS: Record<PlanKey, { label: string; amount: number; months: number; note: string }> = {
  monthly: { label: "Monthly partner", amount: 149, months: 1, note: "DOABookPro partner rate" },
  quarterly: { label: "Quarterly partner", amount: 419, months: 3, note: "Partner savings included" },
  biannual: { label: "Biannual partner", amount: 799, months: 6, note: "Partner savings included" },
  annual: { label: "Annual partner", amount: 1399, months: 12, note: "Best partner value" },
};

export default function VendorSubscriptionDialog({
  open,
  onOpenChange,
  isDoaBookProPartner,
  pendingPaymentReference,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDoaBookProPartner: boolean;
  pendingPaymentReference?: string;
}) {
  const startSubscription = useAction((api.payments as any).startMarketplaceSubscription);
  const verifySubscription = useMutation((api.payments as any).verifyMarketplaceSubscription);
  const recoverSubscription = useAction((api.payments as any).recoverMarketplaceSubscription);
  const plans = isDoaBookProPartner ? PARTNER_PLANS : DIRECT_PLANS;
  const [selected, setSelected] = useState<PlanKey>("annual");
  const [loading, setLoading] = useState(false);
  const [recoveryReference, setRecoveryReference] = useState("");
  const [recovering, setRecovering] = useState(false);

  const beginPayment = async () => {
    setLoading(true);
    try {
      if (pendingPaymentReference) {
        await verifySubscription({ paymentReference: pendingPaymentReference });
        toast.success("We’re checking your existing payment. Refresh shortly.");
        onOpenChange(false);
        return;
      }
      const result = await startSubscription({
        planKey: selected,
        source: isDoaBookProPartner ? "doabookpro" : "direct",
      });
      localStorage.setItem("aurriq_pending_vendor_payment", result.reference);
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start marketplace payment");
      setLoading(false);
    }
  };

  const recoverPayment = async () => {
    setRecovering(true);
    try {
      await recoverSubscription({ paymentReference: recoveryReference.trim() });
      toast.success("Payment recovered. Your marketplace access is active.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to recover payment");
    } finally {
      setRecovering(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="size-5 text-primary" /> Activate your Aurriq storefront
          </DialogTitle>
          <DialogDescription>
            Marketplace access is a separate vendor subscription from any DOABookPro booking subscription.
          </DialogDescription>
        </DialogHeader>

        {isDoaBookProPartner && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex gap-2">
            <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
            <span>You’re linked to DOABookPro, so partner pricing is applied automatically. Your booking subscription remains separate.</span>
          </div>
        )}

        {pendingPaymentReference && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            A marketplace payment is already pending for this account. We’ll verify it instead of creating another charge.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          {(Object.entries(plans) as [PlanKey, (typeof plans)[PlanKey]][]).map(([key, plan]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={`text-left rounded-xl border p-4 transition-colors cursor-pointer ${selected === key ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{plan.label}</p>
                  <p className="text-2xl font-semibold text-primary mt-1">GHS {plan.amount.toLocaleString()}</p>
                </div>
                {selected === key && <span className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Check className="size-3.5" /></span>}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{plan.note}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{plan.months} month{plan.months !== 1 ? "s" : ""} of storefront access</p>
            </button>
          ))}
        </div>

        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          Payment is processed securely through Aurriq’s Paystack checkout. Your storefront activates after payment confirmation.
        </div>

        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><SearchCheck className="size-4 text-emerald-500" /> Already paid?</p>
          <p className="text-xs text-muted-foreground">Paste the successful Paystack reference from your receipt. We’ll verify it against your signed-in email and won’t charge you again.</p>
          <div className="flex gap-2">
            <input
              value={recoveryReference}
              onChange={(event) => setRecoveryReference(event.target.value)}
              placeholder="AURRIQ-VENDOR-..."
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-xs"
            />
            <Button variant="outline" size="sm" onClick={recoverPayment} disabled={recovering || !recoveryReference.trim()}>
              {recovering && <Loader2 className="mr-1.5 size-3.5 animate-spin" />} Verify
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Not now</Button>
          <Button onClick={beginPayment} disabled={loading} className="gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {pendingPaymentReference ? "Verify existing payment" : "Continue to secure payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
