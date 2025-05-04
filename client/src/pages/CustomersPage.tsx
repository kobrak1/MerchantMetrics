import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStoreConnections } from "@/hooks/use-store-connection";
import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import ConnectStoreModal from "@/components/modals/ConnectStoreModal";
import { getInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Phone, MapPin } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CustomersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [activeConnectionId, setActiveConnectionId] = useState<number | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Fetch store connections
  const {
    storeConnections = [],
    isLoading: isLoadingConnections,
    activeConnectionId: hookActiveConnectionId,
    setActiveConnectionId: hookSetActiveConnectionId,
    addStoreConnection,
    connectWithOAuth,
  } = useStoreConnections();

  // Use the connection ID from the hook directly
  useEffect(() => {
    if (
      hookActiveConnectionId !== null &&
      hookActiveConnectionId !== undefined
    ) {
      console.log(
        "CustomersPage - Setting active connection ID from hook:",
        hookActiveConnectionId,
      );
      setActiveConnectionId(hookActiveConnectionId);
    }
  }, [hookActiveConnectionId]);

  console.log(
    "CustomersPage state - activeConnectionId:",
    activeConnectionId,
    "Hook connection ID:",
    hookActiveConnectionId,
  );

  // Fetch customers data
  const { data: customersResponse, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ["/api/analytics/customers", activeConnectionId],
    queryFn: async () => {
      if (!activeConnectionId) return { customers: [] };
      const res = await fetch(
        `/api/analytics/customers?storeConnectionId=${activeConnectionId}`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch customers");
      }
      return res.json();
    },
    enabled: !!activeConnectionId,
  });

  // Extract customers from the response
  const allCustomers = customersResponse?.customers || [];

  // Filter customers by name
  const filteredCustomers = allCustomers.filter((customer: any) => {
    const customerName = (customer.name || customer.id || "").toLowerCase();
    return (
      searchQuery === "" || customerName.includes(searchQuery.toLowerCase())
    );
  });

  // Fetch user subscription
  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
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
      ? (subscription.orderCount /
          subscription?.subscription?.tier?.maxOrders) *
        100
      : 0,
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  };

  if (isLoadingConnections || isLoadingSubscription) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-200">
      {/* Sidebar */}
      <div
        className={`${isMobileSidebarOpen ? "block" : "hidden"} md:block absolute md:relative z-10 h-full`}
      >
        <Sidebar
          storeConnections={storeConnections}
          activeConnectionId={activeConnectionId}
          onConnectionChange={setActiveConnectionId}
          subscriptionInfo={subscriptionInfo}
          onConnectStoreClick={() => setIsConnectModalOpen(true)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Customers"
          userName={user?.fullName || user?.username || "User"}
          userInitials={getInitials(user?.fullName || user?.username || "User")}
          onMobileMenuClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">Customers</h1>
            <div className="flex flex-wrap gap-2">
              <Input
                className="w-[250px]"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="flex rounded-md shadow-sm">
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  className="rounded-l-md rounded-r-none"
                  onClick={() => setViewMode("table")}
                >
                  Table
                </Button>
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  className="rounded-r-md rounded-l-none"
                  onClick={() => setViewMode("grid")}
                >
                  Grid
                </Button>
              </div>
            </div>
          </div>

          {isLoadingCustomers ? (
            <div className="flex h-64 w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : allCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-lg border-gray-300 bg-white p-6">
              <p className="text-gray-500 mb-4">
                No customers found for this store
              </p>
              <Button onClick={() => setIsConnectModalOpen(true)}>
                Connect Another Store
              </Button>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-lg border-gray-300 bg-white p-6">
              <p className="text-gray-500 mb-4">
                No customers match your search
              </p>
              <Button onClick={() => setSearchQuery("")} variant="outline">
                Clear Search
              </Button>
            </div>
          ) : viewMode === "table" ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer: any) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {getInitials(customer.name || "")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {customer.name || customer.id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{customer.email || "N/A"}</TableCell>
                      <TableCell>{customer.location || "N/A"}</TableCell>
                      <TableCell className="text-right">
                        {customer.orderCount || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(
                          customer.totalSpent || 0,
                          customer.currency || "USD",
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCustomers.map((customer: any) => (
                <Card key={customer.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback>
                            {getInitials(customer.name || "")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle>{customer.name || customer.id}</CardTitle>
                          <CardDescription>
                            {customer.email || "No email available"}
                          </CardDescription>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            •••
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>View Orders</DropdownMenuItem>
                          <DropdownMenuItem>Export Data</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2 text-sm">
                      {customer.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <span>{customer.phone}</span>
                        </div>
                      )}
                      {customer.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span>{customer.location}</span>
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-500" />
                          <span>{customer.email}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between bg-gray-50 p-4">
                    <div>
                      <span className="text-sm text-gray-500">Orders</span>
                      <p className="font-medium">{customer.orderCount || 0}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Total Spent</span>
                      <p className="font-medium">
                        {formatCurrency(
                          customer.totalSpent || 0,
                          customer.currency || "USD",
                        )}
                      </p>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      <ConnectStoreModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnect={addStoreConnection}
        onOAuthConnect={connectWithOAuth}
      />
    </div>
  );
}
