import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { ShoppingBag, ShoppingCart, MessageSquare, ClipboardList, LayoutDashboard, LogOut } from "lucide-react";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner"; // Added import

const navLinks = [
  { path: "/shop", label: "Shop", icon: <ShoppingBag className="size-4" /> },
  { path: "/cart", label: "Cart", icon: <ShoppingCart className="size-4" /> },
  { path: "/orders", label: "Orders", icon: <ClipboardList className="size-4" /> },
  { path: "/messages", label: "Messages", icon: <MessageSquare className="size-4" /> },
  { path: "/seller/dashboard", label: "My Shop", icon: <LayoutDashboard className="size-4" /> },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signout } = useAuth();
  const isSso = localStorage.getItem("marketplace_seller_id") !== null;

  // Logic to block navigation
  const handleNavClick = (path: string, e: React.MouseEvent) => {
    const IS_LAUNCHED = false; // Change to true when ready!
    const restrictedPaths = ["/shop", "/cart", "/orders", "/messages"];

    if (!IS_LAUNCHED && restrictedPaths.includes(path)) {
      e.preventDefault(); 
      toast.error("Launching Soon", {
        description: "The marketplace is under construction. Stay tuned!"
      });
      return;
    }
    navigate(path);
  };

  const handleSignOut = async () => {
    localStorage.removeItem("marketplace_seller_id");
    localStorage.removeItem("marketplace_seller_subdomain");
    await signout?.();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <button onClick={() => navigate("/")}
            className="text-xl font-light tracking-wide cursor-pointer"
            style={{ fontFamily: "var(--font-serif)" }}>
            Aurriq
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <button key={link.path} onClick={(e) => handleNavClick(link.path, e)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer",
                  location.pathname === link.path
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}>
                {link.icon} {link.label}
              </button>
            ))}
          </nav>

          {/* Auth area */}
          <div className="flex items-center gap-2">
            {isSso ? (
              <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={handleSignOut}>
                <LogOut className="size-3.5" /> Sign Out
              </Button>
            ) : (
              <>
                <Unauthenticated><SignInButton /></Unauthenticated>
                <Authenticated>
                  <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={handleSignOut}>
                    <LogOut className="size-3.5" /> Sign Out
                  </Button>
                </Authenticated>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden border-t border-border bg-background">
        {navLinks.map((link) => (
          <button key={link.path} onClick={(e) => handleNavClick(link.path, e)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] cursor-pointer transition-colors",
              location.pathname === link.path ? "text-primary" : "text-muted-foreground"
            )}>
            {link.icon}
            <span>{link.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}