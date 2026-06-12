import { Link } from "react-router-dom";
import { ArrowRight, Shield, Star, Truck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Unauthenticated } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import SiteHeader from "@/components/site-header.tsx";
import { CATEGORIES } from "@/lib/constants.ts";
import { motion } from "motion/react";

const TRUST_POINTS = [
  { icon: Shield, title: "Buyer Protection", desc: "Every order is protected. Report issues within 48 hours." },
  { icon: Star,   title: "Verified Sellers",  desc: "Sellers are reviewed and vetted before listing products." },
  { icon: Truck,  title: "Direct Delivery",   desc: "Connect with sellers and arrange fast, local delivery." },
  { icon: Zap,    title: "Real-Time Stock",   desc: "See live product availability. Never buy out-of-stock items." },
];

const CATEGORY_CIRCLE: Record<string, string> = {
  hair:      "radial-gradient(circle, #3d2a00 0%, #1a1000 100%)",
  cosmetics: "radial-gradient(circle, #3d0030 0%, #1a0015 100%)",
  skincare:  "radial-gradient(circle, #003d35 0%, #001a16 100%)",
  nails:     "radial-gradient(circle, #3d1500 0%, #1a0800 100%)",
  fragrance: "radial-gradient(circle, #3d0010 0%, #1a0008 100%)",
  tools:     "radial-gradient(circle, #1e0040 0%, #0d001a 100%)",
};

export default function Index() {
  return (
    <div
      className="min-h-screen text-[#EDE8E0] antialiased"
      style={{ backgroundColor: "#080600" }}
    >
      <SiteHeader />

      {/* Hero */}
      <section
        className="relative min-h-screen flex flex-col justify-center overflow-hidden"
        style={{ paddingTop: "90px" }}
      >
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div style={{
            position: "absolute", top: "80%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "2000px", height: "1200px", borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(125, 82, 8, 0.22) 0%, transparent 40%)",
          }} />
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden
          style={{
            backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 0px), linear-gradient(90deg, rgba(212,175,55,0.05) 1px, transparent 1px)",
            backgroundSize: "70px 50px",
          }}
        />

        {/* All hero content inside this wrapper */}
        <div className="relative z-10 w-full flex flex-col items-center text-center px-6 pb-32">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1 rounded-full mb-12 uppercase"
            style={{ border: "1px solid rgba(212,175,55,0.45)", color: "#C9920A", background: "rgba(15,11,0,0.85)", fontSize: "12px", letterSpacing: "0.1em", fontWeight: 100, fontFamily: "'Cormorant Garamond', serif" }}
          >
            <span style={{ color: "#C9920A", fontSize: "10px" }}>●</span>
            Africa's Beauty &amp; Personal Care Marketplace
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut", delay: 0.3 }}
            className="font-light leading-[1.05] text-[#F0EAE0] mb-4"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(4.2rem, 7vw, 5.5rem)", letterSpacing: "0.01em" }}
          >
            Beauty,{" "}
            <em style={{ color: "rgba(195, 126, 26, 1)", fontStyle: "italic" }}>Redefined.</em>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
            className="max-w-2xl font-light leading-[1.8] mb-10 text-center"
            style={{ fontFamily: "'Book Antiqua', serif", color: "rgba(177, 164, 144, 0.4)", fontSize: "17px" }}
          >
            Discover premium hair, cosmetics, skincare, and personal care products
            from verified sellers — all in one place.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.7 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <Button
              size="lg"
              asChild
              className="rounded-full px-8 text-[11px] tracking-[0.15em] font-normal border-0 cursor-pointer"
              style={{ background: "#D4AF37", color: "#0A0800", height: "50px" }}
            >
              <Link to="/shop" style={{ fontFamily: "'Bell MT', serif" }}>Shop Now <ArrowRight className="ml-2 size-3.5" /></Link>
            </Button>

            <Unauthenticated>
              <SignInButton
                className="rounded-full px-8 text-[11px] tracking-[0.15em] font-normal border-0 cursor-pointer"
                style={{ background: "#D4AF37", color: "#0A0800", height: "50px" }}
              />
            </Unauthenticated>

            <Button
              size="lg"
              variant="ghost"
              asChild
              className="rounded-full px-8 text-[11px] tracking-[0.15em] font-normal cursor-pointer text-[#EDE8E0] hover:text-[#D4AF37] hover:bg-transparent"
              style={{ background: "#110d01", color: "#ffffff", height: "50px" }}
            >
              <Link to="/seller/dashboard">Start Selling</Link>
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        >
          <div className="w-px h-12" style={{ background: "linear-gradient(to bottom, rgba(212,175,55,0.4), transparent)" }} />
        </motion.div>
      </section>

      {/* Categories */}
      <section className="py-20 px-8 md:px-16 border-t" style={{ borderColor: "#1A1600" }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-80px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-center mb-10"
          >
            <p className="uppercase tracking-[0.45em] mb-4 font-medium" style={{ color: "rgba(195, 126, 26, 1)", fontSize: "12px", fontFamily: "'Algeria', serif" }}>Browse By</p>
            <h2
              className="font-light text-[#F0EAE0]"
              style={{ fontFamily: "'BELL MT', serif", fontSize: "clamp(0.5rem, 3vw, 3rem)", letterSpacing: "0.01em" }}
            >
              Shop By Category
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
            {CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "-60px" }}
                transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.07 }}
              >
                <Link
                  to={`/shop?category=${cat.slug}`}
                  className="group flex flex-col items-center text-center px-4 py-5 transition-all duration-300 cursor-pointer"
                  style={{ border: "1px solid #1E1A00", background: "#0D0A00", borderRadius: "10px" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.3)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1E1A00"; }}
                >
                  <div
                    className="size-10 mb-4 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform duration-500"
                    style={{ background: CATEGORY_CIRCLE[cat.slug] ?? "radial-gradient(circle, #1a1a1a, #0d0d0d)" }}
                  >
                    <span className="text-3xl">{cat.emoji}</span>
                  </div>
                  <p
                    className="text-[15px] font-light text-[#D9D2C8] group-hover:text-[#D4AF37] transition-colors duration-300 mb-1.5"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    {cat.label}
                  </p>
                  <p className="text-[11px] text-[#5A5448] leading-relaxed">{cat.desc}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-5 px-8 md:px-16 border-t" style={{ backgroundColor: "#0d0a00", borderColor: "#1A1600" }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-[#1A1600]">
            {TRUST_POINTS.map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "-60px" }}
                transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.1 }}
                className="flex flex-col gap-3 px-10 py-8"
              >
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className="size-8 flex items-center justify-center rounded flex-shrink-0"
                    style={{ background: "#110E00", border: "1px solid #2A2200" }}
                  >
                    <point.icon className="size-4 stroke-[1.5]" style={{ color: "#D4AF37" }} />
                  </div>
                  <h3
                    className="font-medium text-[#EDE8E0]"
                    style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "15px" }}
                  >
                    {point.title}
                  </h3>
                </div>
                <p className="text-[11px] text-[#5A5448] leading-[1.8]">{point.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Seller CTA */}
      <section className="py-20 px-8 md:px-16 border-t border-b relative overflow-hidden" style={{ borderColor: "#1A1600" }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "800px", height: "500px", borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(201,162,39,0.18) 0%, transparent 65%)",
          }} />
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden
          style={{
            backgroundImage: "linear-gradient(rgba(212,175,55,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.04) 1px, transparent 1px)",
            backgroundSize: "70px 70px",
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, margin: "-80px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative max-w-3xl mx-auto text-center"
        >
          <p className="uppercase tracking-[0.45em] mb-6 font-medium" style={{ color: "rgba(195, 126, 26, 1)", fontSize: "12px", fontFamily: "'Bell MT', serif" }}>For Sellers</p>
          <h2
            className="font-light text-[#F0EAE0] mb-7"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2.5rem, 5vw, 4rem)", letterSpacing: "-0.01em" }}
          >
            Grow Your Beauty Business
          </h2>
          <p className="leading-[1] mb-10 max-w-2xl mx-auto"
            style={{ fontFamily: "'Bell MT', serif", color: "rgb(192, 162, 118)", fontSize: "14px" }}>
            Post your products, manage your inventory in real-time, and receive instant alerts when stock runs low — 
            all from your seller dashboard.
          </p>

          <Button
            size="lg"
            asChild
            className="rounded-full px-10 text-[11px] tracking-[0.15em] uppercase font-semibold cursor-pointer"
            style={{ background: "transparent", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.5)", height: "40px" }}
          >
            <Link to="/seller/dashboard">Open Seller Dashboard <ArrowRight className="ml-5 size-2.5" /></Link>
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t pt-4 pb-16 px-20 md:px-10" style={{ borderColor: "#1A1600" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "0px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0 }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "rgba(212,175,55,0.6)" }}>✦</span>
              <span
                className="text-[15px] font-light tracking-[0.3em] uppercase"
                style={{ fontFamily: "'Cormorant Garamond', serif", color: "#D4AF37" }}
              >
                Aurriq
              </span>
            </div>
            <p className="text-[12px] leading-[1.9] max-w-[280px]" style={{ color: "#4A4030" }}>
              The beauty &amp; personal care marketplace built for Africa's finest brands and buyers.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "0px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="flex flex-col gap-4"
          >
            <p className="text-[10px] uppercase tracking-[0.35em] font-semibold" style={{ color: "rgba(195, 126, 26, 0.5)" }}>
              Shop By Category
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-8">
              {["Hair", "Cosmetics", "Skincare", "Nails", "Fragrance", "Tools"].map((label) => (
                <Link
                  key={label}
                  to={`/shop?category=${label.toLowerCase()}`}
                  className="tracking-wide transition-colors cursor-pointer hover:text-[#D4AF37]"
                  style={{ color: "rgba(181, 165, 139, 0.5)", fontFamily: "'Times New Roman', serif", fontSize: "13px" }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "0px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="flex flex-col gap-4"
          >
            <p className="text-[10px] uppercase tracking-[0.35em] font-semibold" style={{ color: "rgba(195, 126, 26, 0.5)" }}>
              Sellers
            </p>
            <p className="text-[12px] leading-[1.9]" style={{ color: "#4A4030" }}>
              Join Aurriq to start selling your beauty products.
            </p>
            <Unauthenticated>
              <SignInButton
                className="rounded-full px-5 text-[11px] tracking-[0.12em] font-semibold border-0 w-fit cursor-pointer"
                style={{ background: "#D4AF37", color: "#0A0800", height: "30px" }}
              />
            </Unauthenticated>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: false, margin: "0px" }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
          className="mt-1 border-t py-2 text-center"
          style={{ borderColor: "#1A1600" }}
        >
          <p className="text-[11px] tracking-widest" style={{ color: "#625516" }}>
            © {new Date().getFullYear()} Aurriq. All rights reserved.
          </p>
        </motion.div>
      </footer>
    </div>
  );
}