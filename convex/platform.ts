import { query } from "./_generated/server";

export const getLiveStats = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const products = await ctx.db.query("products").collect();
    const orders = await ctx.db.query("orders").collect();

    const activeUsers = users.filter((user: any) => !user.isPendingDeletion);
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
