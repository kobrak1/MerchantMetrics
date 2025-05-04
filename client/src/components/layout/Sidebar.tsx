import { Button } from "@/components/ui/button";
import { StoreConnection } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Menu,
  Plus,
  X,
  Package,
  Users,
  ShoppingCart,
  Home,
  Settings,
  Trash2,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/use-mobile";
import { useStoreConnections } from "@/hooks/use-store-connection";
import { useAuth } from "@/hooks/use-auth";
import { backgroundImages } from "@/styles/sidebar";
import { Link, useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import SidebarBackground from "@/components/layout/SidebarBackground";

interface SidebarProps {
  storeConnections: StoreConnection[];
  activeConnectionId: number | null;
  onConnectionChange: (id: number) => void;
  subscriptionInfo: {
    name: string;
    maxOrders: number;
    currentOrders: number;
    percentUsed: number;
  };
  onConnectStoreClick: () => void;
}

export default function Sidebar({
  storeConnections,
  activeConnectionId,
  onConnectionChange,
  subscriptionInfo,
  onConnectStoreClick,
}: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { removeStoreConnection } = useStoreConnections();
  const { user } = useAuth();
  const { toast } = useToast();
  const [storeToRemove, setStoreToRemove] = useState<number | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  console.log("Sidebar user:", user);

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  const handleRemoveStore = async () => {
    if (storeToRemove === null) return;

    try {
      const result = await removeStoreConnection(storeToRemove);
      if (result.success) {
        setIsConfirmOpen(false);
        setStoreToRemove(null);
      }
    } catch (error) {
      console.error("Error removing store:", error);
      toast({
        title: "Error",
        description:
          "There was a problem removing the store. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div
      className={cn(
        "bg-primary-dark text-white h-full flex-shrink-0 transition-all duration-300 transform",
        isExpanded ? "w-64" : "w-16",
        isMobile && !isExpanded && "-translate-x-full",
      )}
    >
      <div className="p-4 h-[61px] flex items-center justify-between border-b-[2px] border-primary bg-gray-300 shadow-lg shadow-primary/50">
        <h1 className={cn("text-xl font-medium", !isExpanded && "hidden")}>
          DataPilot
        </h1>
        {isExpanded ? (
          <Button
            variant="ghost"
            size="icon"
            className="text-white md:hidden"
            onClick={toggleSidebar}
          >
            <X className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="text-white"
            onClick={toggleSidebar}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div
        className="py-4 flex flex-col h-full bg-gray-400"
        style={{
          backgroundImage: user?.sidebarBackground && user.sidebarBackground !== 'none' 
            ? backgroundImages[user.sidebarBackground as keyof typeof backgroundImages] 
            : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className={cn("px-4 py-2 mb-4", !isExpanded && "px-2")}>
          {isExpanded && (
            <p className="text-xs uppercase text-neutral-100 font-medium mb-2">
              Connected Stores
            </p>
          )}

          <div
            className={cn(
              storeConnections.length > 4 && isExpanded
                ? "max-h-64 overflow-y-auto pr-1 custom-scrollbar"
                : "",
            )}
          >
            {storeConnections.map((connection) => (
              <div
                key={connection.id}
                className={cn(
                  "group flex items-center justify-between mb-2 p-2 rounded",
                  "bg-primary bg-opacity-20 hover:bg-opacity-30",
                  activeConnectionId === connection.id && "bg-opacity-40",
                )}
              >
                <div
                  className="flex items-center cursor-pointer"
                  onClick={() => onConnectionChange(connection.id)}
                >
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full mr-2",
                      connection.isActive ? "bg-success" : "bg-destructive",
                    )}
                  />
                  {isExpanded ? (
                    <span className="text-sm truncate">
                      {connection.name} ({connection.platform})
                    </span>
                  ) : (
                    <span className="text-xs font-bold">
                      {connection.name.substring(0, 1)}
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <AlertDialog
                    open={isConfirmOpen && storeToRemove === connection.id}
                    onOpenChange={(open) => {
                      setIsConfirmOpen(open);
                      if (!open) setStoreToRemove(null);
                    }}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent triggering the parent's onClick
                          setStoreToRemove(connection.id);
                          setIsConfirmOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-red-500" />
                          Remove Store
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove{" "}
                          <strong>{connection.name}</strong>? This will
                          disconnect your store and remove all associated data.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-500 text-white hover:bg-red-600"
                          onClick={handleRemoveStore}
                        >
                          Remove Store
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))}
          </div>

          <Button
            variant="ghost"
            className={cn(
              "mt-3 text-sm flex items-center text-secondary-light p-1 hover:bg-white/50 hover:backdrop-blur-sm",
              !isExpanded && "justify-center w-full p-1",
            )}
            onClick={onConnectStoreClick}
          >
            <Plus className="h-4 w-4 mr-1" />
            {isExpanded && "Connect Store"}
          </Button>
        </div>

        <ul>
          {[
            {
              path: "/",
              label: "Dashboard",
              icon: <Home className="h-5 w-5 mr-3" />,
            },
            {
              path: "/orders",
              label: "Orders",
              icon: <ShoppingCart className="h-5 w-5 mr-3" />,
            },
            {
              path: "/customers",
              label: "Customers",
              icon: <Users className="h-5 w-5 mr-3" />,
            },
            {
              path: "/inventory",
              label: "Inventory",
              icon: <Package className="h-5 w-5 mr-3" />,
            },
            {
              path: "/settings",
              label: "Settings",
              icon: <Settings className="h-5 w-5 mr-3" />,
            },
            ...(user?.isAdmin
              ? [
                  {
                    path: "/admin",
                    label: "Admin Dashboard",
                    icon: <ShieldAlert className="h-5 w-5 mr-3" />,
                  },
                ]
              : []),
          ].map(({ path, label, icon }) => {
            const [location] = useLocation();
            const isActive = location === path;

            return (
              <li
                key={path}
                className={cn(
                  "px-4 py-2 hover:bg-white/30 hover:backdrop-blur-sm",
                  isActive && "bg-primary bg-opacity-30",
                )}
              >
                <Link href={path} className="flex items-center text-white">
                  {icon}
                  {isExpanded && <span>{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto p-4 bg-primary text-white">
          {isExpanded && (
            <>
              <p className="text-xs uppercase font-medium mb-1">Current Plan</p>
              <p className="font-medium">{subscriptionInfo.name}</p>
              <div className="bg-white bg-opacity-20 rounded-full h-1.5 mt-2">
                <div
                  className="bg-secondary h-1.5 rounded-full"
                  style={{ width: `${subscriptionInfo.percentUsed}%` }}
                ></div>
              </div>
              <p className="text-xs mt-1">
                {subscriptionInfo.currentOrders} / {subscriptionInfo.maxOrders}{" "}
                orders
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs bg-white text-primary py-1 px-3 rounded-full h-auto"
              >
                Upgrade Plan
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
