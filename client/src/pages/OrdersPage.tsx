import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStoreConnections } from "@/hooks/use-store-connection";
import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import ConnectStoreModal from "@/components/modals/ConnectStoreModal";
import { getInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function OrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [activeConnectionId, setActiveConnectionId] = useState<number | null>(
    null
  );
  
  // Fetch store connections
  const {
    storeConnections = [],
    isLoading: isLoadingConnections,
    activeConnectionId: hookActiveConnectionId,
    setActiveConnectionId: hookSetActiveConnectionId,
  } = useStoreConnections();

  // Use the connection ID from the hook directly
  useEffect(() => {
    if (hookActiveConnectionId !== null && hookActiveConnectionId !== undefined) {
      console.log('Setting active connection ID from hook:', hookActiveConnectionId);
      setActiveConnectionId(hookActiveConnectionId);
    }
  }, [hookActiveConnectionId]);
  
  console.log('OrdersPage state - activeConnectionId:', activeConnectionId, 'Hook connection ID:', hookActiveConnectionId);

  // Fetch orders data
  const {
    data: ordersResponse,
    isLoading: isLoadingOrders,
  } = useQuery({
    queryKey: ["/api/analytics/orders", activeConnectionId],
    queryFn: async () => {
      if (!activeConnectionId) return { orders: [] };
      const res = await fetch(`/api/analytics/orders?storeConnectionId=${activeConnectionId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch orders");
      }
      return res.json();
    },
    enabled: !!activeConnectionId,
  });
  
  // Extract orders from the response
  const orders = ordersResponse?.orders || [];
  console.log('Orders data:', ordersResponse, 'Extracted orders:', orders);

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

  // Status badges with colors
  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { color: string; text: string } } = {
      processing: { color: "blue", text: "Processing" },
      completed: { color: "green", text: "Completed" },
      cancelled: { color: "red", text: "Cancelled" },
      shipped: { color: "purple", text: "Shipped" },
      pending: { color: "yellow", text: "Pending" },
    };

    const statusLower = status.toLowerCase();
    const statusInfo = statusMap[statusLower] || { color: "gray", text: status };

    return (
      <Badge 
        className={`bg-${statusInfo.color}-100 text-${statusInfo.color}-800 border-${statusInfo.color}-200`}
      >
        {statusInfo.text}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
            <h1 className="text-2xl font-bold">Orders</h1>
            <div className="flex gap-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Input className="w-[250px]" placeholder="Search by order # or customer" />
            </div>
          </div>

          {isLoadingOrders ? (
            <div className="flex h-64 w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-lg border-gray-300 bg-white p-6">
              <p className="text-gray-500 mb-4">No orders found for this store</p>
              <Button onClick={() => setIsConnectModalOpen(true)}>
                Connect Another Store
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNumber || order.orderId}</TableCell>
                      <TableCell>{formatDate(order.orderDate)}</TableCell>
                      <TableCell>{order.customerName || order.customerId}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(order.totalAmount, order.currency)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">View Details</Button>
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