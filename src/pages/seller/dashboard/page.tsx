import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { LayoutDashboard } from "lucide-react";
import SellerDashboardInner from "./_components/SellerDashboardInner.tsx";

export default function SellerDashboard() {
  // Check if our SSO Bridge has successfully established an identity
  const isSsoAuthenticated = localStorage.getItem("marketplace_seller_id") !== null;

  return (
    <>
      <AuthLoading>
        <div className="max-w-6xl mx-auto px-4 py-10 space-y-4">
          <Skeleton className="h-10 w-56" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        </div>
      </AuthLoading>

      {/* If SSO is active, bypass Convex auth and show the inner dashboard */}
      {isSsoAuthenticated ? (
        <SellerDashboardInner />
      ) : (
        <Unauthenticated>
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
            <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center">
              <LayoutDashboard className="size-6 text-primary" />
            </div>
            <h2 className="text-2xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Seller Dashboard
            </h2>
            <p className="text-muted-foreground text-sm max-w-xs mb-2">
              Sign in to manage your products, track inventory, and monitor your sales.
            </p>
            <SignInButton />
          </div>
        </Unauthenticated>
      )}

      {/* If Convex is actually authenticated, also show the inner dashboard */}
      <Authenticated>
        {!isSsoAuthenticated && <SellerDashboardInner />}
      </Authenticated>
    </>
  );
}