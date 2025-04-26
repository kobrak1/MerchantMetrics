import {
  users,
  storeConnections,
  orders,
  products,
  subscriptionTiers,
  userSubscriptions,
  analyticsQueries,
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
} from "@shared/schema";

// Storage interface
export interface IStorage {
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

// Memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private storeConnections: Map<number, StoreConnection>;
  private orders: Map<number, Order>;
  private products: Map<number, Product>;
  private subscriptionTiers: Map<number, SubscriptionTier>;
  private userSubscriptions: Map<number, UserSubscription>;
  private analyticsQueries: Map<number, AnalyticsQuery>;
  
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
        name: "Free Trial",
        maxOrders: 100,
        price: 0,
        features: ["Basic analytics", "Connect 1 store"],
        isActive: true,
      },
      {
        id: this.subscriptionTierId++,
        name: "Growth Plan",
        maxOrders: 1000,
        price: 29,
        features: ["Advanced analytics", "Connect up to 3 stores", "Priority support"],
        isActive: true,
      },
      {
        id: this.subscriptionTierId++,
        name: "Business Plan",
        maxOrders: 5000,
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

// Create and export storage instance
export const storage = new MemStorage();
