import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // 1. Injects official authentication structures for sessions and accounts seamlessly
  ...authTables,

  // 2. Extends your existing user profile table with Convex Auth tracking attributes
  users: defineTable({
      // Native properties
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      image: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()), // <--- Add this!

      // Custom metadata
      isSeller: v.optional(v.boolean()), 
      isVerified: v.optional(v.boolean()),
      tokenIdentifier: v.optional(v.string()),
      phone: v.optional(v.string()),
      avatar: v.optional(v.string()),
      role: v.optional(v.string()), 
    })
    .index("by_token", ["tokenIdentifier"])
    .index("email", ["email"]),

  products: defineTable({
    title: v.optional(v.string()), 
    name: v.optional(v.string()), 
    description: v.string(),
    price: v.optional(v.number()), 
    originalPrice: v.optional(v.number()),
    promoPrice: v.optional(v.number()),
    imageUrl: v.optional(v.string()), 
    images: v.optional(v.array(v.string())),
    category: v.string(),
    sellerId: v.id("users"),
    inventory: v.optional(v.number()), 
    stockQuantity: v.number(), 
    lowStockThreshold: v.number(),
    lowStockAlertSent: v.optional(v.boolean()),
    outOfStockAlertSent: v.optional(v.boolean()),
    totalSold: v.number(),
    totalRevenue: v.number(),
    isActive: v.boolean(),
    brand: v.optional(v.string()),
    variants: v.optional(v.any()),
    tags: v.optional(v.array(v.string())),
  }).index("by_seller", ["sellerId"]),

  messages: defineTable({
    senderId: v.id("users"),
    receiverId: v.id("users"),
    productId: v.optional(v.id("products")),
    content: v.string(),
    type: v.string(), 
    isRead: v.boolean(),
  })
    .index("by_sender", ["senderId"])
    .index("by_receiver", ["receiverId"]),

  cartItems: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),
    quantity: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_product", ["userId", "productId"]),

  reports: defineTable({
    reporterId: v.id("users"),
    targetProductId: v.optional(v.id("products")),
    targetSellerId: v.optional(v.id("users")),
    reason: v.string(),
    status: v.string(), 
    targetType: v.optional(v.string()),
    adminNote: v.optional(v.string()),
    details: v.optional(v.any()),
  })
    .index("by_status", ["status"])
    .index("by_target_product", ["targetProductId"])
    .index("by_target_seller", ["targetSellerId"]),

  orders: defineTable({
    userId: v.id("users"),
    buyerId: v.id("users"),           
    sellerId: v.id("users"),          
    productId: v.id("products"),    
    totalAmount: v.number(),
    status: v.string(),
    quantity: v.optional(v.number()), 
    priceAtPurchase: v.optional(v.number()), 
    buyerPhone: v.optional(v.string()), 
    buyerNote: v.optional(v.string()),
    items: v.optional(
      v.array(
        v.object({
          productId: v.id("products"),
          quantity: v.number(),
          priceAtPurchase: v.number(),
        })
      )
    ),
  })
    .index("by_buyer", ["buyerId"])
    .index("by_seller", ["sellerId"]),
});