import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import { restResources } from '@shopify/shopify-api/rest/admin/2023-10';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { insertStoreConnectionSchema } from '@shared/schema';

// Add Shopify shop info to Request object
declare global {
  namespace Express {
    interface Request {
      shopifyShop?: string;
      shopifyTopic?: string;
    }
  }
}

// Initialize Shopify API with your credentials
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SHOPIFY_SCOPES!.split(','),
  hostName: process.env.SHOPIFY_HOST!.replace(/https?:\/\//, ''),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false,
  hostScheme: 'https',
  restResources,
});

// Validate Shopify webhook HMAC signature
export function validateShopifyWebhook(req: Request, res: Response, next: NextFunction) {
  const hmac = req.headers['x-shopify-hmac-sha256'] as string;
  const topic = req.headers['x-shopify-topic'] as string;
  const shopDomain = req.headers['x-shopify-shop-domain'] as string;
  const data = req.body;
  
  if (!hmac || !topic || !shopDomain) {
    return res.status(401).json({ error: 'Missing required headers' });
  }
  
  // Get raw body data
  const body = JSON.stringify(data);
  
  // Compute HMAC using Shopify's API secret
  const calculated = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET!)
    .update(body, 'utf8')
    .digest('base64');
  
  // Verify the HMAC signature matches
  if (calculated !== hmac) {
    return res.status(401).json({ error: 'HMAC validation failed' });
  }
  
  // Add Shopify shop info to request for use in routes
  req.shopifyShop = shopDomain;
  req.shopifyTopic = topic;
  
  next();
}

// Generate a random nonce for OAuth state validation
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Redirect users to Shopify OAuth page
export function beginOAuth(req: Request, res: Response) {
  // Get user ID from authenticated user
  const userId = (req.user as any)?.id;
  if (!userId) {
    return res.status(401).json({ 
      success: false, 
      message: "User not authenticated" 
    });
  }
  
  // Verify user can connect stores based on plan
  verifyUserCanConnectStore(userId).then(canConnectStore => {
    if (!canConnectStore.success) {
      return res.status(403).json({ 
        success: false, 
        message: canConnectStore.message 
      });
    }
    
    const shop = req.query.shop as string;
    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing shop parameter" 
      });
    }
    
    // Generate a unique state for this OAuth request
    const state = generateNonce();
    
    // Store the state in session to validate on callback
    req.session.shopifyOAuthState = state;
    req.session.shopifyOAuthShop = shop;
    req.session.userId = userId;
    
    // Generate OAuth URL
    const redirectUrl = `/api/shopify/oauth/callback`;
    const authUrl = shopify.auth.beginAuth({
      shop,
      callbackPath: redirectUrl,
      isOnline: false, // Use offline access to get a refresh token
      state,
    });
    
    // Redirect to Shopify OAuth page
    res.status(200).json({ success: true, url: authUrl });
  }).catch(error => {
    console.error('Error starting OAuth flow:', error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to start OAuth flow" 
    });
  });
}

// Handle OAuth callback from Shopify
export async function completeOAuth(req: Request, res: Response) {
  try {
    // Validate state to prevent CSRF
    const { state, shop, code } = req.query as { state: string, shop: string, code: string };
    const storedState = req.session.shopifyOAuthState;
    const storedShop = req.session.shopifyOAuthShop;
    const userId = req.session.userId;
    
    if (!storedState || !storedShop || state !== storedState || shop !== storedShop || !userId) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid OAuth state or shop" 
      });
    }
    
    // Complete OAuth to get access token
    const callbackResponse = await shopify.auth.validateAuthCallback({
      rawRequest: req,
      rawResponse: res,
      query: { code, shop, state },
    });
    
    const { accessToken, scope } = callbackResponse.session;
    
    // Get shop details from Shopify
    const client = new shopify.clients.Rest({
      session: callbackResponse.session,
    });
    
    const shopData = await client.get({
      path: 'shop',
    });
    
    const shopInfo = shopData.body.shop as any;
    const shopId = shopInfo.id.toString();
    const shopName = shopInfo.name;
    
    // Check if this store has already been connected by this or another user
    const existingConnection = await checkShopConnection(shopId);
    if (existingConnection) {
      // Don't allow reconnection if already connected by another user
      if (existingConnection.userId !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: "This store has already been connected to another account" 
        });
      }
      
      // Update the existing connection
      const updatedConnection = await storage.updateStoreConnection(existingConnection.id, {
        accessToken,
        scope,
        isActive: true,
        lastSyncAt: new Date(),
      });
      
      return res.status(200).json({ 
        success: true, 
        message: "Store reconnected successfully",
        connection: updatedConnection
      });
    }
    
    // Create a new store connection in our database
    const newConnection = await storage.createStoreConnection({
      userId,
      name: shopName,
      platform: 'shopify',
      storeUrl: `https://${shop}`,
      shopId,
      shopDomain: shop,
      accessToken,
      scope,
      apiKey: '', // Not used with OAuth but keep for backwards compatibility
      apiSecret: '', // Not used with OAuth but keep for backwards compatibility
    });
    
    // Clean up session
    delete req.session.shopifyOAuthState;
    delete req.session.shopifyOAuthShop;
    
    // Return success with connection details
    return res.status(201).json({ 
      success: true, 
      message: "Store connected successfully",
      connection: newConnection
    });
    
  } catch (error) {
    console.error('Shopify OAuth error:', error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to complete OAuth flow" 
    });
  }
}

// Check if user can connect another store based on their plan
async function verifyUserCanConnectStore(userId: number) {
  try {
    // Get user details including plan info
    const user = await storage.getUser(userId);
    if (!user) {
      return { success: false, message: "User not found" };
    }
    
    // Get user's current store connections
    const connections = await storage.getStoreConnectionsByUserId(userId);
    
    // Get user's allowed store count (default to 1 if not set)
    const allowedStoreCount = user.allowedStoreCount || 1;
    
    // Check if user has reached their store limit
    if (connections.length >= allowedStoreCount) {
      return { 
        success: false, 
        message: `Your plan allows a maximum of ${allowedStoreCount} store${allowedStoreCount !== 1 ? 's' : ''}. Please upgrade your plan to connect more stores.` 
      };
    }
    
    // User can connect a store
    return { success: true };
  } catch (error) {
    console.error("Error verifying user's ability to connect store:", error);
    return { success: false, message: "Failed to verify your subscription status" };
  }
}

// Check if shop is already connected
async function checkShopConnection(shopId: string) {
  try {
    // Get all store connections
    const connections = await storage.getAllStoreConnections();
    
    // Find connection with matching shopId
    return connections.find(conn => conn.shopId === shopId);
  } catch (error) {
    console.error("Error checking shop connection:", error);
    return null;
  }
}