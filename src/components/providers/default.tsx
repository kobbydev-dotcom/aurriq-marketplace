import { ConvexReactClient, useConvexAuth, useMutation } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react"; // Use the official provider
import { useEffect } from "react";
import { api } from "../../../convex/_generated/api.js";
import { QueryClientProvider } from "./query-client.tsx";
import { ThemeProvider } from "./theme.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";

// Initialize the client here
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function MarketplaceUserSync() {
  const { isAuthenticated } = useConvexAuth();
  const storeUser = useMutation(api.users.storeUser);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const sync = async (attempt = 0) => {
      try {
        await storeUser();
      } catch (error) {
        if (cancelled || attempt >= 2) {
          console.error("Aurriq account synchronization failed", error);
          return;
        }
        timer = setTimeout(() => void sync(attempt + 1), 750 * (attempt + 1));
      }
    };

    void sync();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isAuthenticated, storeUser]);

  return null;
}

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      <MarketplaceUserSync />
      <QueryClientProvider>
        <TooltipProvider>
          <ThemeProvider>
            <Toaster />
            {children}
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ConvexAuthProvider>
  );
}