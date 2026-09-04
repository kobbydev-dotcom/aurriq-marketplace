import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),

    isSeller: v.optional(v.boolean()),
    isVerified: v.optional(v.boolean()),
    tokenIdentifier: v.optional(v.string()),
    phone: v.optional(v.string()),
    avatar: v.optional(v.string()),
    role: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    paymentNetwork: v.optional(v.string()),
    paymentAccount: v.optional(v.string()),
    // Seller business type (salon, barbershop, nail tech, etc.) — shown to buyers.
    businessType: v.optional(v.string()),
    // Optional email for order/notification emails (falls back to account email).
    notifyEmail: v.optional(v.string()),
    // Convex storage id for an uploaded avatar (resolved to a URL at query time).
    avatarStorageId: v.optional(v.string()),
    // Opt-in shop/user location for the "near you" discovery feature.
    locationLabel: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    locationShared: v.optional(v.boolean()),
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
    videos: v.optional(v.array(v.string())),
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
    // How the seller accepts payment for this product:
    // "momo" = online/mobile-money via Aurriq only, "cod" = cash on delivery,
    // "negotiable" = price/method arranged with buyer, "partial" = deposit % now, balance on delivery.
    paymentOptions: v.optional(
      v.object({
        mode: v.string(),
        percent: v.optional(v.number()),
      })
    ),
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

  // In-app notifications for buyers & sellers (orders, messages, calls, alerts).
  notifications: defineTable({
    userId: v.id("users"),
    type: v.string(), // order_placed | order_status | message | call_request | low_stock | payment
    title: v.string(),
    body: v.optional(v.string()),
    link: v.optional(v.string()),
    isRead: v.boolean(),
  })
    .index("by_user", ["userId"]),

  // Immutable audit trail of everything that happens in an account (sales, edits, etc.)
  activity: defineTable({
    userId: v.id("users"),
    action: v.string(),
    meta: v.optional(v.any()),
  })
    .index("by_user", ["userId"]),

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
    paymentMethod: v.optional(v.string()),
    paymentNetwork: v.optional(v.string()),
    paymentAccount: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    paymentProviderTxnId: v.optional(v.string()),
    authorizationUrl: v.optional(v.string()),
    // Receipt + partial-payment tracking
    receiptEmail: v.optional(v.string()),
    depositAmount: v.optional(v.number()),
    balanceAmount: v.optional(v.number()),
    depositPaid: v.optional(v.boolean()),
    balancePaid: v.optional(v.boolean()),
    balancePaymentReference: v.optional(v.string()),
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
    .index("by_seller", ["sellerId"])
    .index("by_payment_reference", ["paymentReference"]),
});