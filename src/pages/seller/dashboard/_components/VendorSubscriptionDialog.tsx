import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Check, Loader2, Store, Landmark, Smartphone } from "lucide-react";
import { toast } from "sonner";

type PlanKey = "monthly" | "quarterly" | "biannual" | "annual";

const PLANS: Record<PlanKey, { label: string; amount: number; months: number; note: string }> = {
  monthly: { label: "Monthly", amount: 169, months: 1, note: "Flexible month-to-month access" },
  quarterly: { label: "Quarterly", amount: 479, months: 3, note: "Save GHS 28 vs monthly" },
  biannual: { label: "Biannual", amount: 899, months: 6, note: "Save GHS 115 vs monthly" },
  annual: { label: "Annual", amount: 1590, months: 12, note: "Best value — save GHS 438" },
};

export default function VendorSubscriptionDialog({
  open,
  onOpenChange,
  pendingPaymentReference,
  intent = "activation",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingPaymentReference?: string;
  intent?: "activation" | "top_up";
}) {
  const startSubscription = useAction((api.payments as any).startMarketplaceSubscription);
  const [selected, setSelected] = useState<PlanKey>("annual");
  const [loading, setLoading] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<any>(null);

  const beginPayment = async () => {
    setLoading(true);
    try {
      const result = await startSubscription({
        planKey: selected,
        source: "direct",
      });
      localStorage.setItem("aurriq_pending_vendor_payment", result.reference);
      setPaymentRequest(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start marketplace activation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="size-5 text-primary" /> {intent === "top_up" ? "Top up your Aurriq storefront" : "Activate your Aurriq storefront"}
          </DialogTitle>
          <DialogDescription>
            Marketplace access is a separate vendor subscription.
          </DialogDescription>
        </DialogHeader>

        {!paymentRequest ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
              {(Object.entries(PLANS) as [PlanKey, (typeof PLANS)[PlanKey]][]).map(([key, plan]) => (
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

            {pendingPaymentReference && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600">
                Your activation request is pending payment confirmation. Reference: <span className="font-semibold">{pendingPaymentReference}</span>
              </div>
            )}

            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              Continue to see the official MoMo and bank transfer details for the plan you selected.
            </div>
          </>
        ) : (
          <div className="space-y-4 animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
              <p className="font-medium">Pay GHS {Number(paymentRequest.amount).toLocaleString()} for {paymentRequest.planLabel}</p>
              <p className="mt-2 text-muted-foreground">
                Proceed with payment using any option below. {paymentRequest.requestType === "top_up" ? "Use Top Up with your shop or vendor name as the payment reference." : "Use your account name or store name as the payment reference."}
              </p>
              <p className="mt-2 text-muted-foreground">
                After payment, check your dashboard again in about 5 minutes. Also make sure your Profile has an active phone number saved so you can receive your SMS.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Activation reference: {paymentRequest.reference}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
              Need help or want to report an issue? Contact Aurriq Team on <span className="font-medium text-foreground">+233 27 442 1221</span> or <span className="font-medium text-foreground">devagyemang@gmail.com</span>.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 font-medium"><Smartphone className="size-4 text-primary" /> Mobile Money</div>
                <p className="mt-2 text-xs text-muted-foreground">Send payment to:</p>
                <p className="mt-1 text-lg font-semibold">{paymentRequest.payment.momo.number}</p>
                <p className="text-sm">{paymentRequest.payment.momo.name}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 font-medium"><Landmark className="size-4 text-primary" /> Bank Transfer</div>
                <p className="mt-2 text-xs text-muted-foreground">Use these details:</p>
                <p className="mt-1 text-sm font-semibold">{paymentRequest.payment.bank.accountName}</p>
                <p className="text-lg font-semibold">{paymentRequest.payment.bank.accountNumber}</p>
                <p className="text-sm">{paymentRequest.payment.bank.bankName} • {paymentRequest.payment.bank.branch}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          {paymentRequest ? (
            <>
              <Button variant="ghost" onClick={() => setPaymentRequest(null)} disabled={loading}>Back to plans</Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Not now</Button>
              <Button onClick={beginPayment} disabled={loading} className="gap-2">
                {loading && <Loader2 className="size-4 animate-spin" />}
                Continue to Secure Payment
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
