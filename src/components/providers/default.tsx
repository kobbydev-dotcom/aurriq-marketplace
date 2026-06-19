import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react"; // Use the official provider
import { QueryClientProvider } from "./query-client.tsx";
import { ThemeProvider } from "./theme.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";

// Initialize the client here
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
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