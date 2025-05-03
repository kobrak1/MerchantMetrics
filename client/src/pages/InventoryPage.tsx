import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStoreConnections } from "@/hooks/use-store-connection";
import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import ConnectStoreModal from "@/components/modals/ConnectStoreModal";
import { getInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function InventoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [activeConnectionId, setActiveConnectionId] = useState<number | null>(
    null
  );
  
  // Fetch store connections
  const {
    data: storeConnections = [],
    isLoading: isLoadingConnections,
  } = useStoreConnections();

  // Set active connection if not already set
  if (!isLoadingConnections && storeConnections.length > 0 && activeConnectionId === null) {
    setActiveConnectionId(storeConnections[0].id);
  }

  // Fetch products/inventory data
  const {
    data: products = [],
    isLoading: isLoadingProducts,
  } = useQuery({
    queryKey: ["/api/analytics/products", activeConnectionId],
    queryFn: async () => {
      if (!activeConnectionId) return [];
      const res = await fetch(`/api/analytics/products?storeConnectionId=${activeConnectionId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch products");
      }
      return res.json();
    },
    enabled: !!activeConnectionId,
  });

  // Fetch low stock products
  const {
    data: lowStockProducts = [],
    isLoading: isLoadingLowStock,
  } = useQuery({
    queryKey: ["/api/analytics/low-stock-products", activeConnectionId],
    queryFn: async () => {
      if (!activeConnectionId) return [];
      const res = await fetch(`/api/analytics/low-stock-products?storeConnectionId=${activeConnectionId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch low stock products");
      }
      return res.json();
    },
    enabled: !!activeConnectionId,
  });

  // Fetch user subscription
  const {
    data: subscription,
    isLoading: isLoadingSubscription,
  } = useQuery({
    queryKey: ["/api/user-subscription"],
    queryFn: async () => {
      const res = await fetch("/api/user-subscription");
      if (!res.ok) {
        throw new Error("Failed to fetch subscription");
      }
      return res.json();
    },
  });

  // Get subscription info
  const subscriptionInfo = {
    name: subscription?.subscription?.tier?.name || "Free Plan",
    maxOrders: subscription?.subscription?.tier?.maxOrders || 1000,
    currentOrders: subscription?.orderCount || 0,
    percentUsed: subscription?.orderCount
      ? (subscription.orderCount / subscription?.subscription?.tier?.maxOrders) * 100
      : 0,
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  // Calculate stock status and return appropriate badge
  const getStockStatus = (product: any) => {
    if (!product.inventory && product.inventory !== 0) {
      return <Badge variant="outline">Not Tracked</Badge>;
    }
    
    if (product.inventory <= 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    
    const isLowStock = product.lowStockThreshold && product.inventory <= product.lowStockThreshold;
    
    if (isLowStock) {
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Low Stock</Badge>;
    }
    
    return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">In Stock</Badge>;
  };

  // Calculate stock level percentage for progress bar
  const getStockPercentage = (product: any) => {
    if (!product.inventory && product.inventory !== 0) {
      return 100; // Not tracked
    }
    
    if (product.inventory <= 0) {
      return 0; // Out of stock
    }
    
    if (product.lowStockThreshold) {
      // When threshold is set, use it to calculate percentage
      // Consider 2x threshold as "full" stock for visual purposes
      const maxLevel = product.lowStockThreshold * 2;
      return Math.min(Math.round((product.inventory / maxLevel) * 100), 100);
    }
    
    // Default assumption if no threshold
    return product.inventory > 10 ? 100 : Math.round((product.inventory / 10) * 100);
  };

  if (isLoadingConnections || isLoadingSubscription) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        storeConnections={storeConnections}
        activeConnectionId={activeConnectionId}
        onConnectionChange={setActiveConnectionId}
        subscriptionInfo={subscriptionInfo}
        onConnectStoreClick={() => setIsConnectModalOpen(true)}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          user={{ name: user?.fullName || user?.username || "", initials: getInitials(user?.fullName || user?.username || "") }}
        />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Inventory</h1>
            <div className="flex gap-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="in-stock">In Stock</SelectItem>
                  <SelectItem value="low-stock">Low Stock</SelectItem>
                  <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
              <Input className="w-[250px]" placeholder="Search products..." />
            </div>
          </div>

          {/* Low Stock Alerts Card */}
          {!isLoadingLowStock && lowStockProducts.length > 0 && (
            <Card className="mb-6 border-amber-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <span>Low Stock Alerts</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lowStockProducts.slice(0, 3).map((product: any) => (
                    <div key={product.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center text-gray-500">
                        {product.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">
                            {product.inventory} in stock
                          </span>
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                            Low Stock
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                  {lowStockProducts.length > 3 && (
                    <div className="flex items-center justify-center p-3 rounded-lg border border-dashed">
                      <Button variant="ghost">
                        View {lowStockProducts.length - 3} more items
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {isLoadingProducts ? (
            <div className="flex h-64 w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-lg border-gray-300 bg-white p-6">
              <p className="text-gray-500 mb-4">No products found for this store</p>
              <Button onClick={() => setIsConnectModalOpen(true)}>
                Connect Another Store
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock Status</TableHead>
                    <TableHead>Inventory</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product: any) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku || "—"}</TableCell>
                      <TableCell>{formatCurrency(product.price || 0, product.currency || "USD")}</TableCell>
                      <TableCell>{getStockStatus(product)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-sm">
                            <span>{product.inventory || "Not tracked"}</span>
                            {product.lowStockThreshold && (
                              <span className="text-gray-500">Threshold: {product.lowStockThreshold}</span>
                            )}
                          </div>
                          {product.inventory !== null && (
                            <Progress 
                              value={getStockPercentage(product)} 
                              className={product.inventory <= 0 ? "bg-red-100" : 
                                (product.lowStockThreshold && product.inventory <= product.lowStockThreshold) ? 
                                  "bg-amber-100" : "bg-green-100"}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">Update Stock</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </main>
      </div>

      <ConnectStoreModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />
    </div>
  );
}