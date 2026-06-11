  import { v } from "convex/values";
  import { mutation, query } from "./_generated/server";
  import { ConvexError } from "convex/values";
  import type { Id } from "./_generated/dataModel.d.ts";



  export const debugIdentity = query({
    args: {},
    handler: async (ctx) => {
      const identity = await ctx.auth.getUserIdentity();
      return identity;
    },
  });

  // Get the current user helper
  async function getCurrentUser(ctx: Parameters<typeof query>[0]["ctx"] | Parameters<typeof mutation>[0]["ctx"]) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    return user;
  }

  // Send a message or call request to a seller
  export const sendMessage = mutation({
    args: {
      receiverId: v.id("users"),
      productId: v.optional(v.id("products")),
      content: v.string(),
      type: v.union(v.literal("message"), v.literal("call_request")),
    },
    handler: async (ctx, args) => {
      const sender = await getCurrentUser(ctx);
      if (sender._id === args.receiverId) {
        throw new ConvexError({ message: "Cannot message yourself", code: "BAD_REQUEST" });
      }
      return await ctx.db.insert("messages", {
        senderId: sender._id,
        receiverId: args.receiverId,
        productId: args.productId,
        content: args.content,
        isRead: false,
        type: args.type,
      });
    },
  });

  // Mark a message as read
  export const markAsRead = mutation({
    args: { messageId: v.id("messages") },
    handler: async (ctx, args) => {
      const user = await getCurrentUser(ctx);
      const msg = await ctx.db.get(args.messageId);
      if (!msg) throw new ConvexError({ message: "Message not found", code: "NOT_FOUND" });
      if (msg.receiverId !== user._id) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
      await ctx.db.patch(args.messageId, { isRead: true });
    },
  });

  // Mark all messages in a conversation as read
  export const markConversationAsRead = mutation({
    args: { otherUserId: v.id("users") },
    handler: async (ctx, args) => {
      const user = await getCurrentUser(ctx);
      const unread = await ctx.db
        .query("messages")
        .withIndex("by_receiver", (q) => q.eq("receiverId", user._id))
        .collect();
      for (const msg of unread) {
        if (msg.senderId === args.otherUserId && !msg.isRead) {
          await ctx.db.patch(msg._id, { isRead: true });
        }
      }
    },
  });

  // Get all conversations for the current user (inbox)
  export const getInbox = query({
    args: {},
    handler: async (ctx): Promise<{
      otherUserId: Id<"users">;
      otherUserName: string;
      otherUserAvatar: string | undefined;
      lastMessage: string;
      lastMessageTime: number;
      lastMessageType: "message" | "call_request";
      unreadCount: number;
      productId: Id<"products"> | undefined;
      productName: string | undefined;
    }[]> => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) return [];
      const user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
        .unique();
      if (!user) return [];

      // Get all messages where user is sender or receiver
      const received = await ctx.db
        .query("messages")
        .withIndex("by_receiver", (q) => q.eq("receiverId", user._id))
        .collect();
      const sent = await ctx.db
        .query("messages")
        .withIndex("by_sender", (q) => q.eq("senderId", user._id))
        .collect();

      const allMessages = [...received, ...sent].sort((a, b) => b._creationTime - a._creationTime);

      // Group by conversation partner
      const conversationMap = new Map<string, typeof allMessages[0][]>();
      for (const msg of allMessages) {
        const otherUserId = msg.senderId === user._id ? msg.receiverId : msg.senderId;
        const key = otherUserId.toString();
        if (!conversationMap.has(key)) conversationMap.set(key, []);
        conversationMap.get(key)!.push(msg);
      }

      const conversations = [];
      for (const [otherUserIdStr, msgs] of conversationMap) {
        const otherUserId = otherUserIdStr as Id<"users">;
        const otherUser = await ctx.db.get(otherUserId);
        if (!otherUser) continue;

        const lastMsg = msgs[0]; // already sorted desc
        const unreadCount = msgs.filter((m) => m.receiverId === user._id && !m.isRead).length;

        let productName: string | undefined;
        if (lastMsg.productId) {
          const product = await ctx.db.get(lastMsg.productId);
          productName = product?.name;
        }

        conversations.push({
          otherUserId,
          otherUserName: otherUser.name ?? "Unknown",
          otherUserAvatar: otherUser.avatar,
          lastMessage: lastMsg.content,
          lastMessageTime: lastMsg._creationTime,
          lastMessageType: lastMsg.type,
          unreadCount,
          productId: lastMsg.productId,
          productName,
        });
      }

      return conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    },
  });

  // Get messages between current user and another user
  export const getConversation = query({
    args: { otherUserId: v.id("users") },
    handler: async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) return [];
      const user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
        .unique();
      if (!user) return [];

      const received = await ctx.db
        .query("messages")
        .withIndex("by_receiver", (q) => q.eq("receiverId", user._id))
        .collect();
      const sent = await ctx.db
        .query("messages")
        .withIndex("by_sender", (q) => q.eq("senderId", user._id))
        .collect();

      return [...received, ...sent]
        .filter(
          (m) =>
            (m.senderId === user._id && m.receiverId === args.otherUserId) ||
            (m.receiverId === user._id && m.senderId === args.otherUserId)
        )
        .sort((a, b) => a._creationTime - b._creationTime);
    },
  });

  // Get unread message count for current user
  export const getUnreadCount = query({
    args: {},
    handler: async (ctx): Promise<number> => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) return 0;
      const user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
        .unique();
      if (!user) return 0;

      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_receiver", (q) => q.eq("receiverId", user._id))
        .collect();
      return msgs.filter((m) => !m.isRead).length;
    },
  });
