import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const REPORT_REASONS = [
  "Counterfeit / fake product",
  "Misleading product description",
  "Scam / fraud attempt",
  "Inappropriate content",
  "Harassment or threats",
  "Stolen goods",
  "Other",
] as const;

type ReportDialogProps =
  | {
      targetType: "product";
      targetProductId: Id<"products">;
      targetSellerId?: never;
      productName?: string;
    }
  | {
      targetType: "seller";
      targetSellerId: Id<"users">;
      targetProductId?: never;
      sellerName?: string;
    };

export function ReportDialog({
  children,
  ...props
}: ReportDialogProps & { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const submitReport = useMutation(api.reports.submitReport);

  const targetLabel =
    props.targetType === "product"
      ? `product "${props.productName ?? ""}"`
      : `seller "${props.sellerName ?? ""}"`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }
    setLoading(true);
    try {
      await submitReport({
        targetType: props.targetType,
        targetProductId: props.targetType === "product" ? props.targetProductId : undefined,
        targetSellerId: props.targetType === "seller" ? props.targetSellerId : undefined,
        reason,
        details: details.trim() || undefined,
      });
      toast.success("Report submitted. Our team will review it shortly.");
      setOpen(false);
      setReason("");
      setDetails("");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Failed to submit report";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <span onClick={() => setOpen(true)}>{children}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="size-4 text-destructive" /> Report {props.targetType === "product" ? "Product" : "Seller"}
            </DialogTitle>
            <DialogDescription>
              You are reporting the {targetLabel}. Reports are reviewed by the Aurriq team within 24 hours.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-1">
            <div>
              <Label className="text-sm font-medium mb-3 block">Reason for report</Label>
              <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
                {REPORT_REASONS.map((r) => (
                  <div key={r} className="flex items-center gap-2.5">
                    <RadioGroupItem value={r} id={r} />
                    <Label htmlFor={r} className="font-normal text-sm cursor-pointer">{r}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="details">Additional details (optional)</Label>
              <Textarea
                id="details"
                placeholder="Describe the issue in more detail..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">{details.length}/500</p>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={loading || !reason} className="gap-2">
                {loading && <Loader2 className="size-4 animate-spin" />}
                Submit Report
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
