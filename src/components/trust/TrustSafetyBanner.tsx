import { ShieldCheck, AlertTriangle, Eye, Lock, CreditCard } from "lucide-react";

const BUYER_TIPS = [
  { icon: CreditCard, text: "Never pay outside Aurriq's official checkout — no bank transfers, no mobile money to strangers." },
  { icon: Eye, text: "Verify product photos match what you receive. Report discrepancies within 48 hours." },
  { icon: Lock, text: "Do not share your bank details, OTP codes, or passwords with any seller via chat." },
  { icon: AlertTriangle, text: "If a deal seems too good to be true, report the listing before purchasing." },
];

const SELLER_TIPS = [
  { icon: ShieldCheck, text: "Never share your Aurriq account credentials with buyers or third parties." },
  { icon: Eye, text: "Use real, accurate product photos and descriptions to build buyer trust." },
  { icon: AlertTriangle, text: "Report buyers who attempt to pay outside the platform or request personal banking info." },
  { icon: Lock, text: "Keep your contact details private until an order is confirmed through official channels." },
];

type Props = {
  variant: "buyer" | "seller";
  compact?: boolean;
};

export function TrustSafetyBanner({ variant, compact = false }: Props) {
  const tips = variant === "buyer" ? BUYER_TIPS : SELLER_TIPS;
  const title = variant === "buyer" ? "Buyer Protection Tips" : "Seller Safety Reminders";

  if (compact) {
    return (
      <div className="flex gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-400">
        <ShieldCheck className="size-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">{title}</p>
          <p className="text-amber-400/80">
            {variant === "buyer"
              ? "Never pay outside Aurriq. Always verify products. Report suspicious listings."
              : "Use real photos. Never share credentials. Report suspicious buyers."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-500/8 border border-amber-500/25 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="size-5 text-amber-400" />
        <p className="font-semibold text-amber-300 text-sm">{title}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {tips.map(({ icon: Icon, text }, i) => (
          <div key={i} className="flex gap-2.5 text-xs text-amber-400/80">
            <Icon className="size-3.5 shrink-0 mt-0.5 text-amber-400" />
            <span className="leading-relaxed">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
