import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useStoreConnections } from "@/hooks/use-store-connection";
import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import DateFilter from "@/components/dashboard/DateFilter";
import KPICard from "@/components/dashboard/KPICard";
import InventoryAlert from "@/components/dashboard/InventoryAlert";
import StorePerformance from "@/components/dashboard/StorePerformance";
import TopProducts from "@/components/dashboard/TopProducts";
import RecentOrders from "@/components/dashboard/RecentOrders";
import ConnectStoreModal from "@/components/modals/ConnectStoreModal";
import { getInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState("week");
  const [showConnectModal, setShowConnectModal] = useState(false);

  const {
    storeConnections,
    activeConnectionId,
    setActiveConnectionId,
    addStoreConnection,
    connectWithOAuth,
    isLoading: storeConnectionsLoading,
  } = useStoreConnections();

  // Query for KPI data for the active connection
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/analytics/kpi", activeConnectionId, dateFilter],
    queryFn: async () => {
      if (!activeConnectionId)
        return {
          dailyRevenue: 0,
          totalOrders: 0,
          repeatBuyerRate: 0,
          inventoryAlerts: [],
        };

      try {
        const res = await apiRequest(
          "GET",
          `/api/analytics/kpi?storeConnectionId=${activeConnectionId}&dateFilter=${dateFilter}`,
        );
        const data = await res.json();
        console.log("KPI Data:", data); // Log the data for debugging
        return data; // Return the data directly as it comes from the API
      } catch (error) {
        console.error("Failed to fetch KPI data:", error);
        return {
          dailyRevenue: 0,
          totalOrders: 0,
          repeatBuyerRate: 0,
          inventoryAlerts: [],
        };
      }
    },
    enabled: !!activeConnectionId,
    staleTime: 60000, // 1 minute
  });

  // Query for store performance data
  const { data: performanceData, isLoading: performanceLoading } = useQuery({
    queryKey: [
      "/api/analytics/store-performance",
      activeConnectionId,
      dateFilter,
    ],
    queryFn: async () => {
      if (!activeConnectionId)
        return {
          labels: [],
          datasets: [],
        };

      try {
        const res = await apiRequest(
          "GET",
          `/api/analytics/store-performance?storeConnectionIds=${activeConnectionId}&period=${dateFilter}`,
        );
        const data = await res.json();
        console.log("Performance Data:", data); // Log the data for debugging
        return data; // Return data directly as it comes from the API
      } catch (error) {
        console.error("Failed to fetch performance data:", error);
        return {
          labels: [],
          datasets: [],
        };
      }
    },
    enabled: !!activeConnectionId,
    staleTime: 60000, // 1 minute
  });

  // Query for top products
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["/api/analytics/top-products", activeConnectionId],
    queryFn: async () => {
      if (!activeConnectionId) return [];

      try {
        const res = await apiRequest(
          "GET",
          `/api/analytics/top-products?storeConnectionId=${activeConnectionId}`,
        );
        const data = await res.json();
        console.log("Top Products Data:", data); // Log the data for debugging
        return data; // Return data directly as it comes from the API
      } catch (error) {
        console.error("Failed to fetch top products:", error);
        return [];
      }
    },
    enabled: !!activeConnectionId,
    staleTime: 60000, // 1 minute
  });

  // Query for recent orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/analytics/recent-orders", activeConnectionId],
    queryFn: async () => {
      if (!activeConnectionId) return [];

      try {
        const res = await apiRequest(
          "GET",
          `/api/analytics/recent-orders?storeConnectionId=${activeConnectionId}`,
        );
        const data = await res.json();
        console.log("Recent Orders Data:", data); // Log the data for debugging
        return data; // Return data directly as it comes from the API
      } catch (error) {
        console.error("Failed to fetch recent orders:", error);
        return [];
      }
    },
    enabled: !!activeConnectionId,
    staleTime: 60000, // 1 minute
  });

  // Query for user subscription
  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["/api/user-subscription"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/user-subscription");
        return res.json();
      } catch (error) {
        console.error("Failed to fetch subscription:", error);
        return {
          subscription: {
            tier: { name: "Free", maxOrders: 100 },
            usage: { orders: 0, percentUsed: 0 },
          },
        };
      }
    },
    enabled: !!user,
    staleTime: 60000, // 1 minute
  });

  const handleDateFilterChange = (filter: string) => {
    setDateFilter(filter);
  };

  const handleConnectStore = async (connectionData: any) => {
    try {
      const result = await addStoreConnection(connectionData);

      if (result.success) {
        toast({
          title: "Store connected successfully",
          description: `${connectionData.name} has been connected to your account.`,
        });
        setShowConnectModal(false);
      }

      return result;
    } catch (error) {
      console.error("Failed to connect store:", error);
      return { success: false, error };
    }
  };

  const handleOAuthConnect = async (platform: string, shop: string) => {
    try {
      return await connectWithOAuth(platform, shop);
    } catch (error) {
      console.error("Failed to start OAuth flow:", error);
      return { success: false, error };
    }
  };

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const isLoading =
    storeConnectionsLoading ||
    analyticsLoading ||
    performanceLoading ||
    productsLoading ||
    ordersLoading ||
    subscriptionLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading dashboard data...
          </p>
        </div>
      </div>
    );
  }

  // Process and use the data directly as it comes from the API
  // Note: analyticsData is the direct KPI response (not nested in a kpiData property)
  const kpiData = analyticsData || {
    dailyRevenue: 0,
    totalOrders: 0,
    repeatBuyerRate: 0,
    inventoryAlerts: [],
  };

  // performanceData is directly the store performance data
  const storePerformance = performanceData || {
    labels: [],
    datasets: [],
  };

  // The products and orders are direct arrays from the API (not nested)
  const topProducts = productsData || [];
  const recentOrders = ordersData || [];

  const subscription = subscriptionData || {
    tier: { name: "Free", maxOrders: 100 },
    usage: { orders: 0, percentUsed: 0 },
  };

  const noStoreConnected = storeConnections.length === 0;

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-100">
      {/* Sidebar */}
      <div
        className={`${isMobileSidebarOpen ? "block" : "hidden"} md:block absolute md:relative z-10 h-full`}
      >
        <Sidebar
          storeConnections={storeConnections}
          activeConnectionId={activeConnectionId}
          onConnectionChange={setActiveConnectionId}
          subscriptionInfo={{
            name: subscription.tier.name,
            maxOrders: subscription.tier.maxOrders,
            currentOrders: subscription.usage.orders,
            percentUsed: subscription.usage.percentUsed,
          }}
          onConnectStoreClick={() => setShowConnectModal(true)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Dashboard"
          userName={user?.fullName || user?.username || "User"}
          userInitials={getInitials(user?.fullName || user?.username || "User")}
          onMobileMenuClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        <main className="flex-1 overflow-y-auto p-4">
          {noStoreConnected ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="max-w-md text-center">
                <h2 className="text-2xl font-bold mb-4">
                  Connect your first store
                </h2>
                <p className="text-gray-600 mb-6">
                  To start seeing your store analytics, you need to connect your
                  e-commerce store.
                </p>
                <button
                  onClick={() => setShowConnectModal(true)}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition"
                >
                  Connect Store
                </button>
              </div>
            </div>
          ) : (
            <>
              <DateFilter
                onFilterChange={handleDateFilterChange}
                defaultFilter={dateFilter}
              />

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <KPICard
                  title="Daily Revenue"
                  value={kpiData.dailyRevenue}
                  percentageChange={0}
                  type="currency"
                  chartType="line"
                  chartData={{
                    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                    datasets: [
                      {
                        label: "Daily Revenue",
                        data: [0, 0, 0, 0, 0, 0, 0], // This would be replaced with actual data
                      },
                    ],
                  }}
                />

                <KPICard
                  title="Total Orders"
                  value={kpiData.totalOrders}
                  percentageChange={0}
                  chartType="bar"
                  chartData={{
                    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                    datasets: [
                      {
                        label: "Orders",
                        data: [0, 0, 0, 0, 0, 0, 0], // This would be replaced with actual data
                      },
                    ],
                  }}
                />

                <KPICard
                  title="Repeat Buyer Rate"
                  value={kpiData.repeatBuyerRate}
                  percentageChange={0}
                  type="percentage"
                  chartData={{
                    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                    datasets: [
                      {
                        label: "Repeat Buyer Rate",
                        data: [0, 0, 0, 0, 0, 0, 0], // This would be replaced with actual data
                        borderColor: "#f44336",
                        backgroundColor: "rgba(244, 67, 54, 0.1)",
                      },
                    ],
                  }}
                />

                <KPICard
                  title="Inventory Alerts"
                  value={kpiData.inventoryAlerts?.length || 0}
                >
                  {kpiData.inventoryAlerts &&
                  kpiData.inventoryAlerts.length > 0 ? (
                    kpiData.inventoryAlerts.map(
                      (alert: {
                        id: number;
                        name: string;
                        inventory: number;
                        status: string;
                      }) => (
                        <InventoryAlert
                          key={alert.id}
                          name={alert.name}
                          inventory={alert.inventory}
                          status={alert.status as "OUT_OF_STOCK" | "LOW_STOCK"}
                        />
                      ),
                    )
                  ) : (
                    <p className="text-sm text-gray-500 p-2">
                      No inventory alerts.
                    </p>
                  )}
                </KPICard>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <StorePerformance
                    data={storePerformance}
                    onPeriodChange={handleDateFilterChange}
                    defaultPeriod={
                      dateFilter === "week"
                        ? "7days"
                        : dateFilter === "month"
                          ? "30days"
                          : dateFilter === "quarter"
                            ? "quarter"
                            : "7days"
                    }
                  />
                </div>

                <div>
                  <TopProducts products={topProducts} />
                </div>
              </div>

              <RecentOrders orders={recentOrders} />
            </>
          )}
        </main>
      </div>

      <ConnectStoreModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnect={handleConnectStore}
        onOAuthConnect={handleOAuthConnect}
      />
    </div>
  );
}
