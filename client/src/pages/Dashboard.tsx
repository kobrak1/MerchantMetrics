import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDemoData } from "@/lib/api";
import { useStoreConnections } from "@/hooks/use-store-connection";
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

export default function Dashboard() {
  const { data: demoData, isLoading } = useQuery({
    queryKey: ['/api/demo-data'],
    staleTime: Infinity
  });
  
  const { toast } = useToast();
  const [dateFilter, setDateFilter] = useState("week");
  const [showConnectModal, setShowConnectModal] = useState(false);
  
  const {
    storeConnections,
    activeConnectionId,
    setActiveConnectionId,
    addStoreConnection
  } = useStoreConnections();
  
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
      }
      
      return result;
    } catch (error) {
      console.error("Failed to connect store:", error);
      return { success: false, error };
    }
  };
  
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  const {
    kpiData,
    storePerformance,
    topProducts,
    recentOrders,
    user,
    subscription
  } = demoData;
  
  return (
    <div className="flex h-screen overflow-hidden bg-neutral-100">
      {/* Sidebar */}
      <div className={`${isMobileSidebarOpen ? 'block' : 'hidden'} md:block absolute md:relative z-10 h-full`}>
        <Sidebar 
          storeConnections={storeConnections} 
          activeConnectionId={activeConnectionId}
          onConnectionChange={setActiveConnectionId}
          subscriptionInfo={{
            name: subscription.tier.name,
            maxOrders: subscription.tier.maxOrders,
            currentOrders: subscription.usage.orders,
            percentUsed: subscription.usage.percentUsed
          }}
          onConnectStoreClick={() => setShowConnectModal(true)}
        />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Dashboard" 
          userName={user.fullName} 
          userInitials={getInitials(user.fullName)}
          onMobileMenuClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />
        
        <main className="flex-1 overflow-y-auto p-4">
          <DateFilter onFilterChange={handleDateFilterChange} />
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard 
              title="Daily Revenue" 
              value={kpiData.dailyRevenue}
              percentageChange={12.5}
              type="currency"
              chartType="line"
              chartData={{
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                  label: 'Daily Revenue',
                  data: [1880, 2150, 1950, 2420, 2854, 2650, 2400]
                }]
              }}
            />
            
            <KPICard 
              title="Total Orders" 
              value={kpiData.totalOrders}
              percentageChange={8.2}
              chartType="bar"
              chartData={{
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                  label: 'Orders',
                  data: [92, 104, 86, 112, 147, 135, 128]
                }]
              }}
            />
            
            <KPICard 
              title="Repeat Buyer Rate" 
              value={kpiData.repeatBuyerRate}
              percentageChange={-2.1}
              type="percentage"
              chartData={{
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                  label: 'Repeat Buyer Rate',
                  data: [42, 40, 39, 38, 38.6, 37, 36],
                  borderColor: '#f44336',
                  backgroundColor: 'rgba(244, 67, 54, 0.1)'
                }]
              }}
            />
            
            <KPICard 
              title="Inventory Alerts" 
              value={kpiData.inventoryAlerts.length}
            >
              {kpiData.inventoryAlerts.map((alert) => (
                <InventoryAlert 
                  key={alert.id}
                  name={alert.name}
                  inventory={alert.inventory}
                  status={alert.status}
                />
              ))}
            </KPICard>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <StorePerformance data={storePerformance} />
            </div>
            
            <div>
              <TopProducts products={topProducts} />
            </div>
          </div>
          
          <RecentOrders orders={recentOrders} />
        </main>
      </div>
      
      <ConnectStoreModal 
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnect={handleConnectStore}
      />
    </div>
  );
}
