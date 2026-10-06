import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  check,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey(),
    title: text("title").notNull(),
    quantity: integer("quantity").notNull().default(0),
    slug: text("slug").notNull(),
    size: text("size").notNull(),
    price: integer("price").notNull(),
    pricePending: integer("price_pending").notNull().default(0),
    subtitle: text("subtitle").notNull(),
    description: text("description").notNull(),
    image: text("image").notNull(),
    category: text("category").notNull(),
    active: integer("active").notNull().default(1),
    titleEn: text("title_en").notNull().default(""),
    subtitleEn: text("subtitle_en").notNull().default(""),
    descriptionEn: text("description_en").notNull().default(""),
    isDemo: integer("is_demo").notNull().default(0),
    archived: integer("archived").notNull().default(0),
  },
  (t) => [
    check("stock_nonnegative", sql`${t.quantity} >= 0`),
    check("price_positive", sql`${t.price} > 0`),
    uniqueIndex("product_variant").on(t.slug, t.size),
  ],
);
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
export const adminSessions = sqliteTable("admin_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  expiresAt: integer("expires_at").notNull(),
  lastSeen: integer("last_seen").notNull().default(0),
  credentialHash: text("credential_hash").notNull().default(""),
});
export const adminRateLimits = sqliteTable("admin_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    payloadHash: text("payload_hash").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    createdAt: integer("created_at").notNull(),
    status: text("status").notNull().default("new"),
    consentedAt: integer("consented_at").notNull(),
  },
  (t) => [index("orders_phone_created").on(t.phone, t.createdAt)],
);
export const orderItems = sqliteTable(
  "order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    title: text("title").notNull(),
    size: text("size").notNull(),
    quantity: integer("quantity").notNull(),
    price: integer("price").notNull(),
  },
  (t) => [
    check("item_quantity_positive", sql`${t.quantity} > 0`),
    uniqueIndex("order_product").on(t.orderId, t.productId),
  ],
);
export const notifications = sqliteTable(
  "notifications",
  {
    orderId: text("order_id")
      .primaryKey()
      .references(() => orders.id),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttempt: integer("next_attempt").notNull().default(0),
    lockUntil: integer("lock_until").notNull().default(0),
    lastError: text("last_error"),
    messageId: integer("message_id"),
  },
  (t) => [index("notification_due").on(t.status, t.nextAttempt)],
);
