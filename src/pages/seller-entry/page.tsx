import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";

// Helper for users already authenticated via Convex
function AuthenticatedRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/seller/dashboard", { replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner />
        <p className="text-muted-foreground text-sm">Taking you to your dashboard…</p>
      </div>
    </div>
  );
}

// UI for users who need to sign in
function SignInPrompt() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm px-6">
        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl font-bold tracking-tight text-primary">Aurriq</span>
          <span className="text-muted-foreground text-sm">Beauty Marketplace</span>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Welcome back, seller</h2>
          <p className="text-muted-foreground text-sm">
            Sign in to access your Aurriq seller dashboard — manage products,
            track inventory, and view orders.
          </p>
        </div>

        <SignInButton className="w-full" />

        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => (window.location.href = "/")}
        >
          Browse the marketplace instead
        </Button>
      </div>
    </div>
  );
}

export default function SellerEntryPage() {
  // Check if our Flask SSO bridge has established an identity
  // This bypasses the need for manual sign-in if coming from the Booking Dashboard
  const isSsoAuthenticated = localStorage.getItem("marketplace_seller_id") !== null;

  // If already authenticated by SSO, jump straight to the dashboard
  useEffect(() => {
    if (isSsoAuthenticated) {
      window.location.href = "/seller/dashboard";
    }
  }, [isSsoAuthenticated]);

  // If we are currently redirecting, show a spinner to prevent UI flicker
  if (isSsoAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center">
          <Spinner />
        </div>
      </AuthLoading>

      <Authenticated>
        <AuthenticatedRedirect />
      </Authenticated>

      <Unauthenticated>
        <SignInPrompt />
      </Unauthenticated>
    </>
  );
}
