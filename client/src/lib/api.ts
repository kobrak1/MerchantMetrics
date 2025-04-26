import { apiRequest } from "./queryClient";
import { 
  KPIData, 
  StorePerformance, 
  TopProduct, 
  RecentOrder,
  StoreConnection
} from "@shared/schema";

// Using the /api/demo-data endpoint for development
export async function fetchDemoData() {
  const response = await apiRequest('GET', '/api/demo-data');
  return response.json();
}

export async function fetchKPIData(storeConnectionId: number): Promise<KPIData> {
  const response = await apiRequest('GET', `/api/analytics/kpi?storeConnectionId=${storeConnectionId}`);
  return response.json();
}

export async function fetchStorePerformance(
  storeConnectionIds: number[],
  days: number = 7
): Promise<StorePerformance> {
  const response = await apiRequest(
    'GET', 
    `/api/analytics/store-performance?storeConnectionIds=${storeConnectionIds.join(',')}&days=${days}`
  );
  return response.json();
}

export async function fetchTopProducts(
  storeConnectionId: number,
  limit: number = 5
): Promise<TopProduct[]> {
  const response = await apiRequest(
    'GET',
    `/api/analytics/top-products?storeConnectionId=${storeConnectionId}&limit=${limit}`
  );
  return response.json();
}

export async function fetchRecentOrders(
  storeConnectionId: number,
  limit: number = 5
): Promise<RecentOrder[]> {
  const response = await apiRequest(
    'GET',
    `/api/analytics/recent-orders?storeConnectionId=${storeConnectionId}&limit=${limit}`
  );
  return response.json();
}

export async function fetchStoreConnections(userId: number): Promise<StoreConnection[]> {
  const response = await apiRequest('GET', `/api/store-connections?userId=${userId}`);
  return response.json();
}

export async function createStoreConnection(data: {
  userId: number;
  name: string;
  platform: string;
  storeUrl: string;
  apiKey: string;
  apiSecret: string;
}): Promise<StoreConnection> {
  const response = await apiRequest('POST', '/api/store-connections', data);
  return response.json();
}

export async function fetchUserSubscription(userId: number) {
  const response = await apiRequest('GET', `/api/user-subscription?userId=${userId}`);
  return response.json();
}

export async function fetchSubscriptionTiers() {
  const response = await apiRequest('GET', '/api/subscription-tiers');
  return response.json();
}
