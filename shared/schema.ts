import { pgTable, text, serial, integer, boolean, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
});

// Store connection schema
export const storeConnections = pgTable("store_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  platform: text("platform").notNull(), // 'shopify' or 'magento'
  storeUrl: text("store_url").notNull(),
  apiKey: text("api_key").notNull(),
  apiSecret: text("api_secret").notNull(),
  isActive: boolean("is_active").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStoreConnectionSchema = createInsertSchema(storeConnections).pick({
  userId: true,
  name: true,
  platform: true,
  storeUrl: true,
  apiKey: true,
  apiSecret: true,
});

// Orders schema
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  storeConnectionId: integer("store_connection_id").notNull().references(() => storeConnections.id),
  orderId: text("order_id").notNull(),
  customerId: text("customer_id").notNull(),
  orderNumber: text("order_number"),
  totalAmount: real("total_amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  orderDate: timestamp("order_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).pick({
  storeConnectionId: true,
  orderId: true,
  customerId: true,
  orderNumber: true,
  totalAmount: true,
  currency: true,
  status: true,
  orderDate: true,
});

// Products schema
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  storeConnectionId: integer("store_connection_id").notNull().references(() => storeConnections.id),
  productId: text("product_id").notNull(),
  name: text("name").notNull(),
  sku: text("sku"),
  price: real("price"),
  currency: text("currency"),
  inventory: integer("inventory"),
  lowStockThreshold: integer("low_stock_threshold"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).pick({
  storeConnectionId: true,
  productId: true,
  name: true,
  sku: true,
  price: true,
  currency: true,
  inventory: true,
  lowStockThreshold: true,
});

// Subscription tiers
export const subscriptionTiers = pgTable("subscription_tiers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  maxOrders: integer("max_orders").notNull(),
  price: real("price").notNull(),
  features: jsonb("features"),
  isActive: boolean("is_active").default(true),
});

export const insertSubscriptionTierSchema = createInsertSchema(subscriptionTiers).pick({
  name: true,
  maxOrders: true,
  price: true,
  features: true,
  isActive: true,
});

// User subscriptions
export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  tierId: integer("tier_id").notNull().references(() => subscriptionTiers.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).pick({
  userId: true,
  tierId: true,
  startDate: true,
  endDate: true,
  isActive: true,
});

// Analytics queries
export const analyticsQueries = pgTable("analytics_queries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  storeConnectionId: integer("store_connection_id").references(() => storeConnections.id),
  queryType: text("query_type").notNull(),
  dateRange: jsonb("date_range"),
  filters: jsonb("filters"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAnalyticsQuerySchema = createInsertSchema(analyticsQueries).pick({
  userId: true,
  storeConnectionId: true,
  queryType: true,
  dateRange: true,
  filters: true,
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type StoreConnection = typeof storeConnections.$inferSelect;
export type InsertStoreConnection = z.infer<typeof insertStoreConnectionSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type SubscriptionTier = typeof subscriptionTiers.$inferSelect;
export type InsertSubscriptionTier = z.infer<typeof insertSubscriptionTierSchema>;

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;

export type AnalyticsQuery = typeof analyticsQueries.$inferSelect;
export type InsertAnalyticsQuery = z.infer<typeof insertAnalyticsQuerySchema>;

// Extended schemas for API responses
export const kpiDataSchema = z.object({
  dailyRevenue: z.number(),
  totalOrders: z.number(),
  repeatBuyerRate: z.number(),
  inventoryAlerts: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      sku: z.string().optional(),
      inventory: z.number(),
      lowStockThreshold: z.number().optional(),
      status: z.enum(['OUT_OF_STOCK', 'LOW_STOCK']),
    })
  ),
});

export const storePerformanceSchema = z.object({
  labels: z.array(z.string()),
  datasets: z.array(
    z.object({
      label: z.string(),
      data: z.array(z.number()),
    })
  ),
});

export const topProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  orders: z.number(),
  revenue: z.number(),
  currency: z.string(),
});

export const recentOrderSchema = z.object({
  id: z.number(),
  orderId: z.string(),
  orderNumber: z.string().optional(),
  customer: z.object({
    id: z.string(),
    name: z.string(),
    initials: z.string(),
  }),
  date: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(['COMPLETED', 'PROCESSING', 'REFUNDED', 'CANCELLED']),
  storePlatform: z.enum(['SHOPIFY', 'MAGENTO']),
});

export type KPIData = z.infer<typeof kpiDataSchema>;
export type StorePerformance = z.infer<typeof storePerformanceSchema>;
export type TopProduct = z.infer<typeof topProductSchema>;
export type RecentOrder = z.infer<typeof recentOrderSchema>;
