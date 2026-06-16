import { BadgeCheck } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";

export function VerifiedBadge({ size = "sm" }: { size?: "xs" | "sm" | "md" }) {
  const sizeClass = size === "xs" ? "size-3" : size === "sm" ? "size-4" : "size-5";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center cursor-help">
            <BadgeCheck className={`${sizeClass} text-primary fill-primary/20`} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Verified Aurriq seller — identity confirmed by our team</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
