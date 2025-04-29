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
  recentOrderSchema
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

// Create a demo user for testing
async function createDemoUser() {
  try {
    const existingUser = await storage.getUserByEmail("demo@example.com");
    if (!existingUser) {
      // Create demo user with hashed password
      const hashedPassword = await hashPassword("demo123");
      await storage.createUser({
        username: "demo",
        password: hashedPassword,
        email: "demo@example.com",
        fullName: "John Smith"
      });
    }
  } catch (error) {
    console.error("Failed to create demo user:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication and get middleware
  const { ensureAuthenticated } = setupAuth(app);
  
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
      
      // Delete the connection
      const success = await storage.deleteStoreConnection(connectionId);
      
      if (success) {
        res.status(200).json({ 
          success: true, 
          message: "Store connection deleted successfully" 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Failed to delete store connection" 
        });
      }
    } catch (error) {
      console.error("Error deleting store connection:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error deleting store connection" 
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
      const userId = parseInt(req.query.userId as string);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Valid userId is required" });
      }
      
      const subscription = await storage.getUserSubscription(userId);
      
      if (!subscription) {
        return res.status(404).json({ message: "No active subscription found" });
      }
      
      const tier = await storage.getSubscriptionTiers();
      const userTier = tier.find(t => t.id === subscription.tierId);
      
      if (!userTier) {
        return res.status(404).json({ message: "Subscription tier not found" });
      }
      
      const totalOrders = 653; // Mock data for demo
      
      res.status(200).json({
        subscription,
        tier: userTier,
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
  
  // Shopify OAuth routes
  app.get("/api/shopify/oauth/begin", ensureAuthenticated, (req: Request, res: Response) => {
    beginOAuth(req, res);
  });
  
  app.get("/api/shopify/oauth/callback", (req: Request, res: Response) => {
    completeOAuth(req, res);
  });
  
  // Shopify webhooks endpoint
  app.post("/api/shopify/webhooks", validateShopifyWebhook, async (req: Request, res: Response) => {
    const topic = req.shopifyTopic;
    const shop = req.shopifyShop;
    
    if (!topic || !shop) {
      return res.status(400).json({ success: false, message: "Missing topic or shop" });
    }
    
    try {
      console.log(`Received webhook: ${topic} from ${shop}`);
      
      // Get the store connection for this shop
      const connection = await storage.getStoreConnectionByShopId(shop);
      
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
          console.log('New order created:', req.body);
          
          // Update order count for this store
          await storage.updateStoreConnection(connection.id, {
            totalOrdersProcessed: (connection.totalOrdersProcessed || 0) + 1
          });
          
          break;
        
        case 'products/update':
          // Process product update
          console.log('Product updated:', req.body);
          break;
        
        // Add more webhook handlers as needed
        
        default:
          console.log(`Unhandled webhook topic: ${topic}`);
      }
      
      // Shopify expects a 200 response quickly to acknowledge receipt
      res.status(200).send();
    } catch (error) {
      console.error(`Error processing webhook ${topic} from ${shop}:`, error);
      res.status(500).json({ success: false, message: "Error processing webhook" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
