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
    void storeUser().catch(() => undefined);
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