import { format, subDays, differenceInDays, parseISO } from 'date-fns';
import { storage } from '../storage';
import { KPIData, Order, Product, StoreConnection, TopProduct, RecentOrder } from '@shared/schema';

export async function calculateDailyRevenue(
  storeConnectionId: number, 
  date: Date = new Date()
): Promise<number> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const orders = await storage.getOrdersByStoreConnection(storeConnectionId);
  
  const dailyOrders = orders.filter(order => {
    const orderDate = new Date(order.orderDate);
    return orderDate >= startOfDay && orderDate <= endOfDay;
  });
  
  return dailyOrders.reduce((sum, order) => sum + order.totalAmount, 0);
}

export async function calculateTotalOrders(
  storeConnectionId: number,
  startDate: Date,
  endDate: Date = new Date()
): Promise<number> {
  const orders = await storage.getOrdersByStoreConnection(storeConnectionId);
  
  return orders.filter(order => {
    const orderDate = new Date(order.orderDate);
    return orderDate >= startDate && orderDate <= endDate;
  }).length;
}

export async function calculateRepeatBuyerRate(storeConnectionId: number): Promise<number> {
  const orders = await storage.getOrdersByStoreConnection(storeConnectionId);
  
  // Get unique customer IDs
  const customerIds = [...new Set(orders.map(order => order.customerId))];
  
  // Count customers with more than one order
  let repeatCustomers = 0;
  for (const customerId of customerIds) {
    const customerOrderCount = await storage.countOrdersByCustomerId(storeConnectionId, customerId);
    if (customerOrderCount > 1) {
      repeatCustomers++;
    }
  }
  
  return customerIds.length > 0 
    ? (repeatCustomers / customerIds.length) * 100 
    : 0;
}

export async function getInventoryAlerts(storeConnectionId: number): Promise<Product[]> {
  return storage.getLowStockProducts(storeConnectionId);
}

export async function getKPIData(storeConnectionId: number): Promise<KPIData> {
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  
  const dailyRevenue = await calculateDailyRevenue(storeConnectionId);
  const totalOrders = await calculateTotalOrders(storeConnectionId, sevenDaysAgo);
  const repeatBuyerRate = await calculateRepeatBuyerRate(storeConnectionId);
  const lowStockProducts = await getInventoryAlerts(storeConnectionId);
  
  const inventoryAlerts = lowStockProducts.map(product => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    inventory: product.inventory,
    lowStockThreshold: product.lowStockThreshold,
    status: product.inventory <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'
  }));
  
  return {
    dailyRevenue,
    totalOrders,
    repeatBuyerRate,
    inventoryAlerts
  };
}

export async function getStorePerformance(
  storeConnectionIds: number[],
  days: number = 7
): Promise<{ labels: string[], datasets: { label: string, data: number[] }[] }> {
  const now = new Date();
  const labels: string[] = [];
  const datasets: { label: string, data: number[] }[] = [];
  
  // Generate date labels for the last 'days' days
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(now, i);
    labels.push(format(date, 'MMM dd'));
  }
  
  // Get data for each store connection
  for (const connectionId of storeConnectionIds) {
    const connection = await storage.getStoreConnection(connectionId);
    if (!connection) continue;
    
    const data: number[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(now, i);
      const revenue = await calculateDailyRevenue(connectionId, date);
      data.push(revenue);
    }
    
    datasets.push({
      label: connection.name,
      data
    });
  }
  
  return { labels, datasets };
}

export async function getTopProducts(
  storeConnectionId: number,
  limit: number = 5
): Promise<TopProduct[]> {
  const orders = await storage.getOrdersByStoreConnection(storeConnectionId);
  const products = await storage.getProductsByStoreConnection(storeConnectionId);
  
  // This is a simplified implementation since we don't have order items in our schema
  // In a real application, you would calculate this from order line items
  const sortedProducts = [...products]
    .sort((a, b) => (b.price || 0) - (a.price || 0))
    .slice(0, limit);
  
  return sortedProducts.map((product, index) => ({
    id: product.id,
    name: product.name,
    orders: Math.floor(Math.random() * 100) + 50, // Mock data
    revenue: (product.price || 0) * (Math.floor(Math.random() * 100) + 50),
    currency: product.currency || 'USD'
  }));
}

export async function getRecentOrders(
  storeConnectionId: number,
  limit: number = 5
): Promise<RecentOrder[]> {
  const orders = await storage.getRecentOrders(storeConnectionId, limit);
  const connection = await storage.getStoreConnection(storeConnectionId);
  
  if (!connection) {
    throw new Error(`Store connection not found: ${storeConnectionId}`);
  }
  
  return orders.map(order => {
    // Generate initials from the order ID for demo
    const initials = (order.orderNumber || order.orderId)
      .replace(/[^A-Z]/gi, '')
      .substring(0, 2)
      .toUpperCase();
      
    // Map order status to our standardized statuses
    let status: 'COMPLETED' | 'PROCESSING' | 'REFUNDED' | 'CANCELLED';
    
    switch(order.status.toLowerCase()) {
      case 'completed':
      case 'paid':
      case 'success':
        status = 'COMPLETED';
        break;
      case 'processing':
      case 'pending':
        status = 'PROCESSING';
        break;
      case 'refunded':
        status = 'REFUNDED';
        break;
      default:
        status = 'CANCELLED';
    }
    
    return {
      id: order.id,
      orderId: order.orderId,
      orderNumber: order.orderNumber || `ORD-${order.id}`,
      customer: {
        id: order.customerId,
        name: `Customer ${order.customerId.substring(0, 8)}`,
        initials
      },
      date: format(new Date(order.orderDate), 'MMM dd, yyyy'),
      amount: order.totalAmount,
      currency: order.currency,
      status,
      storePlatform: connection.platform.toUpperCase() as 'SHOPIFY' | 'MAGENTO'
    };
  });
}
