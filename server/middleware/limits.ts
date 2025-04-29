import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { apiUsage } from '@shared/schema';

/**
 * Middleware to track API usage for a specific store connection
 * Records each API request to monitor and enforce usage limits
 */
export async function trackApiUsage(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const userId = (req.user as any)?.id;
  
  // Only track API usage for authenticated users
  if (!userId) {
    return next();
  }
  
  // Get store connection ID from query parameter or body
  const storeConnectionId = 
    parseInt(req.query.storeConnectionId as string) || 
    parseInt(req.body?.storeConnectionId as string) ||
    null;
  
  // Save the original end function
  const originalEnd = res.end;
  
  // Override the end function to capture response status
  res.end = function(chunk?: any, encoding?: any, callback?: any) {
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Log API usage asynchronously (don't block the response)
    logApiUsage(
      userId,
      storeConnectionId,
      req.path,
      req.method,
      statusCode,
      responseTime,
      req.ip,
      req.get('User-Agent') || ''
    ).catch(err => {
      console.error('Error logging API usage:', err);
    });
    
    // Call the original end function
    return originalEnd.call(res, chunk, encoding, callback);
  };
  
  next();
}

/**
 * Middleware to enforce user plan limits
 * Blocks API access if the user has exceeded their plan's order limits
 */
export async function enforcePlanLimits(req: Request, res: Response, next: NextFunction) {
  const userId = (req.user as any)?.id;
  
  // Only enforce limits for authenticated users
  if (!userId) {
    return next();
  }
  
  try {
    // Get the user with their current plan
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Skip enforcement for specific endpoints like account management
    const exemptPaths = [
      '/api/user',
      '/api/subscription-tiers',
      '/api/user-subscription',
      '/api/logout'
    ];
    
    if (exemptPaths.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    // Get the user's subscription
    const subscription = await storage.getUserSubscription(userId);
    if (!subscription) {
      // Allow access if no subscription (free tier or trial)
      return next();
    }
    
    // Get the subscription tier details
    const subscriptionTier = await storage.getSubscriptionTierById(subscription.tierId);
    if (!subscriptionTier) {
      return res.status(404).json({ message: 'Subscription tier not found' });
    }
    
    // Get all store connections for this user
    const storeConnections = await storage.getStoreConnectionsByUserId(userId);
    
    // Calculate total orders processed across all stores
    let totalOrdersProcessed = 0;
    for (const connection of storeConnections) {
      totalOrdersProcessed += connection.totalOrdersProcessed || 0;
    }
    
    // Check if user has exceeded their plan limits
    if (totalOrdersProcessed > subscriptionTier.maxOrders) {
      return res.status(402).json({
        success: false,
        message: 'You have exceeded your plan\'s order limit. Please upgrade your plan to continue using the dashboard.',
        limit: subscriptionTier.maxOrders,
        usage: totalOrdersProcessed,
        upgradeRequired: true
      });
    }
    
    // User is within limits, continue
    next();
  } catch (error) {
    console.error('Error enforcing plan limits:', error);
    // Allow the request to proceed if there's an error checking limits
    next();
  }
}

/**
 * Log API usage to the database asynchronously
 */
async function logApiUsage(
  userId: number,
  storeConnectionId: number | null,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTime: number,
  ipAddress: string,
  userAgent: string
) {
  try {
    // Insert API usage record
    await db.insert(apiUsage).values({
      userId,
      storeConnectionId,
      endpoint,
      method,
      statusCode,
      responseTime,
      ipAddress,
      userAgent
    });
    
    // Update store connection usage counters if applicable
    if (storeConnectionId) {
      // Get the store connection
      const connection = await storage.getStoreConnection(storeConnectionId);
      
      if (connection) {
        // Increment the API request counter
        await storage.updateStoreConnection(storeConnectionId, {
          totalApiRequests: (connection.totalApiRequests || 0) + 1
        });
      }
    }
  } catch (error) {
    console.error('Failed to log API usage:', error);
  }
}