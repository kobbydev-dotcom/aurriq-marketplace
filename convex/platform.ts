import { query } from "./_generated/server";
import { v } from "convex/values";

async function isShadowUser(ctx: any, user: any) {
  if (!user.authSubject || user.authSubject === user._id) return false;
  try {
    return Boolean(await ctx.db.get(user.authSubject as any));
  } catch {
    return false;
  }
}

async function getCanonicalActiveUsers(ctx: any) {
  const users = await ctx.db.query("users").collect();
  const activeUsers = users.filter((user: any) => !user.isPendingDeletion);
  const shadowFlags = await Promise.all(activeUsers.map((user: any) => isShadowUser(ctx, user)));
  return activeUsers.filter((_user: any, index: number) => !shadowFlags[index]);
}

async function resolveUserImage(ctx: any, user: any) {
  const value = user?.avatarStorageId ?? user?.image ?? user?.avatar;
  if (!value) return undefined;
  if (String(value).startsWith("http://") || String(value).startsWith("https://")) return value;
  try {
    return (await ctx.storage.getUrl(value as any)) ?? value;
  } catch {
    return value;
  }
}

export const getLiveStats = query({
  args: {},
  handler: async (ctx) => {
    const activeUsers = await getCanonicalActiveUsers(ctx);
    const products = await ctx.db.query("products").collect();
    const orders = await ctx.db.query("orders").collect();

    const vendors = activeUsers.filter((user: any) => user.isSeller === true || user.role === "seller");
    const liveProducts = products.filter((product: any) => product.isActive && product.stockQuantity > 0);
    const completedSales = orders.filter((order: any) => !["cancelled", "awaiting_payment"].includes(order.status));

    return {
      members: activeUsers.length,
      vendors: vendors.length,
      products: liveProducts.length,
      sales: completedSales.length,
    };
  },
});

export const getDirectory = query({
  args: { view: v.union(v.literal("members"), v.literal("vendors"), v.literal("products"), v.literal("sales")) },
  handler: async (ctx, args) => {
    const users: any[] = await getCanonicalActiveUsers(ctx);
    if (args.view === "members" || args.view === "vendors") {
      const filtered = args.view === "vendors" ? users.filter((user) => user.isSeller === true || user.role === "seller") : users;
      return { items: await Promise.all(filtered.sort((a, b) => b._creationTime - a._creationTime).map(async (user: any) => ({ _id: user._id, name: user.name ?? "Aurriq Member", image: await resolveUserImage(ctx, user), businessType: user.businessType, serviceTypes: user.serviceTypes, customServiceDescription: user.customServiceDescription, lastSeenAt: user.lastSeenAt }))) };
    }

    if (args.view === "products") {
      const products = (await ctx.db.query("products").collect()).filter((product: any) => product.isActive && product.stockQuantity > 0).sort((a, b) => b._creationTime - a._creationTime).slice(0, 80);
      return { items: await Promise.all(products.map(async (product: any) => {
        const seller: any = await ctx.db.get(product.sellerId);
        let image = product.images?.[0] ?? product.imageUrl;
        if (image && !image.startsWith("http")) image = await ctx.storage.getUrl(image as any) ?? image;
        return { _id: product._id, name: product.name ?? product.title ?? "Product", price: product.promoPrice ?? product.originalPrice ?? product.price ?? 0, image, sellerName: seller?.name ?? "Aurriq vendor" };
      })) };
    }

    const orders = (await ctx.db.query("orders").collect()).filter((order: any) => !["cancelled", "awaiting_payment"].includes(order.status)).sort((a, b) => b._creationTime - a._creationTime).slice(0, 50);
    return { items: await Promise.all(orders.map(async (order: any) => {
      const product: any = await ctx.db.get(order.productId);
      const seller: any = await ctx.db.get(order.sellerId);
      const minutes = Math.max(1, Math.round((Date.now() - order._creationTime) / 60000));
      return { _id: order._id, productId: order.productId, sellerId: order.sellerId, productName: product?.name ?? "a product", sellerName: seller?.name ?? "an Aurriq vendor", quantity: order.quantity ?? 1, when: minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago` };
    })) };
  },
});
