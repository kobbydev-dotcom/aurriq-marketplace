import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getCartItems = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    const items = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Enrich with product data
    const enriched = await Promise.all(
      items.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        return { ...item, product };
      })
    );

    return enriched.filter((item) => item.product !== null);
  },
});

export const addToCart = mutation({
  args: {
    productId: v.id("products"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Please sign in to add items to cart" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const product = await ctx.db.get(args.productId);
    if (!product) throw new ConvexError({ code: "NOT_FOUND", message: "Product not found" });
    if (!product.isActive) throw new ConvexError({ code: "BAD_REQUEST", message: "Product is no longer available" });
    if (product.stockQuantity === 0) throw new ConvexError({ code: "BAD_REQUEST", message: "Product is out of stock" });

    // Sellers cannot buy their own products
    if (product.sellerId === user._id) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "You cannot purchase your own product" });
    }

    // Check if already in cart
    const existing = await ctx.db
      .query("cartItems")
      .withIndex("by_user_and_product", (q) =>
        q.eq("userId", user._id).eq("productId", args.productId)
      )
      .unique();

    const newQty = (existing?.quantity ?? 0) + args.quantity;
    const maxQty = Math.min(product.stockQuantity, 99);

    if (newQty > maxQty) {
      throw new ConvexError({ code: "BAD_REQUEST", message: `Only ${product.stockQuantity} units available` });
    }

    if (existing) {
      await ctx.db.patch(existing._id, { quantity: newQty });
    } else {
      await ctx.db.insert("cartItems", {
        userId: user._id,
        productId: args.productId,
        quantity: args.quantity,
      });
    }
  },
});

export const updateCartItemQty = mutation({
  args: {
    cartItemId: v.id("cartItems"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const item = await ctx.db.get(args.cartItemId);
    if (!item || item.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Not your cart item" });
    }

    if (args.quantity <= 0) {
      await ctx.db.delete(args.cartItemId);
    } else {
      const product = await ctx.db.get(item.productId);
      const maxQty = product ? Math.min(product.stockQuantity, 99) : 99;
      await ctx.db.patch(args.cartItemId, { quantity: Math.min(args.quantity, maxQty) });
    }
  },
});

export const removeFromCart = mutation({
  args: { cartItemId: v.id("cartItems") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const item = await ctx.db.get(args.cartItemId);
    if (!item || item.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Not your cart item" });
    }

    await ctx.db.delete(args.cartItemId);
  },
});

export const clearCart = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const items = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    await Promise.all(items.map((item) => ctx.db.delete(item._id)));
  },
});
