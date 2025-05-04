import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as UserModel } from "@shared/schema";

declare global {
  namespace Express {
    // Extend Express.User interface with our User model
    interface User extends UserModel {}
    
    // Add custom session data properties
    interface SessionData {
      shopifyOAuthState?: string;
      shopifyOAuthShop?: string;
      userId?: number;
    }
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Generate a secure session secret
  const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");

  const sessionSettings: session.SessionOptions = {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }
        
        const passwordValid = await comparePasswords(password, user.password);
        
        if (!passwordValid) {
          return done(null, false, { message: "Invalid username or password" });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Authentication middleware
  app.post("/api/register", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password, email, fullName } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username) 
                        || await storage.getUserByEmail(email);
                        
      if (existingUser) {
        return res.status(409).json({ 
          success: false, 
          message: "Username or email already exists" 
        });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Create new user
      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        fullName
      });
      
      // Auto-login after registration
      req.login(newUser, (err) => {
        if (err) return next(err);
        
        // Create a free subscription for the user
        const subscriptionSetup = async () => {
          try {
            const tiers = await storage.getSubscriptionTiers();
            const freeTier = tiers.find(tier => tier.name === "Free Trial");
            
            if (freeTier) {
              await storage.createUserSubscription({
                userId: newUser.id,
                tierId: freeTier.id,
                startDate: new Date(),
                endDate: null,
                isActive: true
              });
            }
          } catch (error) {
            console.error("Error creating user subscription:", error);
          }
        };
        
        subscriptionSetup();
        
        return res.status(201).json({
          success: true,
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            fullName: newUser.fullName
          }
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Error registering user"
      });
    }
  });

  // Login route
  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: Error, user: UserModel, info: { message: string }) => {
      if (err) return next(err);
      
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: info?.message || "Invalid username or password"
        });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Update last login info
        storage.updateUser(user.id, {
          lastLoginAt: new Date(),
          lastLoginIp: req.ip,
          sessionCount: (user.sessionCount || 0) + 1
        }).catch(error => {
          console.error("Error updating login stats:", error);
        });
        
        return res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            isAdmin: user.isAdmin || false,
            redirectTo: user.isAdmin ? '/admin-dashboard' : '/'
          }
        });
      });
    })(req, res, next);
  });

  // Logout route
  app.post("/api/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: "Error during logout"
        });
      }
      
      res.status(200).json({ 
        success: true, 
        message: "Logged out successfully"
      });
    });
  });

  // Current user route
  app.get("/api/user", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        message: "Not authenticated"
      });
    }
    
    const user = req.user as UserModel;
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        isAdmin: user.isAdmin || false
      }
    });
  });
  
  // Update user profile
  app.patch("/api/user/profile", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    
    try {
      const userId = req.user.id;
      const { username, email, fullName, currentPassword, newPassword } = req.body;
      
      // Create update data object
      const updateData: Partial<UserModel> = {};
      
      // Validate username if provided
      if (username && username !== req.user.username) {
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser && existingUser.id !== userId) {
          return res.status(409).json({
            success: false,
            field: "username",
            message: "Username already taken"
          });
        }
        updateData.username = username;
      }
      
      // Validate email if provided
      if (email && email !== req.user.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(409).json({
            success: false,
            field: "email",
            message: "Email already in use"
          });
        }
        updateData.email = email;
      }
      
      // Update full name if provided
      if (fullName !== undefined) {
        updateData.fullName = fullName;
      }
      
      // Handle password change if requested
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            field: "currentPassword",
            message: "Current password is required"
          });
        }
        
        // Verify current password
        const passwordValid = await comparePasswords(currentPassword, req.user.password);
        if (!passwordValid) {
          return res.status(401).json({
            success: false,
            field: "currentPassword",
            message: "Current password is incorrect"
          });
        }
        
        // Hash and set new password
        updateData.password = await hashPassword(newPassword);
      }
      
      // Only proceed if there are fields to update
      if (Object.keys(updateData).length > 0) {
        const updatedUser = await storage.updateUser(userId, updateData);
        
        // Update session user
        req.login(updatedUser, (err) => {
          if (err) {
            console.error("Error updating session user:", err);
          }
          
          return res.json({
            success: true,
            user: {
              id: updatedUser.id,
              username: updatedUser.username,
              email: updatedUser.email,
              fullName: updatedUser.fullName,
              isAdmin: updatedUser.isAdmin || false
            }
          });
        });
      } else {
        // No changes were made
        return res.json({
          success: true,
          user: {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            fullName: req.user.fullName,
            isAdmin: req.user.isAdmin || false
          }
        });
      }
    } catch (error) {
      console.error("Error updating user profile:", error);
      return res.status(500).json({
        success: false,
        message: "Error updating user profile"
      });
    }
  });

  // Auth check middleware
  const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    
    res.status(401).json({ 
      success: false, 
      message: "Authentication required"
    });
  };
  
  // Admin check middleware
  const ensureAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated() && (req.user as UserModel).isAdmin) {
      return next();
    }
    
    res.status(403).json({ 
      success: false, 
      message: "Admin access required"
    });
  };

  return { ensureAuthenticated, ensureAdmin };
}