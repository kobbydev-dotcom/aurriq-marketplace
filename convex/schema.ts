import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    avatar: v.optional(v.string()),
    role: v.optional(v.union(v.literal("seller"), v.literal("buyer"))),
    isVerified: v.optional(v.boolean()),
    bookingPlatformEmail: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  products: defineTable({
    sellerId: v.id("users"),
    name: v.string(),
    brand: v.string(),
    description: v.string(),
    category: v.string(), // "hair" | "cosmetics" | "skincare" | "nails" | "fragrance" | "tools"
    originalPrice: v.number(),
    promoPrice: v.optional(v.number()),
    
    // UPGRADED: Keeps total stock but adds detailed color tracking
    stockQuantity: v.number(), // Total combined stock across variants
    variants: v.optional(
      v.array(
        v.object({
          color: v.string(), // e.g., "Jet Black 1B", "613 Blonde"
          stock: v.number(), // e.g., 5
        })
      )
    ),
    
    lowStockThreshold: v.number(), 
    images: v.array(v.string()), // Up to 20 CDN URLs for images/videos
    tags: v.optional(v.array(v.string())),
    isActive: v.boolean(),
    totalSold: v.number(),
    totalRevenue: v.number(),
    lowStockAlertSent: v.optional(v.boolean()),
    outOfStockAlertSent: v.optional(v.boolean()),
  })
    .index("by_seller", ["sellerId"])
    .index("by_category", ["category"])
    .index("by_active", ["isActive"]),

  orders: defineTable({
    buyerId: v.id("users"),
    sellerId: v.id("users"),
    productId: v.id("products"),
    quantity: v.number(),
    color: v.optional(v.string()), // UPGRADED: Tracks chosen color for fulfillment
    priceAtPurchase: v.number(),
    totalAmount: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
    buyerPhone: v.optional(v.string()),
    buyerNote: v.optional(v.string()),
  })
    .index("by_buyer", ["buyerId"])
    .index("by_seller", ["sellerId"])
    .index("by_product", ["productId"]),

  cartItems: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),
    quantity: v.number(),
    color: v.optional(v.string()), // UPGRADED: Remembers selection in customer cart
  })
    .index("by_user", ["userId"])
    .index("by_user_and_product", ["userId", "productId"]),

  messages: defineTable({
    senderId: v.id("users"),
    receiverId: v.id("users"),
    productId: v.optional(v.id("products")),
    content: v.string(),
    isRead: v.boolean(),
    type: v.union(v.literal("message"), v.literal("call_request")),
  })
    .index("by_receiver", ["receiverId"])
    .index("by_sender", ["senderId"]),

  reports: defineTable({
    reporterId: v.id("users"),
    targetType: v.union(v.literal("product"), v.literal("seller")),
    targetProductId: v.optional(v.id("products")),
    targetSellerId: v.optional(v.id("users")),
    reason: v.string(),
    details: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("reviewed"),
      v.literal("resolved"),
      v.literal("dismissed")
    ),
    adminNote: v.optional(v.string()),
  })
    .index("by_reporter", ["reporterId"])
    .index("by_status", ["status"])
    .index("by_target_product", ["targetProductId"])
    .index("by_target_seller", ["targetSellerId"]),
});