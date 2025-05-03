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