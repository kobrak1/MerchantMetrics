import { Button } from "@/components/ui/button";
import { StoreConnection } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Menu, Plus, X, Package, Users, ShoppingCart, Home, Settings } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-mobile";

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
  onConnectStoreClick
}: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };
  
  return (
    <div 
      className={cn(
        "bg-primary-dark text-white h-full flex-shrink-0 transition-all duration-300 transform",
        isExpanded ? "w-64" : "w-16",
        isMobile && !isExpanded && "-translate-x-full"
      )}
    >
      <div className="p-4 flex items-center justify-between border-b border-primary">
        <h1 className={cn("text-xl font-medium", !isExpanded && "hidden")}>ShopMetrics</h1>
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
      
      <div className="py-4 flex flex-col h-full">
        <div className={cn("px-4 py-2 mb-4", !isExpanded && "px-2")}>
          {isExpanded && (
            <p className="text-xs uppercase text-neutral-300 font-medium mb-2">Connected Stores</p>
          )}
          
          {storeConnections.map((connection) => (
            <div 
              key={connection.id}
              className={cn(
                "flex items-center mb-2 p-2 rounded cursor-pointer",
                "bg-primary bg-opacity-20 hover:bg-opacity-30",
                activeConnectionId === connection.id && "bg-opacity-40"
              )}
              onClick={() => onConnectionChange(connection.id)}
            >
              <div 
                className={cn(
                  "h-2 w-2 rounded-full mr-2",
                  connection.isActive ? "bg-success" : "bg-destructive"
                )}
              />
              {isExpanded ? (
                <span className="text-sm truncate">{connection.name} ({connection.platform})</span>
              ) : (
                <span className="text-xs font-bold">
                  {connection.name.substring(0, 1)}
                </span>
              )}
            </div>
          ))}
          
          <Button 
            variant="ghost" 
            className={cn(
              "mt-3 text-xs flex items-center text-secondary-light p-1",
              !isExpanded && "justify-center w-full p-1"
            )}
            onClick={onConnectStoreClick}
          >
            <Plus className="h-4 w-4 mr-1" />
            {isExpanded && "Connect Store"}
          </Button>
        </div>
        
        <ul>
          <li className="px-4 py-2 bg-primary bg-opacity-30">
            <a href="#" className="flex items-center">
              <Home className="h-5 w-5 mr-3" />
              {isExpanded && <span>Dashboard</span>}
            </a>
          </li>
          <li className="px-4 py-2">
            <a href="#" className="flex items-center">
              <ShoppingCart className="h-5 w-5 mr-3" />
              {isExpanded && <span>Orders</span>}
            </a>
          </li>
          <li className="px-4 py-2">
            <a href="#" className="flex items-center">
              <Users className="h-5 w-5 mr-3" />
              {isExpanded && <span>Customers</span>}
            </a>
          </li>
          <li className="px-4 py-2">
            <a href="#" className="flex items-center">
              <Package className="h-5 w-5 mr-3" />
              {isExpanded && <span>Inventory</span>}
            </a>
          </li>
          <li className="px-4 py-2">
            <a href="#" className="flex items-center">
              <Settings className="h-5 w-5 mr-3" />
              {isExpanded && <span>Settings</span>}
            </a>
          </li>
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
                {subscriptionInfo.currentOrders} / {subscriptionInfo.maxOrders} orders
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
