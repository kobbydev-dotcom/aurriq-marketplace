import { Link, useLocation } from "react-router-dom";
import { Unauthenticated, Authenticated } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { ShoppingCart, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { CATEGORIES } from "@/lib/constants.ts";
import { motion } from "motion/react";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Sellers", href: "/seller/dashboard" },
];

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

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
      {/* Main nav row */}
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
        {/* Logo — left */}
        <Link
          to="/"
          className="flex items-center gap-2 group flex-shrink-0"
          aria-label="Aurriq home"
        >
          <span
            className="transition-transform group-hover:rotate-12 duration-300 select-none"
            style={{ color: "#C9930A", fontSize: "18px" }}
            aria-hidden
          >
            ❋
          </span>
          <span
            className="uppercase"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "20px",
              fontWeight: 400,
              letterSpacing: "0.22em",
              color: "#C9930A",
            }}
          >
            Aurriq
          </span>
        </Link>

        {/* Nav — centered absolutely */}
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
                color:
                  location.pathname === link.href
                    ? "#C9930A"
                    : "rgba(240,234,224,0.65)",
                transition: "color 0.2s",
              }}
              className="hover:text-[#C9930A]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-5">
          <Link
            to="/cart"
            className="transition-colors"
            style={{ color: "rgba(240,234,224,0.5)" }}
            aria-label="Cart"
          >
            <ShoppingCart className="size-5" style={{ strokeWidth: 1.5 }} />
          </Link>

          <Unauthenticated>
            {/* FIX: Wrapped in a div to hold the classes and styles safely */}
            <div
              className="hidden md:flex rounded-full text-[11px] font-semibold border-0 flex-shrink-0 overflow-hidden"
              style={{
                background: "#C9930A",
                color: "#0A0600",
                height: "36px",
                paddingLeft: "20px",
                paddingRight: "20px",
                letterSpacing: "0.08em",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <SignInButton />
            </div>
          </Unauthenticated>

          <Authenticated>
            <Link
              to="/account"
              className="hidden md:flex items-center justify-center rounded-full text-xs transition-all flex-shrink-0"
              style={{
                background: "#C9930A",
                color: "#0A0600",
                height: "36px",
                width: "36px",
                fontWeight: 600,
              }}
            >
              A
            </Link>
          </Authenticated>

          <button
            className="md:hidden transition-colors"
            style={{ color: "rgba(240,234,224,0.5)" }}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Category sub-nav */}
      <div
        className="hidden md:block border-t"
        style={{ borderColor: "rgba(212,175,55,0.1)", height: "38px" }}
      >
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center gap-8">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              to={`/shop?category=${cat.slug}`}
              className="transition-colors duration-200"
              style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: "10px",
                letterSpacing: "0.22em",
                fontWeight: 500,
                textTransform: "uppercase",
                color: location.search.includes(cat.slug)
                  ? "#C9930A"
                  : "rgba(180,155,80,0.55)",
              }}
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="md:hidden border-t px-8 py-8 flex flex-col gap-6"
          style={{
            background: "rgba(6,4,0,0.98)",
            borderColor: "rgba(212,175,55,0.1)",
          }}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              style={{
                fontSize: "11px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                fontWeight: 500,
                color:
                  location.pathname === link.href
                    ? "#C9930A"
                    : "rgba(154,144,133,0.8)",
              }}
            >
              {link.label}
            </Link>
          ))}
          <div
            className="flex flex-wrap gap-4 pt-4 border-t"
            style={{ borderColor: "rgba(212,175,55,0.08)" }}
          >
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                to={`/shop?category=${cat.slug}`}
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "rgba(180,155,80,0.55)",
                }}
              >
                {cat.label}
              </Link>
            ))}
          </div>
          <Unauthenticated>
            {/* FIX: Wrapped mobile button in a div as well */}
            <div
              className="rounded-full font-semibold border-0 w-fit overflow-hidden"
              style={{
                background: "#C9930A",
                color: "#0A0600",
                height: "38px",
                paddingLeft: "20px",
                paddingRight: "20px",
                fontSize: "11px",
                letterSpacing: "0.1em",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <SignInButton />
            </div>
          </Unauthenticated>
        </div>
      )}
    </motion.header>
  );
}