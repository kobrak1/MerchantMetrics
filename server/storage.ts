import {
  users,
  storeConnections,
  orders,
  products,
  subscriptionTiers,
  userSubscriptions,
  analyticsQueries,
  apiUsage,
  type User,
  type InsertUser,
  type StoreConnection,
  type InsertStoreConnection,
  type Order,
  type InsertOrder,
  type Product,
  type InsertProduct,
  type SubscriptionTier,
  type InsertSubscriptionTier,
  type UserSubscription,
  type InsertUserSubscription,
  type AnalyticsQuery,
  type InsertAnalyticsQuery,
  type ApiUsage,
  type InsertApiUsage,
} from "@shared/schema";

// Storage interface
export interface IStorage {
  // Session store for authentication
  sessionStore: any;
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Store connection operations
  createStoreConnection(connection: InsertStoreConnection): Promise<StoreConnection>;
  getStoreConnectionsByUserId(userId: number): Promise<StoreConnection[]>;
  getStoreConnection(id: number): Promise<StoreConnection | undefined>;
  updateStoreConnection(id: number, data: Partial<StoreConnection>): Promise<StoreConnection>;
  deleteStoreConnection(id: number): Promise<boolean>;
  
  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  getOrdersByStoreConnection(storeConnectionId: number, limit?: number): Promise<Order[]>;
  countOrdersByCustomerId(storeConnectionId: number, customerId: string): Promise<number>;
  getOrdersCountByStoreConnection(storeConnectionId: number): Promise<number>;
  getRecentOrders(storeConnectionId: number, limit: number): Promise<Order[]>;
  
  // Product operations
  createProduct(product: InsertProduct): Promise<Product>;
  getProductsByStoreConnection(storeConnectionId: number): Promise<Product[]>;
  updateProduct(id: number, data: Partial<Product>): Promise<Product>;
  getLowStockProducts(storeConnectionId: number): Promise<Product[]>;
  
  // Subscription operations
  createSubscriptionTier(tier: InsertSubscriptionTier): Promise<SubscriptionTier>;
  getSubscriptionTiers(): Promise<SubscriptionTier[]>;
  getUserSubscription(userId: number): Promise<UserSubscription | undefined>;
  createUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription>;
  
  // Analytics operations
  createAnalyticsQuery(query: InsertAnalyticsQuery): Promise<AnalyticsQuery>;
  getAnalyticsQueriesByUser(userId: number): Promise<AnalyticsQuery[]>;
}

// Import for memory session store
import createMemoryStore from "memorystore";
const MemoryStore = createMemoryStore(session);

// Memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private storeConnections: Map<number, StoreConnection>;
  private orders: Map<number, Order>;
  private products: Map<number, Product>;
  private subscriptionTiers: Map<number, SubscriptionTier>;
  private userSubscriptions: Map<number, UserSubscription>;
  private analyticsQueries: Map<number, AnalyticsQuery>;
  
  // Session store for authentication
  sessionStore: any;
  
  private userId: number;
  private storeConnectionId: number;
  private orderId: number;
  private productId: number;
  private subscriptionTierId: number;
  private userSubscriptionId: number;
  private analyticsQueryId: number;
  
  constructor() {
    this.users = new Map();
    this.storeConnections = new Map();
    this.orders = new Map();
    this.products = new Map();
    this.subscriptionTiers = new Map();
    this.userSubscriptions = new Map();
    this.analyticsQueries = new Map();
    
    // Initialize session store
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    
    this.userId = 1;
    this.storeConnectionId = 1;
    this.orderId = 1;
    this.productId = 1;
    this.subscriptionTierId = 1;
    this.userSubscriptionId = 1;
    this.analyticsQueryId = 1;
    
    // Initialize subscription tiers
    this.initSubscriptionTiers();
  }
  
  private initSubscriptionTiers() {
    const tiers = [
      {
        id: this.subscriptionTierId++,
        name: "Free Plan",
        maxOrders: 1000,
        price: 0,
        features: ["Basic analytics", "Connect 1 store"],
        isActive: true,
      },
      {
        id: this.subscriptionTierId++,
        name: "Growth Plan",
        maxOrders: 5000,
        price: 29,
        features: ["Advanced analytics", "Connect up to 3 stores", "Priority support"],
        isActive: true,
      },
      {
        id: this.subscriptionTierId++,
        name: "Business Plan",
        maxOrders: 10000,
        price: 79,
        features: ["Full analytics suite", "Unlimited stores", "24/7 support", "API access"],
        isActive: true,
      }
    ];
    
    tiers.forEach(tier => this.subscriptionTiers.set(tier.id, tier as SubscriptionTier));
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const now = new Date();
    const user: User = { ...insertUser, id, createdAt: now };
    this.users.set(id, user);
    return user;
  }
  
  // Store connection operations
  async createStoreConnection(connection: InsertStoreConnection): Promise<StoreConnection> {
    const id = this.storeConnectionId++;
    const now = new Date();
    const storeConnection: StoreConnection = {
      ...connection,
      id,
      isActive: true,
      lastSyncAt: null,
      createdAt: now,
    };
    this.storeConnections.set(id, storeConnection);
    return storeConnection;
  }
  
  async getStoreConnectionsByUserId(userId: number): Promise<StoreConnection[]> {
    return Array.from(this.storeConnections.values()).filter(
      (connection) => connection.userId === userId,
    );
  }
  
  async getStoreConnection(id: number): Promise<StoreConnection | undefined> {
    return this.storeConnections.get(id);
  }
  
  async updateStoreConnection(id: number, data: Partial<StoreConnection>): Promise<StoreConnection> {
    const connection = this.storeConnections.get(id);
    if (!connection) {
      throw new Error(`Store connection with id ${id} not found`);
    }
    
    const updatedConnection = { ...connection, ...data };
    this.storeConnections.set(id, updatedConnection);
    return updatedConnection;
  }
  
  async deleteStoreConnection(id: number): Promise<boolean> {
    return this.storeConnections.delete(id);
  }
  
  // Order operations
  async createOrder(order: InsertOrder): Promise<Order> {
    const id = this.orderId++;
    const now = new Date();
    const newOrder: Order = { ...order, id, createdAt: now };
    this.orders.set(id, newOrder);
    return newOrder;
  }
  
  async getOrdersByStoreConnection(storeConnectionId: number, limit?: number): Promise<Order[]> {
    const filteredOrders = Array.from(this.orders.values())
      .filter((order) => order.storeConnectionId === storeConnectionId)
      .sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
    
    return limit ? filteredOrders.slice(0, limit) : filteredOrders;
  }
  
  async countOrdersByCustomerId(storeConnectionId: number, customerId: string): Promise<number> {
    return Array.from(this.orders.values()).filter(
      (order) => order.storeConnectionId === storeConnectionId && order.customerId === customerId
    ).length;
  }
  
  async getOrdersCountByStoreConnection(storeConnectionId: number): Promise<number> {
    return Array.from(this.orders.values()).filter(
      (order) => order.storeConnectionId === storeConnectionId
    ).length;
  }
  
  async getRecentOrders(storeConnectionId: number, limit: number): Promise<Order[]> {
    return this.getOrdersByStoreConnection(storeConnectionId, limit);
  }
  
  // Product operations
  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.productId++;
    const now = new Date();
    const newProduct: Product = { ...product, id, createdAt: now, updatedAt: now };
    this.products.set(id, newProduct);
    return newProduct;
  }
  
  async getProductsByStoreConnection(storeConnectionId: number): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.storeConnectionId === storeConnectionId
    );
  }
  
  async updateProduct(id: number, data: Partial<Product>): Promise<Product> {
    const product = this.products.get(id);
    if (!product) {
      throw new Error(`Product with id ${id} not found`);
    }
    
    const now = new Date();
    const updatedProduct = { ...product, ...data, updatedAt: now };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }
  
  async getLowStockProducts(storeConnectionId: number): Promise<Product[]> {
    return Array.from(this.products.values())
      .filter((product) => {
        return product.storeConnectionId === storeConnectionId && 
               ((product.inventory !== null && product.inventory <= 0) || 
               (product.lowStockThreshold !== null && product.inventory !== null && product.inventory <= product.lowStockThreshold));
      });
  }
  
  // Subscription operations
  async createSubscriptionTier(tier: InsertSubscriptionTier): Promise<SubscriptionTier> {
    const id = this.subscriptionTierId++;
    const subscriptionTier: SubscriptionTier = { ...tier, id };
    this.subscriptionTiers.set(id, subscriptionTier);
    return subscriptionTier;
  }
  
  async getSubscriptionTiers(): Promise<SubscriptionTier[]> {
    return Array.from(this.subscriptionTiers.values());
  }
  
  async getUserSubscription(userId: number): Promise<UserSubscription | undefined> {
    // Get the active subscription for a user
    return Array.from(this.userSubscriptions.values()).find(
      (subscription) => subscription.userId === userId && subscription.isActive
    );
  }
  
  async createUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription> {
    const id = this.userSubscriptionId++;
    const userSubscription: UserSubscription = { ...subscription, id };
    this.userSubscriptions.set(id, userSubscription);
    return userSubscription;
  }
  
  // Analytics operations
  async createAnalyticsQuery(query: InsertAnalyticsQuery): Promise<AnalyticsQuery> {
    const id = this.analyticsQueryId++;
    const now = new Date();
    const analyticsQuery: AnalyticsQuery = { ...query, id, createdAt: now };
    this.analyticsQueries.set(id, analyticsQuery);
    return analyticsQuery;
  }
  
  async getAnalyticsQueriesByUser(userId: number): Promise<AnalyticsQuery[]> {
    return Array.from(this.analyticsQueries.values()).filter(
      (query) => query.userId === userId
    );
  }
}

// Database storage implementation
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: any; // Type as any to avoid TypeScript errors

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool: db.$client, 
      createTableIfMissing: true 
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user;
  }
  
  async getUserAllowedStoreCount(id: number): Promise<number> {
    const user = await this.getUser(id);
    return user?.allowedStoreCount || 1; // Default to 1 if not set
  }

  // Store connection operations
  async createStoreConnection(connection: InsertStoreConnection): Promise<StoreConnection> {
    const [storeConnection] = await db.insert(storeConnections).values({
      ...connection,
      isActive: true,
    }).returning();
    return storeConnection;
  }

  async getStoreConnectionsByUserId(userId: number): Promise<StoreConnection[]> {
    return db.select().from(storeConnections).where(eq(storeConnections.userId, userId));
  }

  async getStoreConnection(id: number): Promise<StoreConnection | undefined> {
    const [connection] = await db.select().from(storeConnections).where(eq(storeConnections.id, id));
    return connection;
  }

  async updateStoreConnection(id: number, data: Partial<StoreConnection>): Promise<StoreConnection> {
    const [connection] = await db
      .update(storeConnections)
      .set(data)
      .where(eq(storeConnections.id, id))
      .returning();
    
    if (!connection) {
      throw new Error(`Store connection with id ${id} not found`);
    }
    
    return connection;
  }

  async deleteStoreConnection(id: number): Promise<boolean> {
    try {
      // Delete all related records from dependent tables
      console.log(`Deleting store connection with ID ${id} and all related records`);
      
      // 1. Delete related api_usage records
      await db
        .delete(apiUsage)
        .where(eq(apiUsage.storeConnectionId, id));
      console.log(`Deleted related api_usage records`);
        
      // 2. Delete related analytics_queries records
      await db
        .delete(analyticsQueries)
        .where(eq(analyticsQueries.storeConnectionId, id));
      console.log(`Deleted related analytics_queries records`);
      
      // 3. Delete related orders records
      await db
        .delete(orders)
        .where(eq(orders.storeConnectionId, id));
      console.log(`Deleted related orders records`);
      
      // 4. Delete related products records
      await db
        .delete(products)
        .where(eq(products.storeConnectionId, id));
      console.log(`Deleted related products records`);
      
      // Finally, delete the store connection itself
      const result = await db
        .delete(storeConnections)
        .where(eq(storeConnections.id, id))
        .returning({ id: storeConnections.id });
      
      console.log(`Deleted store connection: ${JSON.stringify(result)}`);
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting store connection:", error);
      throw error; // Re-throw to be handled by the route handler
    }
  }

  // Order operations
  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async getOrdersByStoreConnection(storeConnectionId: number, limit?: number, offset?: number, status?: string): Promise<Order[]> {
    let query = db
      .select()
      .from(orders)
      .where(eq(orders.storeConnectionId, storeConnectionId));
    
    // Add status filter if provided
    if (status) {
      query = query.where(eq(orders.status, status));
    }
    
    // Sort by order date (newest first)
    query = query.orderBy(desc(orders.orderDate));
    
    // Apply pagination if provided
    if (limit) {
      // @ts-ignore - limit is available but TypeScript doesn't recognize it
      query = query.limit(limit);
    }
    
    if (offset) {
      // @ts-ignore - offset is available but TypeScript doesn't recognize it
      query = query.offset(offset);
    }
    
    return query;
  }

  async countOrdersByCustomerId(storeConnectionId: number, customerId: string): Promise<number> {
    // @ts-ignore - SQL works but TypeScript doesn't recognize it
    const allOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.storeConnectionId, storeConnectionId),
          eq(orders.customerId, customerId)
        )
      );
    
    return allOrders.length;
  }

  async getOrdersCountByStoreConnection(storeConnectionId: number, status?: string): Promise<number> {
    // Base query
    let query = db
      .select()
      .from(orders)
      .where(eq(orders.storeConnectionId, storeConnectionId));
    
    // Add status filter if provided
    if (status) {
      query = query.where(eq(orders.status, status));
    }
    
    // Execute the query
    const allOrders = await query;
    
    return allOrders.length;
  }

  async getRecentOrders(storeConnectionId: number, limit: number): Promise<Order[]> {
    return this.getOrdersByStoreConnection(storeConnectionId, limit);
  }

  // Product operations
  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async getProductsByStoreConnection(storeConnectionId: number): Promise<Product[]> {
    return db
      .select()
      .from(products)
      .where(eq(products.storeConnectionId, storeConnectionId));
  }

  async updateProduct(id: number, data: Partial<Product>): Promise<Product> {
    const now = new Date();
    const [product] = await db
      .update(products)
      .set({ ...data, updatedAt: now })
      .where(eq(products.id, id))
      .returning();
    
    if (!product) {
      throw new Error(`Product with id ${id} not found`);
    }
    
    return product;
  }

  async getLowStockProducts(storeConnectionId: number): Promise<Product[]> {
    // Get products that are out of stock or below their threshold
    // @ts-ignore - SQL works but TypeScript doesn't recognize it
    const allProducts = await db
      .select()
      .from(products)
      .where(eq(products.storeConnectionId, storeConnectionId));
    
    // Filter in JavaScript instead of SQL
    return allProducts.filter(product => 
      (product.inventory === 0) || 
      (product.inventory !== null && 
       product.lowStockThreshold !== null && 
       product.inventory <= product.lowStockThreshold &&
       product.inventory > 0)
    );
  }

  // Subscription operations
  async createSubscriptionTier(tier: InsertSubscriptionTier): Promise<SubscriptionTier> {
    const [subscriptionTier] = await db.insert(subscriptionTiers).values(tier).returning();
    return subscriptionTier;
  }

  async getSubscriptionTiers(): Promise<SubscriptionTier[]> {
    return db.select().from(subscriptionTiers).where(eq(subscriptionTiers.isActive, true));
  }
  
  async getSubscriptionTierById(tierId: number): Promise<SubscriptionTier | undefined> {
    const [tier] = await db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.id, tierId));
    
    return tier;
  }

  async getUserSubscription(userId: number): Promise<UserSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.isActive, true)
        )
      );
    
    return subscription;
  }

  async createUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription> {
    const [userSubscription] = await db.insert(userSubscriptions).values(subscription).returning();
    return userSubscription;
  }
  
  async updateUserSubscription(id: number, data: Partial<UserSubscription>): Promise<UserSubscription> {
    const [subscription] = await db
      .update(userSubscriptions)
      .set(data)
      .where(eq(userSubscriptions.id, id))
      .returning();
    
    if (!subscription) {
      throw new Error(`User subscription with id ${id} not found`);
    }
    
    return subscription;
  }
  
  async getAllStoreConnections(): Promise<StoreConnection[]> {
    return db.select().from(storeConnections);
  }
  
  async getStoreConnectionByShopId(shopId: string): Promise<StoreConnection | undefined> {
    const [connection] = await db
      .select()
      .from(storeConnections)
      .where(eq(storeConnections.shopId, shopId));
    
    return connection;
  }

  // Analytics operations
  async createAnalyticsQuery(query: InsertAnalyticsQuery): Promise<AnalyticsQuery> {
    const [analyticsQuery] = await db.insert(analyticsQueries).values(query).returning();
    return analyticsQuery;
  }

  async getAnalyticsQueriesByUser(userId: number): Promise<AnalyticsQuery[]> {
    return db
      .select()
      .from(analyticsQueries)
      .where(eq(analyticsQueries.userId, userId));
  }
}

// Initialize database with subscription tiers
async function initializeDatabase() {
  // Check if we have subscription tiers, if not create them
  const existingTiers = await db.select().from(subscriptionTiers);
  
  if (existingTiers.length === 0) {
    const tiers = [
      {
        name: "Free Plan",
        maxOrders: 1000,
        price: 0,
        features: ["Basic analytics", "Connect 1 store"],
        isActive: true,
      },
      {
        name: "Growth Plan",
        maxOrders: 5000,
        price: 29,
        features: ["Advanced analytics", "Connect up to 3 stores", "Priority support"],
        isActive: true,
      },
      {
        name: "Business Plan",
        maxOrders: 10000,
        price: 79,
        features: ["Full analytics suite", "Unlimited stores", "24/7 support", "API access"],
        isActive: true,
      }
    ];
    
    await db.insert(subscriptionTiers).values(tiers);
  }
}

// Create and export storage instance
// Initialize database
initializeDatabase().catch(err => {
  console.error("Failed to initialize database:", err);
});

export const storage = new DatabaseStorage();
