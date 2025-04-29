import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { userSessions } from '@shared/schema';

/**
 * Middleware to track user sessions and detect suspicious activity
 */
export async function trackUserSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req.user as any)?.id;
    
    // Only track sessions for authenticated users
    if (!userId) {
      return next();
    }
    
    // Session ID from Express session
    const sessionId = req.sessionID;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent') || '';
    
    // Check if this session is already tracked
    const existingSession = await getSession(sessionId);
    
    if (existingSession) {
      // Update the last activity timestamp for the existing session
      await updateSession(sessionId);
    } else {
      // Get user's existing active sessions
      const activeSessions = await getUserActiveSessions(userId);
      
      // Create a new session record
      await createSession(userId, sessionId, ipAddress, userAgent);
      
      // Update user's session count
      await updateUserSessionCount(userId, activeSessions.length + 1);
      
      // Check for suspicious activity (multiple sessions from different IPs)
      if (activeSessions.length > 0) {
        const uniqueIps = new Set(activeSessions.map(s => s.ipAddress));
        uniqueIps.add(ipAddress);
        
        // If multiple IPs or user agents, log suspicious activity
        if (uniqueIps.size > 1 && !req.session.multipleDevicesNotified) {
          await logSuspiciousActivity(userId, {
            type: 'multiple_ips',
            sessionId,
            ipAddress,
            userAgent,
            existingIps: Array.from(uniqueIps)
          });
          
          // Set a flag to avoid notifying the user multiple times in the same session
          req.session.multipleDevicesNotified = true;
        }
      }
    }
    
    // Store user's last login info
    await updateUserLoginInfo(userId, ipAddress);
    
    next();
  } catch (error) {
    console.error('Error tracking user session:', error);
    // Continue to the next middleware even if tracking fails
    next();
  }
}

/**
 * Middleware to expire inactive sessions
 */
export async function expireInactiveSessions(req: Request, res: Response, next: NextFunction) {
  try {
    // Set expiration time (e.g., 30 days of inactivity)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - 30);
    
    // Find inactive sessions
    const inactiveSessions = await db.select()
      .from(userSessions)
      .where(session => 
        session.isActive.equals(true)
        .and(session.lastActivityAt.lte(expirationDate))
      );
    
    // Mark sessions as expired
    for (const session of inactiveSessions) {
      await db.update(userSessions)
        .set({ 
          isActive: false,
          expiresAt: new Date()
        })
        .where(s => s.id.equals(session.id));
    }
    
    next();
  } catch (error) {
    console.error('Error expiring inactive sessions:', error);
    next();
  }
}

// Helper functions

async function getSession(sessionId: string) {
  const [session] = await db.select()
    .from(userSessions)
    .where(s => s.sessionId.equals(sessionId));
  
  return session;
}

async function updateSession(sessionId: string) {
  await db.update(userSessions)
    .set({ lastActivityAt: new Date() })
    .where(s => s.sessionId.equals(sessionId));
}

async function createSession(
  userId: number,
  sessionId: string,
  ipAddress: string,
  userAgent: string
) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 day expiration
  
  await db.insert(userSessions).values({
    userId,
    sessionId,
    ipAddress,
    userAgent,
    isActive: true,
    lastActivityAt: new Date(),
    expiresAt
  });
}

async function getUserActiveSessions(userId: number) {
  return db.select()
    .from(userSessions)
    .where(s => 
      s.userId.equals(userId)
      .and(s.isActive.equals(true))
    );
}

async function updateUserSessionCount(userId: number, count: number) {
  await storage.updateUser(userId, {
    sessionCount: count
  });
}

async function updateUserLoginInfo(userId: number, ipAddress: string) {
  await storage.updateUser(userId, {
    lastLoginIp: ipAddress,
    lastLoginAt: new Date()
  });
}

async function logSuspiciousActivity(userId: number, details: any) {
  // In a real implementation, this would store the suspicious activity in the database
  // and potentially send an alert to the user via email or in-app notification
  console.warn(`Suspicious activity detected for user ${userId}:`, details);
  
  // You could add your notification logic here
}