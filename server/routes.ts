import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { 
  insertUserSchema, 
  insertStoreConnectionSchema,
  kpiDataSchema,
  storePerformanceSchema,
  topProductSchema,
  recentOrderSchema,
  User
} from "@shared/schema";
import { testShopifyConnection } from "./api/shopify";
import { testMagentoConnection } from "./api/magento";
import { 
  getKPIData, 
  getStorePerformance, 
  getTopProducts, 
  getRecentOrders 
} from "./api/analytics";
import { setupAuth, hashPassword } from "./auth";
import { beginOAuth, completeOAuth, validateShopifyWebhook } from "./shopify/oauth";
import { trackApiUsage, enforcePlanLimits } from "./middleware/limits";
import { trackUserSession, expireInactiveSessions } from "./middleware/session-tracker";

// Create and update demo and admin users for testing
async function createDemoUser() {
  try {
    // Create demo user if not exists
    const existingDemoUser = await storage.getUserByEmail("demo@example.com");
    if (!existingDemoUser) {
      // Create demo user with hashed password
      const hashedPassword = await hashPassword("demo123");
      const demoUser = await storage.createUser({
        username: "demo",
        password: hashedPassword,
        email: "demo@example.com",
        fullName: "John Smith"
      });
      console.log("Demo user created successfully");
      
      // Create subscription for demo user
      await ensureUserHasSubscription(demoUser.id);
    }

    // Get admin credentials from environment variables
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
    
    // Check if admin user exists by email
    let existingAdminUser = await storage.getUserByEmail(adminEmail);
    let adminUser;
    
    if (!existingAdminUser) {
      // Admin user doesn't exist, create it
      const hashedPassword = await hashPassword(adminPassword);
      adminUser = await storage.createUser({
        username: adminUsername,
        password: hashedPassword,
        email: adminEmail,
        fullName: "System Administrator",
        isAdmin: true
      });
      console.log("Admin user created successfully");
    } else if (existingAdminUser.username !== adminUsername) {
      // Update admin user if username in .env is different
      const hashedPassword = await hashPassword(adminPassword);
      adminUser = await storage.updateUser(existingAdminUser.id, {
        username: adminUsername,
        password: hashedPassword,
        isAdmin: true
      });
      console.log("Admin user updated with new credentials");
    } else {
      // Admin user exists with the same username, but we should check if password needs updating
      // We can't compare passwords directly (they're hashed), so we'll update it anyway to ensure it matches .env
      const hashedPassword = await hashPassword(adminPassword);
      adminUser = await storage.updateUser(existingAdminUser.id, {
        password: hashedPassword
      });
      console.log("Admin user password updated to match .env");
    }
    
    // Ensure admin user has an active subscription
    if (adminUser) {
      await ensureUserHasSubscription(adminUser.id);
    } else if (existingAdminUser) {
      await ensureUserHasSubscription(existingAdminUser.id);
    }
  } catch (error) {
    console.error("Failed to create/update users:", error);
  }
}

// Helper function to ensure a user has an active subscription
async function ensureUserHasSubscription(userId: number) {
  try {
    // Check if user already has a subscription
    const subscription = await storage.getUserSubscription(userId);
    if (!subscription) {
      // Get the free tier
      const freeTiers = await storage.getSubscriptionTiers();
      const freeTier = freeTiers.find(tier => tier.name.toLowerCase().includes('free'));
      
      if (freeTier) {
        // Create a free subscription for the user
        await storage.createUserSubscription({
          userId,
          tierId: freeTier.id,
          startDate: new Date(),
          isActive: true,
          isTrial: false
        });
        console.log(`Created free subscription for user ${userId}`);
      } else {
        console.error('Free tier not found in subscription_tiers table');
      }
    }
  } catch (error) {
    console.error(`Error ensuring subscription for user ${userId}:`, error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication and get middleware
  const { ensureAuthenticated, ensureAdmin } = setupAuth(app);
  
  // Admin routes
  app.get("/api/admin/users", ensureAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.status(200).json({
        success: true,
        users: users.map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          isAdmin: user.isAdmin || false,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          sessionCount: user.sessionCount || 0
        }))
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching users"
      });
    }
  });

  app.get("/api/admin/users/:id", ensureAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID"
        });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      // Get subscription info for this user
      const subscription = await storage.getUserSubscription(userId);
      
      // Get store connections for this user
      const storeConnections = await storage.getStoreConnectionsByUserId(userId);

      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          isAdmin: user.isAdmin || false,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          sessionCount: user.sessionCount || 0
        },
        subscription,
        storeConnections
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching user details"
      });
    }
  });

  app.patch("/api/admin/users/:id", ensureAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID"
        });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      // Only allow specific fields to be updated
      const allowedFields = ['isAdmin', 'fullName', 'email', 'allowedStoreCount'];
      const updateData: Partial<User> = {};
      
      for (const field of allowedFields) {
        if (field in req.body) {
          (updateData as any)[field] = req.body[field];
        }
      }

      const updatedUser = await storage.updateUser(userId, updateData);

      res.status(200).json({
        success: true,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          isAdmin: updatedUser.isAdmin || false,
          lastLoginAt: updatedUser.lastLoginAt,
          createdAt: updatedUser.createdAt
        }
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({
        success: false,
        message: "Error updating user"
      });
    }
  });

  // Create a demo user for testing
  await createDemoUser();
  
  // Apply API usage tracking middleware to all authenticated routes
  app.use(trackApiUsage);
  
  // Apply user session tracking for authenticated users
  app.use(trackUserSession);
  
  // Apply plan limits enforcement
  app.use(enforcePlanLimits);
  
  // Protected Store connection routes
  app.get("/api/store-connections", ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      // Get user ID from authenticated user
      const userId = (req.user as any).id;
      
      const connections = await storage.getStoreConnectionsByUserId(userId);
      res.status(200).json({
        success: true,
        connections
      });
    } catch (error) {
      console.error("Error fetching store connections:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error fetching store connections" 
      });
    }
  });
  
  app.post("/api/store-connections", ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      // Get user ID from the authenticated user's session
      const userId = (req.user as any).id;
      
      // Parse and validate the data
      const connectionData = insertStoreConnectionSchema.parse({
        ...req.body,
        userId // Add the user ID from the authenticated session
      });
      
      // Test connection before saving
      let connectionValid = false;
      
      if (connectionData.platform === 'shopify') {
        connectionValid = await testShopifyConnection(
          connectionData.storeUrl,
          connectionData.apiKey,
          connectionData.apiSecret
        );
      } else if (connectionData.platform === 'magento') {
        connectionValid = await testMagentoConnection(
          connectionData.storeUrl,
          connectionData.apiKey
        );
      }
      
      if (!connectionValid) {
        return res.status(400).json({ 
          success: false, 
          message: "Could not connect to store. Please check your credentials." 
        });
      }
      
      const connection = await storage.createStoreConnection(connectionData);
      res.status(201).json({
        success: true,
        connection
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: fromZodError(error).message 
        });
      }
      console.error("Error creating store connection:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error creating store connection" 
      });
    }
  });
  
  // Delete a store connection
  app.delete("/api/store-connections/:id", ensureAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: "User not authenticated" 
        });
      }
      
      const connectionId = parseInt(req.params.id);
      if (isNaN(connectionId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid connection ID" 
        });
      }
      
      // Verify the connection belongs to the current user
      const connection = await storage.getStoreConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ 
          success: false, 
          message: "Store connection not found" 
        });
      }
      
      if (connection.userId !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: "You are not authorized to delete this connection" 
        });
      }
      
      console.log(`Starting deletion of store connection ${connectionId} for user ${userId}`);
      
      try {
        // Delete the connection and related data
        const success = await storage.deleteStoreConnection(connectionId);
        
        if (success) {
          console.log(`Successfully deleted store connection ${connectionId}`);
          res.status(200).json({ 
            success: true, 
            message: "Store connection deleted successfully" 
          });
        } else {
          console.error(`Failed to delete store connection ${connectionId} - no rows affected`);
          res.status(500).json({ 
            success: false, 
            message: "Failed to delete store connection" 
          });
        }
      } catch (deleteError: any) {
        console.error(`Error in deleteStoreConnection for connection ${connectionId}:`, deleteError);
        // Return a more specific error message when available
        res.status(500).json({ 
          success: false, 
          message: `Error deleting store connection: ${deleteError.message || 'Database error'}`
        });
      }
    } catch (error: any) {
      console.error("Error in store connection deletion route:", error);
      res.status(500).json({ 
        success: false, 
        message: `Error processing store connection deletion: ${error.message || 'Unknown error'}`
      });
    }
  });
  
  // Analytics routes
  app.get("/api/analytics/kpi", async (req: Request, res: Response) => {
    try {
      const storeConnectionId = parseInt(req.query.storeConnectionId as string);
      
      if (isNaN(storeConnectionId)) {
        return res.status(400).json({ message: "Valid storeConnectionId is required" });
      }
      
      const kpiData = await getKPIData(storeConnectionId);
      
      res.status(200).json(kpiData);
    } catch (error) {
      console.error("Error fetching KPI data:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  app.get("/api/analytics/store-performance", async (req: Request, res: Response) => {
    try {
      // Check if storeConnectionIds query param is provided
      if (!req.query.storeConnectionIds) {
        return res.status(400).json({ message: "storeConnectionIds parameter is required" });
      }
      
      const storeConnectionIds = (req.query.storeConnectionIds as string)
        .split(',')
        .map(id => parseInt(id));
      
      if (!storeConnectionIds.length || storeConnectionIds.some(isNaN)) {
        return res.status(400).json({ message: "Valid storeConnectionIds are required" });
      }
      
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      
      const performanceData = await getStorePerformance(storeConnectionIds, days);
      
      res.status(200).json(performanceData);
    } catch (error) {
      console.error("Error fetching store performance:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  app.get("/api/analytics/top-products", async (req: Request, res: Response) => {
    try {
      const storeConnectionId = parseInt(req.query.storeConnectionId as string);
      
      if (isNaN(storeConnectionId)) {
        return res.status(400).json({ message: "Valid storeConnectionId is required" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      
      const products = await getTopProducts(storeConnectionId, limit);
      
      res.status(200).json(products);
    } catch (error) {
      console.error("Error fetching top products:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  app.get("/api/analytics/recent-orders", async (req: Request, res: Response) => {
    try {
      const storeConnectionId = parseInt(req.query.storeConnectionId as string);
      
      if (isNaN(storeConnectionId)) {
        return res.status(400).json({ message: "Valid storeConnectionId is required" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      
      const orders = await getRecentOrders(storeConnectionId, limit);
      
      res.status(200).json(orders);
    } catch (error) {
      console.error("Error fetching recent orders:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // New endpoint for full orders list with optional pagination
  app.get("/api/analytics/orders", async (req: Request, res: Response) => {
    try {
      const storeConnectionId = parseInt(req.query.storeConnectionId as string);
      if (isNaN(storeConnectionId)) {
        return res.status(400).json({ message: "Valid storeConnectionId is required" });
      }

      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const status = req.query.status as string | undefined;
      const offset = (page - 1) * limit;
      
      // Get orders from the database
      const ordersData = await storage.getOrdersByStoreConnection(storeConnectionId, limit, offset, status);
      
      // Get total count for pagination
      const totalCount = await storage.getOrdersCountByStoreConnection(storeConnectionId, status);
      
      res.status(200).json({
        orders: ordersData,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      console.error("Error getting orders:", error);
      res.status(500).json({ error: "Failed to get orders" });
    }
  });
  
  // New endpoint for customers data
  app.get("/api/analytics/customers", async (req: Request, res: Response) => {
    try {
      const storeConnectionId = parseInt(req.query.storeConnectionId as string);
      if (isNaN(storeConnectionId)) {
        return res.status(400).json({ message: "Valid storeConnectionId is required" });
      }

      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      
      // Get customer data (simplified for now - in a real implementation, we'd have a customers table)
      // For now, let's derive customers from orders
      const orders = await storage.getOrdersByStoreConnection(storeConnectionId);
      
      // Group orders by customer ID to create customer profiles
      const customerMap = new Map();
      orders.forEach(order => {
        if (!customerMap.has(order.customerId)) {
          customerMap.set(order.customerId, {
            id: order.customerId,
            name: `Customer ${order.customerId.substring(0, 8)}`, // Simple fallback name
            orderCount: 0,
            totalSpent: 0,
            currency: order.currency,
            lastOrderDate: null
          });
        }
        
        const customer = customerMap.get(order.customerId);
        customer.orderCount++;
        customer.totalSpent += order.totalAmount;
        
        // Track the most recent order date
        const orderDate = new Date(order.orderDate);
        if (!customer.lastOrderDate || orderDate > customer.lastOrderDate) {
          customer.lastOrderDate = orderDate;
        }
      });
      
      const customers = Array.from(customerMap.values());
      
      // Sort by total spent (descending)
      customers.sort((a, b) => b.totalSpent - a.totalSpent);
      
      // Apply pagination
      const offset = (page - 1) * limit;
      const paginatedCustomers = customers.slice(offset, offset + limit);
      
      res.status(200).json({
        customers: paginatedCustomers,
        pagination: {
          total: customers.length,
          page,
          limit,
          pages: Math.ceil(customers.length / limit)
        }
      });
    } catch (error) {
      console.error("Error getting customers:", error);
      res.status(500).json({ error: "Failed to get customers" });
    }
  });
  
  // New endpoint for products/inventory
  app.get("/api/analytics/products", async (req: Request, res: Response) => {
    try {
      const storeConnectionId = parseInt(req.query.storeConnectionId as string);
      if (isNaN(storeConnectionId)) {
        return res.status(400).json({ message: "Valid storeConnectionId is required" });
      }
      
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      
      const products = await storage.getProductsByStoreConnection(storeConnectionId);
      
      // Apply pagination in memory
      const offset = (page - 1) * limit;
      const paginatedProducts = products.slice(offset, offset + limit);
      
      res.status(200).json({
        products: paginatedProducts,
        pagination: {
          total: products.length,
          page,
          limit,
          pages: Math.ceil(products.length / limit)
        }
      });
    } catch (error) {
      console.error("Error getting products:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });
  
  // New endpoint for low-stock products
  app.get("/api/analytics/low-stock-products", async (req: Request, res: Response) => {
    try {
      const storeConnectionId = parseInt(req.query.storeConnectionId as string);
      if (isNaN(storeConnectionId)) {
        return res.status(400).json({ message: "Valid storeConnectionId is required" });
      }
      
      const lowStockProducts = await storage.getLowStockProducts(storeConnectionId);
      res.status(200).json(lowStockProducts);
    } catch (error) {
      console.error("Error getting low stock products:", error);
      res.status(500).json({ error: "Failed to get low stock products" });
    }
  });
  
  // Subscription routes
  app.get("/api/subscription-tiers", async (req: Request, res: Response) => {
    try {
      const tiers = await storage.getSubscriptionTiers();
      res.status(200).json(tiers);
    } catch (error) {
      console.error("Error fetching subscription tiers:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  app.get("/api/user-subscription", async (req: Request, res: Response) => {
    try {
      // Use authenticated user's ID instead of query parameter
      const userId = (req.user as any)?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      let subscription = await storage.getUserSubscription(userId);
      
      // If no subscription, create a free trial
      if (!subscription) {
        const tiers = await storage.getSubscriptionTiers();
        const freeTier = tiers.find(t => t.name === 'Free Trial');
        
        if (!freeTier) {
          return res.status(500).json({ message: "Free trial tier not found" });
        }
        
        // Calculate trial end date (14 days from now)
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 14);
        
        const trialSubscription = {
          userId,
          tierId: freeTier.id,
          startDate,
          endDate,
          isActive: true,
          isTrial: true
        };
        
        subscription = await storage.createUserSubscription(trialSubscription);
        console.log('Created free trial subscription for user', userId);
      }
      
      const tiers = await storage.getSubscriptionTiers();
      const userTier = tiers.find(t => t.id === subscription.tierId);
      
      if (!userTier) {
        return res.status(404).json({ message: "Subscription tier not found" });
      }
      
      // Check if trial has expired
      let trialExpired = false;
      if (subscription.isTrial && subscription.endDate) {
        trialExpired = new Date(subscription.endDate) < new Date();
      }
      
      // Get total orders for the user's stores
      let totalOrders = 0;
      const storeConnections = await storage.getStoreConnectionsByUserId(userId);
      
      for (const connection of storeConnections) {
        const count = await storage.getOrdersCountByStoreConnection(connection.id);
        totalOrders += count;
      }
      
      res.status(200).json({
        subscription,
        tier: userTier,
        trialExpired,
        trialDaysLeft: subscription.isTrial && subscription.endDate ? 
          Math.max(0, Math.floor((new Date(subscription.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0,
        usage: {
          orders: totalOrders,
          maxOrders: userTier.maxOrders,
          percentUsed: Math.round((totalOrders / userTier.maxOrders) * 100)
        }
      });
    } catch (error) {
      console.error("Error fetching user subscription:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Demo data route (for development purposes)
  app.get("/api/demo-data", async (req: Request, res: Response) => {
    try {
      const demoUser = await storage.getUserByEmail("demo@example.com");
      
      if (!demoUser) {
        return res.status(404).json({ message: "Demo user not found" });
      }
      
      // KPI demo data
      const kpiData = {
        dailyRevenue: 2854.40,
        totalOrders: 147,
        repeatBuyerRate: 38.6,
        inventoryAlerts: [
          {
            id: 1,
            name: "Basic T-Shirt (S)",
            sku: "BTS-001",
            inventory: 0,
            lowStockThreshold: 10,
            status: "OUT_OF_STOCK"
          },
          {
            id: 2,
            name: "Denim Jacket (M)",
            sku: "DJ-101",
            inventory: 0,
            lowStockThreshold: 10,
            status: "OUT_OF_STOCK"
          },
          {
            id: 3,
            name: "Leather Wallet",
            sku: "LW-201",
            inventory: 3,
            lowStockThreshold: 5,
            status: "LOW_STOCK"
          },
          {
            id: 4,
            name: "Cotton Socks",
            sku: "CS-301",
            inventory: 5,
            lowStockThreshold: 10,
            status: "LOW_STOCK"
          },
          {
            id: 5,
            name: "Winter Hat",
            sku: "WH-401",
            inventory: 7,
            lowStockThreshold: 10,
            status: "LOW_STOCK"
          }
        ]
      };
      
      // Store performance demo data
      const storePerformance = {
        labels: ["Oct 18", "Oct 19", "Oct 20", "Oct 21", "Oct 22", "Oct 23", "Oct 24"],
        datasets: [
          {
            label: "Awesome Apparel (Shopify)",
            data: [1250, 1380, 1120, 1450, 1680, 1520, 1880]
          },
          {
            label: "Tech Gadgets (Magento)",
            data: [980, 1050, 920, 1100, 1240, 1150, 980]
          }
        ]
      };
      
      // Top products demo data
      const topProducts = [
        {
          id: 1,
          name: "Premium Hoodie",
          orders: 120,
          revenue: 4800,
          currency: "USD"
        },
        {
          id: 2,
          name: "Graphic T-Shirt",
          orders: 95,
          revenue: 2850,
          currency: "USD"
        },
        {
          id: 3,
          name: "Canvas Backpack",
          orders: 78,
          revenue: 3120,
          currency: "USD"
        },
        {
          id: 4,
          name: "Running Shoes",
          orders: 65,
          revenue: 7800,
          currency: "USD"
        },
        {
          id: 5,
          name: "Wireless Earbuds",
          orders: 52,
          revenue: 5200,
          currency: "USD"
        }
      ];
      
      // Recent orders demo data
      const recentOrders = [
        {
          id: 1,
          orderId: "5723",
          orderNumber: "ORD-5723",
          customer: {
            id: "cust-1",
            name: "Jane Doe",
            initials: "JD"
          },
          date: "Oct 24, 2023",
          amount: 128.50,
          currency: "USD",
          status: "COMPLETED",
          storePlatform: "SHOPIFY"
        },
        {
          id: 2,
          orderId: "5722",
          orderNumber: "ORD-5722",
          customer: {
            id: "cust-2",
            name: "Mike Smith",
            initials: "MS"
          },
          date: "Oct 24, 2023",
          amount: 85.20,
          currency: "USD",
          status: "PROCESSING",
          storePlatform: "SHOPIFY"
        },
        {
          id: 3,
          orderId: "5721",
          orderNumber: "ORD-5721",
          customer: {
            id: "cust-3",
            name: "Lisa Johnson",
            initials: "LJ"
          },
          date: "Oct 23, 2023",
          amount: 245.00,
          currency: "USD",
          status: "COMPLETED",
          storePlatform: "MAGENTO"
        },
        {
          id: 4,
          orderId: "5720",
          orderNumber: "ORD-5720",
          customer: {
            id: "cust-4",
            name: "Robert Kim",
            initials: "RK"
          },
          date: "Oct 23, 2023",
          amount: 67.80,
          currency: "USD",
          status: "REFUNDED",
          storePlatform: "SHOPIFY"
        },
        {
          id: 5,
          orderId: "5719",
          orderNumber: "ORD-5719",
          customer: {
            id: "cust-5",
            name: "Amy Taylor",
            initials: "AT"
          },
          date: "Oct 22, 2023",
          amount: 124.30,
          currency: "USD",
          status: "COMPLETED",
          storePlatform: "MAGENTO"
        }
      ];
      
      // Store connections demo data
      const storeConnections = [
        {
          id: 1,
          userId: demoUser.id,
          name: "Awesome Apparel",
          platform: "shopify",
          storeUrl: "awesome-apparel.myshopify.com",
          apiKey: "demo-shopify-key",
          apiSecret: "demo-shopify-secret",
          isActive: true,
          lastSyncAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        },
        {
          id: 2,
          userId: demoUser.id,
          name: "Tech Gadgets",
          platform: "magento",
          storeUrl: "tech-gadgets.com/store",
          apiKey: "demo-magento-key",
          apiSecret: "demo-magento-secret",
          isActive: false,
          lastSyncAt: null,
          createdAt: new Date().toISOString()
        }
      ];
      
      // Subscription demo data
      const subscription = {
        id: 1,
        userId: demoUser.id,
        tierId: 2, // Growth Plan
        startDate: new Date().toISOString(),
        endDate: null,
        isActive: true
      };
      
      const tier = {
        id: 2,
        name: "Growth Plan",
        maxOrders: 1000,
        price: 29,
        features: ["Advanced analytics", "Connect up to 3 stores", "Priority support"],
        isActive: true
      };
      
      const totalOrders = 653;
      
      const subscriptionData = {
        subscription,
        tier,
        usage: {
          orders: totalOrders,
          maxOrders: tier.maxOrders,
          percentUsed: Math.round((totalOrders / tier.maxOrders) * 100)
        }
      };
      
      res.status(200).json({
        user: {
          id: demoUser.id,
          username: demoUser.username,
          email: demoUser.email,
          fullName: demoUser.fullName || "John Smith"
        },
        kpiData,
        storePerformance,
        topProducts,
        recentOrders,
        storeConnections,
        subscription: subscriptionData
      });
    } catch (error) {
      console.error("Error fetching demo data:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Apply API usage tracking middleware to all authenticated routes
  app.use(trackApiUsage);
  
  // Apply user session tracking for authenticated users
  app.use(trackUserSession);
  
  // Apply plan limits enforcement
  app.use(enforcePlanLimits);
  
  // Shopify OAuth routes - don't require authentication for direct installs
  app.get("/api/shopify/oauth/begin", (req: Request, res: Response) => {
    beginOAuth(req, res);
  });
  
  app.get("/api/shopify/oauth/callback", (req: Request, res: Response) => {
    completeOAuth(req, res);
  });
  
  // Shopify webhooks endpoint
  app.post("/api/shopify/webhooks", validateShopifyWebhook, async (req: Request, res: Response) => {
    try {
      const topic = req.shopifyTopic;
      const shop = req.shopifyShop;
      
      if (!topic || !shop) {
        return res.status(400).json({ success: false, message: "Missing topic or shop" });
      }
      
      console.log(`Received webhook: ${topic} from ${shop}`);
      
      // Get the store connection for this shop domain or shop ID 
      // (depending on how it's sent in the webhook)
      let connection = null;
      if (shop.includes('gid://')) {
        // This is a shop ID
        connection = await storage.getStoreConnectionByShopId(shop);
      } else {
        // This is likely a domain
        const connections = await storage.getAllStoreConnections();
        connection = connections.find(conn => conn.shopDomain === shop);
      }
      
      if (!connection) {
        return res.status(404).json({ success: false, message: "Store connection not found" });
      }
      
      // Update the last webhook timestamp
      await storage.updateStoreConnection(connection.id, {
        lastWebhookAt: new Date()
      });
      
      // Handle different webhook topics
      switch (topic) {
        case 'orders/create':
          // Process new order
          console.log('New order received:', req.body.id);
          
          try {
            const order = req.body;
            const orderId = order.id.toString();
            const customerId = order.customer?.id?.toString() || 'guest';
            
            // Map financial status to our status
            let status = 'PENDING';
            switch (order.financial_status) {
              case 'paid':
                status = 'COMPLETED';
                break;
              case 'refunded':
                status = 'REFUNDED';
                break;
              case 'pending':
                status = 'PROCESSING';
                break;
              default:
                status = 'PENDING';
            }
            
            // Save order to database
            await storage.createOrder({
              storeConnectionId: connection.id,
              orderId,
              orderNumber: order.name || order.order_number?.toString(),
              customerId,
              status,
              totalAmount: parseFloat(order.total_price),
              currency: order.currency || 'USD',
              orderDate: new Date(order.created_at),
            });
            
            // Update order count for this store
            await storage.updateStoreConnection(connection.id, {
              totalOrdersProcessed: (connection.totalOrdersProcessed || 0) + 1,
              lastSyncAt: new Date()
            });
          } catch (err) {
            console.error('Error processing order webhook:', err);
          }
          
          break;
        
        case 'products/update':
          // Process product update
          console.log('Product updated:', req.body.id);
          
          try {
            const product = req.body;
            const productId = product.id.toString();
            
            // Check if this product already exists in our database
            const products = await storage.getProductsByStoreConnection(connection.id);
            const existingProduct = products.find(p => p.productId === productId);
            
            // Get the first variant for inventory info
            const variant = product.variants?.[0];
            
            if (existingProduct) {
              // Update existing product
              await storage.updateProduct(existingProduct.id, {
                name: product.title,
                price: variant?.price ? parseFloat(variant.price) : null,
                sku: variant?.sku || null,
                inventory: variant?.inventory_quantity ?? null,
                updatedAt: new Date()
              });
            } else {
              // Create new product
              await storage.createProduct({
                storeConnectionId: connection.id,
                name: product.title,
                productId,
                price: variant?.price ? parseFloat(variant.price) : null,
                sku: variant?.sku || null,
                inventory: variant?.inventory_quantity ?? null,
                lowStockThreshold: 10, // Default value
                currency: 'USD', // Default currency
              });
            }
          } catch (err) {
            console.error('Error processing product webhook:', err);
          }
          
          break;
          
        case 'app/uninstalled':
          // App was uninstalled, mark the connection as inactive
          console.log('App uninstalled from shop:', shop);
          await storage.updateStoreConnection(connection.id, {
            isActive: false
          });
          break;
        
        // Add more webhook handlers as needed
        
        default:
          console.log(`Unhandled webhook topic: ${topic}`);
      }
      
      // Shopify expects a 200 response quickly to acknowledge receipt
      res.status(200).send();
    } catch (error) {
      console.error(`Error processing webhook:`, error);
      // Still return 200 to acknowledge the webhook was received
      // Shopify will consider it a failure otherwise and retry
      res.status(200).send();
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
