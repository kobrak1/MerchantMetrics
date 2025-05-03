import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import { restResources } from '@shopify/shopify-api/rest/admin/2023-10';
import '@shopify/shopify-api/adapters/node'; // Required for Node.js runtime
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
    // SessionData is already defined in auth.ts, so we don't redefine it here
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

// Utility function to get shop details and access token
async function getShopifyTokenAndInfo(shop: string, code: string) {
  // Complete OAuth to get access token
  const accessTokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code
    })
  });
  
  if (!accessTokenResponse.ok) {
    throw new Error('Failed to get access token from Shopify');
  }
  
  const tokenData = await accessTokenResponse.json();
  const accessToken = tokenData.access_token;
  const scope = tokenData.scope;
  
  // Get shop details from Shopify using direct GraphQL API
  const shopGraphQLResponse = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken
    },
    body: JSON.stringify({
      query: `{
        shop {
          id
          name
        }
      }`
    })
  });
  
  if (!shopGraphQLResponse.ok) {
    throw new Error('Failed to get shop details from Shopify');
  }
  
  const shopData = await shopGraphQLResponse.json();
  const shopInfo = shopData.data.shop;
  const shopId = shopInfo.id.toString();
  const shopName = shopInfo.name;
  
  return { accessToken, shopId, shopName, scope };
}

// Helper function to hash passwords
export async function hashPassword(password: string): Promise<string> {
  // This function should be imported from auth.ts but we're defining it here temporarily
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${derivedKey.toString('hex')}.${salt}`);
    });
  });
}

// Redirect users to Shopify OAuth page
export async function beginOAuth(req: Request, res: Response) {
  // Handle both embedded and standalone OAuth flows
  const isEmbedded = Boolean(req.query.embedded);
  
  // Get user ID - either from session if already authenticated or create a temporary one
  let userId = (req.user as any)?.id;
  
  // For OAuth from Shopify installation flow, we might not have a user yet
  if (!userId && req.query.shop) {
    // Store temporary info in session to create user after successful auth
    if (!req.session) {
      req.session = {} as any;
    }
    (req.session as any).pendingShopifyAuth = true;
    // Use a placeholder userId that will be replaced after auth
    userId = -1;
  } else if (!userId) {
    return res.status(401).json({ 
      success: false, 
      message: "User not authenticated" 
    });
  }
  
  // Only verify plan limits for existing users
  if (userId !== -1) {
    try {
      // Verify user can connect stores based on plan
      const canConnectStore = await verifyUserCanConnectStore(userId);
      
      if (!canConnectStore.success) {
        return res.status(403).json({ 
          success: false, 
          message: canConnectStore.message 
        });
      }
    } catch (err) {
      console.error('Error verifying user store connection limit:', err);
      return res.status(500).json({
        success: false,
        message: "Failed to verify subscription status"
      });
    }
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
  if (!req.session) {
    req.session = {} as any;
  }
  (req.session as any).shopifyOAuthState = state;
  (req.session as any).shopifyOAuthShop = shop;
  (req.session as any).userId = userId;
  
  // Generate OAuth URL - remove leading slash to avoid double slash in the final URL
  const redirectPath = `api/shopify/oauth/callback`;
  
  // Extract host without protocol to avoid duplication and ensure no trailing slash
  let hostWithoutProtocol = process.env.SHOPIFY_HOST!.replace(/^https?:\/\//, '');
  hostWithoutProtocol = hostWithoutProtocol.replace(/\/+$/, ''); // Remove any trailing slashes
  
  // Full redirect URL to use in the OAuth flow with proper formatting
  const fullRedirectUrl = `https://${hostWithoutProtocol}/${redirectPath}`;
  console.log('Shopify OAuth redirect URL:', fullRedirectUrl);
  
  // Shopify API v11 uses different auth method
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${process.env.SHOPIFY_SCOPES}&redirect_uri=${encodeURIComponent(fullRedirectUrl)}&state=${state}`;
  
  if (isEmbedded) {
    // For embedded apps, we need to use the Shopify App Bridge to redirect
    res.status(200).json({ success: true, url: authUrl });
  } else {
    // For standalone or direct installation, do a direct redirect
    res.redirect(authUrl);
  }
}

// Handle OAuth callback from Shopify
export async function completeOAuth(req: Request, res: Response) {
  try {
    // Validate state to prevent CSRF
    const { state, shop, code } = req.query as { state: string, shop: string, code: string };
    const storedState = (req.session as any).shopifyOAuthState;
    const storedShop = (req.session as any).shopifyOAuthShop;
    let userId = (req.session as any).userId;
    const pendingShopifyAuth = (req.session as any).pendingShopifyAuth;
    
    if (!storedState || !storedShop || state !== storedState || shop !== storedShop) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid OAuth state or shop" 
      });
    }
    
    // Get token and shop info
    const { accessToken, shopId, shopName, scope } = await getShopifyTokenAndInfo(shop, code);
    
    // For direct app installation from Shopify, we need to create a demo user
    if (userId === -1 || pendingShopifyAuth) {
      // Create a demo user for this store if none exists
      try {
        // Generate a random username based on the shop domain
        const username = `shop_${shop.split('.')[0]}`;
        const email = `${username}@example.com`;  // Placeholder email
        const password = crypto.randomBytes(16).toString('hex');  // Random secure password
        
        // Check if user with this username already exists
        const existingUser = await storage.getUserByUsername(username);
        
        if (existingUser) {
          // Use existing user
          userId = existingUser.id;
        } else {
          // Create new user with minimal required fields
          const newUser = await storage.createUser({
            username,
            email,
            password: await hashPassword(password),
            fullName: shopName
          });
          
          userId = newUser.id;
          
          // Automatically log in this user
          req.login(newUser, (err) => {
            if (err) {
              console.error('Error logging in new user:', err);
            }
          });
        }
      } catch (err) {
        console.error('Error creating demo user:', err);
        return res.status(500).json({
          success: false,
          message: "Failed to create user account"
        });
      }
    }
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication failed"
      });
    }
    
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
      
      // Register webhooks for this store
      await registerShopifyWebhooks(shop, accessToken);
      
      // Start initial data sync from Shopify
      try {
        const { syncShopifyData } = await import('./data-sync');
        // Run this asynchronously so we don't block the OAuth completion
        syncShopifyData(shop, accessToken, existingConnection.id).catch(err => {
          console.error('Error during initial data sync:', err);
        });
      } catch (err) {
        console.error('Error importing data sync module:', err);
      }
      
      // Clean up session
      delete (req.session as any).shopifyOAuthState;
      delete (req.session as any).shopifyOAuthShop;
      delete (req.session as any).pendingShopifyAuth;
      
      // Redirect directly to dashboard for app store installs
      if (pendingShopifyAuth) {
        return res.redirect('/');
      }
      
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
    
    // Register webhooks for this store
    await registerShopifyWebhooks(shop, accessToken);
    
    // Start initial data sync from Shopify
    try {
      const { syncShopifyData } = await import('./data-sync');
      // Run this asynchronously so we don't block the OAuth completion
      syncShopifyData(shop, accessToken, newConnection.id).catch(err => {
        console.error('Error during initial data sync:', err);
      });
    } catch (err) {
      console.error('Error importing data sync module:', err);
    }
    
    // Clean up session
    delete (req.session as any).shopifyOAuthState;
    delete (req.session as any).shopifyOAuthShop;
    delete (req.session as any).pendingShopifyAuth;
    
    // For app store installs, redirect to the main app
    if (pendingShopifyAuth) {
      return res.redirect('/');
    }
    
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

// Register webhooks for a Shopify store
export async function registerShopifyWebhooks(shopDomain: string, accessToken: string): Promise<void> {
  try {
    console.log(`Registering webhooks for ${shopDomain}`);
    
    // Extract host without protocol and trailing slash
    let hostWithoutProtocol = process.env.SHOPIFY_HOST!.replace(/^https?:\/\//, '');
    hostWithoutProtocol = hostWithoutProtocol.replace(/\/+$/, '');
    
    // Define the webhook endpoint
    const webhookUrl = `https://${hostWithoutProtocol}/api/shopify/webhooks`;
    
    // Define the webhooks we want to register
    const webhooks = [
      { topic: 'orders/create', address: webhookUrl },
      { topic: 'products/update', address: webhookUrl },
      { topic: 'app/uninstalled', address: webhookUrl }
    ];
    
    // Register each webhook
    for (const webhook of webhooks) {
      try {
        // Register webhook using GraphQL API
        const response = await fetch(`https://${shopDomain}/admin/api/2024-01/graphql.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken
          },
          body: JSON.stringify({
            query: `
              mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
                webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
                  userErrors {
                    field
                    message
                  }
                  webhookSubscription {
                    id
                  }
                }
              }
            `,
            variables: {
              topic: webhook.topic.toUpperCase().replace('/', '_'),
              webhookSubscription: {
                callbackUrl: webhook.address,
                format: "JSON"
              }
            }
          })
        });
        
        const data = await response.json();
        
        if (data.errors) {
          console.error(`Error registering webhook ${webhook.topic}:`, data.errors);
        } else if (data.data?.webhookSubscriptionCreate?.userErrors?.length > 0) {
          console.error(`Error registering webhook ${webhook.topic}:`, data.data.webhookSubscriptionCreate.userErrors);
        } else {
          console.log(`Successfully registered webhook for ${webhook.topic}`);
        }
      } catch (err) {
        console.error(`Failed to register webhook for ${webhook.topic}:`, err);
      }
    }
  } catch (error) {
    console.error('Error registering webhooks:', error);
  }
}