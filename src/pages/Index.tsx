import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Shield, Star, Truck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Unauthenticated } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";

const CATEGORIES = [
  { slug: "hair", label: "Hair", emoji: "💇", desc: "Wigs, extensions, braids, growth oils" },
  { slug: "cosmetics", label: "Cosmetics", emoji: "💄", desc: "Lipstick, foundation, blush & more" },
  { slug: "skincare", label: "Skincare", emoji: "✨", desc: "Serums, moisturizers, SPF & toners" },
  { slug: "nails", label: "Nails", emoji: "💅", desc: "Gel, press-ons, nail art supplies" },
  { slug: "fragrance", label: "Fragrance", emoji: "🌸", desc: "Perfumes, body mists, roll-ons" },
  { slug: "tools", label: "Tools", emoji: "🪞", desc: "Curling irons, dryers, tweezers" },
];

const TRUST_POINTS = [
  { icon: Shield, title: "Buyer Protection", desc: "Every order is protected. Report issues within 48 hours." },
  { icon: Star, title: "Verified Sellers", desc: "Sellers are reviewed and verified before listing products." },
  { icon: Truck, title: "Direct Delivery", desc: "Connect with sellers and arrange fast local delivery." },
  { icon: Zap, title: "Real-Time Stock", desc: "See live product availability. Never buy out-of-stock items." },
];

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export default function Index() {
  return (
    <div className="overflow-x-hidden">
      {/* Hero */}
      <section className="relative min-h-[88vh] flex items-center justify-center overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-primary/5 blur-[80px]" />
          {/* Grid lines */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "linear-gradient(oklch(0.97 0.02 80) 1px, transparent 1px), linear-gradient(90deg, oklch(0.97 0.02 80) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <motion.div
          className="relative z-10 text-center px-4 max-w-4xl mx-auto"
          initial="hidden"
          animate="show"
          variants={staggerContainer}
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 border border-primary/30 rounded-full px-4 py-1.5 mb-8 text-xs text-primary/80 tracking-widest uppercase bg-primary/5">
            <span className="size-1.5 rounded-full bg-primary animate-pulse inline-block" />
            Africa's Beauty & Personal Care Marketplace
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-7xl lg:text-8xl font-light text-balance mb-6 leading-none tracking-tight"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Beauty,{" "}
            <span className="italic text-primary">Redefined.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed font-light">
            Discover premium hair, cosmetics, skincare, and personal care products from verified sellers — all in one place.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" asChild className="rounded-full px-8 h-12 text-sm tracking-wider">
              <Link to="/shop">
                Shop Now <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Unauthenticated>
              <SignInButton className="rounded-full h-12 px-8 text-sm tracking-wider" />
            </Unauthenticated>
            <Button size="lg" variant="secondary" asChild className="rounded-full px-8 h-12 text-sm tracking-wider">
              <Link to="/seller/dashboard">
                Start Selling
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* Categories */}
      <section className="py-20 px-4 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <p className="text-xs uppercase tracking-widest text-primary mb-2">Browse By</p>
          <h2 className="text-4xl md:text-5xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Shop By Category
          </h2>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          {CATEGORIES.map((cat) => (
            <motion.div key={cat.slug} variants={fadeUp}>
              <Link
                to={`/shop?category=${cat.slug}`}
                className="group flex flex-col items-center gap-3 p-4 rounded-xl border border-border/50 bg-card/50 hover:border-primary/40 hover:bg-accent/40 transition-all duration-300 cursor-pointer"
              >
                <span className="text-3xl">{cat.emoji}</span>
                <div className="text-center">
                  <p className="text-sm font-medium tracking-wide">{cat.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug hidden md:block">{cat.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Trust & Safety */}
      <section className="py-16 px-4 bg-card/30 border-y border-border/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {TRUST_POINTS.map((point) => (
              <motion.div key={point.title} variants={fadeUp} className="flex gap-4 items-start">
                <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <point.icon className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1">{point.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{point.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Sell on Aurriq CTA */}
      <section className="py-24 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto"
        >
          <p className="text-xs uppercase tracking-widest text-primary mb-4">For Sellers</p>
          <h2 className="text-4xl md:text-5xl font-light mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Grow Your Beauty Business
          </h2>
          <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
            Post your products, manage your inventory in real-time, and receive instant SMS alerts when stock runs low — all from your seller dashboard.
          </p>
          <Button asChild size="lg" className="rounded-full px-10 h-12">
            <Link to="/seller/dashboard">
              Open Seller Dashboard <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </motion.div>
      </section>
    </div>
  );
}
