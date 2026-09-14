/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountDeletion from "../accountDeletion.js";
import type * as admin from "../admin.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as cart from "../cart.js";
import type * as follows from "../follows.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as mail from "../mail.js";
import type * as maintenance from "../maintenance.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as orders from "../orders.js";
import type * as payments from "../payments.js";
import type * as platform from "../platform.js";
import type * as products from "../products.js";
import type * as receipts from "../receipts.js";
import type * as reports from "../reports.js";
import type * as reviews from "../reviews.js";
import type * as rfq from "../rfq.js";
import type * as seed from "../seed.js";
import type * as sms from "../sms.js";
import type * as users from "../users.js";
import type * as wishlist from "../wishlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountDeletion: typeof accountDeletion;
  admin: typeof admin;
  analytics: typeof analytics;
  auth: typeof auth;
  cart: typeof cart;
  follows: typeof follows;
  http: typeof http;
  inventory: typeof inventory;
  mail: typeof mail;
  maintenance: typeof maintenance;
  messages: typeof messages;
  notifications: typeof notifications;
  orders: typeof orders;
  payments: typeof payments;
  platform: typeof platform;
  products: typeof products;
  receipts: typeof receipts;
  reports: typeof reports;
  reviews: typeof reviews;
  rfq: typeof rfq;
  seed: typeof seed;
  sms: typeof sms;
  users: typeof users;
  wishlist: typeof wishlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
