import { Link, useLocation, useNavigate } from "react-router-dom";
import { Unauthenticated, Authenticated, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SignInButton } from "@/components/ui/signin.tsx";
import { ShoppingCart, Menu, X, User, Store, Settings, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { CATEGORIES } from "@/lib/constants.ts";
import { motion } from "motion/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Sellers", href: "/seller/dashboard" },
];

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const user = useQuery(api.users.current);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .filter((n) => n.length > 0)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 3);
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: scrolled ? "rgba(6,4,0,0.96)" : "rgba(8,5,0,0.88)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(212,175,55,0.15)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
        <Link to="/" className="flex items-center gap-2 group flex-shrink-0" aria-label="Aurriq home">
          <span className="transition-transform group-hover:rotate-12 duration-300 select-none" style={{ color: "#C9930A", fontSize: "18px" }}>❋</span>
          <span className="uppercase" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "20px", fontWeight: 400, letterSpacing: "0.22em", color: "#C9930A" }}>Aurriq</span>
        </Link>

        <nav className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: "13px",
                letterSpacing: "0.08em",
                fontWeight: 400,
                color: location.pathname === link.href ? "#C9930A" : "rgba(240,234,224,0.65)",
                transition: "color 0.2s",
              }}
              className="hover:text-[#C9930A]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-5">
          <Link to="/cart" className="transition-colors" style={{ color: "rgba(240,234,224,0.5)" }} aria-label="Cart">
            <ShoppingCart className="size-5" style={{ strokeWidth: 1.5 }} />
          </Link>

          <Unauthenticated>
            <div className="hidden md:flex rounded-full text-[11px] font-semibold border-0 flex-shrink-0 overflow-hidden" style={{ background: "#C9930A", color: "#0A0600", height: "36px", paddingLeft: "20px", paddingRight: "20px", letterSpacing: "0.08em", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <SignInButton />
            </div>
          </Unauthenticated>

          <Authenticated>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="hidden md:flex items-center justify-center rounded-full text-xs transition-all flex-shrink-0 hover:scale-105"
                  style={{ background: "#C9930A", color: "#0A0600", height: "36px", width: "36px", fontWeight: 600, cursor: "pointer" }}
                >
                  {user === undefined ? "" : user?.name ? getInitials(user.name) : "U"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-[#0A0600] border-[#C9930A]/20 text-[#F0EAE0]">
                <DropdownMenuItem onClick={() => navigate("/profile")}><User className="mr-2 size-4" /> Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/seller/dashboard")}><Store className="mr-2 size-4" /> Vendor Dashboard</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profile")}><Settings className="mr-2 size-4" /> General Settings</DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#C9930A]/10" />
                <DropdownMenuItem onClick={() => window.location.reload()} className="text-red-400"><LogOut className="mr-2 size-4" /> Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Authenticated>

          <button className="md:hidden transition-colors" style={{ color: "rgba(240,234,224,0.5)" }} onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      
      <div className="hidden md:block border-t" style={{ borderColor: "rgba(212,175,55,0.1)", height: "38px" }}>
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center gap-8">
          {CATEGORIES.map((cat) => (
            <Link key={cat.slug} to={`/shop?category=${cat.slug}`} className="transition-colors duration-200" style={{ fontFamily: "'Geist', sans-serif", fontSize: "10px", letterSpacing: "0.22em", fontWeight: 500, textTransform: "uppercase", color: location.search.includes(cat.slug) ? "#C9930A" : "rgba(180,155,80,0.55)" }}>
              {cat.label}
            </Link>
          ))}
        </div>
      </div>
    </motion.header>
  );
}