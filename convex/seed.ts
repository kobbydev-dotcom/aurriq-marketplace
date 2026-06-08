import { mutation } from "./_generated/server";

export const seedMarketplace = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Create a dummy elite salon owner
    const sellerId = await ctx.db.insert("users", {
      tokenIdentifier: "test-user-123", // Matches our mock authentication setup
      name: "Chantelle Luxury Hair",
      email: "chantelle@luxurybundles.com",
      phone: "+1234567890",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      role: "seller",
      isVerified: true,
    });

    // 2. Add Sample Product 1: Premium Virgin Hair with multi-color inventory
    await ctx.db.insert("products", {
      sellerId,
      name: "12A Grade Virgin Cambodian Hair",
      brand: "Chantelle Luxury",
      description: "100% Unprocessed human hair bundles. Double weft, thick from root to tip. Can be bleached, dyed, and permed easily.",
      category: "hair",
      originalPrice: 150,
      promoPrice: 125,
      stockQuantity: 22, // Combined total of the variants below
      variants: [
        { color: "Jet Black 1B", stock: 10 },
        { color: "Platinum Blonde 613", stock: 5 },
        { color: "Chocolate Brown #4", stock: 7 },
      ],
      lowStockThreshold: 3,
      images: [
        "https://images.unsplash.com/photo-1605497746445-97d1b0a9eaf4?w=600",
        "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=600"
      ],
      tags: ["cambodian", "bundles", "virgin hair"],
      isActive: true,
      totalSold: 14,
      totalRevenue: 1750,
    });

    // 3. Add Sample Product 2: High-end Cosmetic palette
    await ctx.db.insert("products", {
      sellerId,
      name: "Glow & Sculpt Professional Palette",
      brand: "GlowKit",
      description: "Highly pigmented contour, highlight, and blush layout designed for long-lasting, smudge-proof salon wear.",
      category: "cosmetics",
      originalPrice: 45,
      stockQuantity: 40,
      variants: [
        { color: "Fair-to-Medium Palette", stock: 25 },
        { color: "Deep-Rich Palette", stock: 15 },
      ],
      lowStockThreshold: 5,
      images: [
        "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600"
      ],
      tags: ["contour", "palette", "makeup"],
      isActive: true,
      totalSold: 120,
      totalRevenue: 5400,
    });

    return "Marketplace seeded successfully!";
  },
});