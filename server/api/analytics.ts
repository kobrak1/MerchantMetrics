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
  const customerIdSet = new Set(orders.map(order => order.customerId));
  const customerIds = Array.from(customerIdSet);
  
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

export async function getKPIData(storeConnectionId: number, dateFilter: string = 'week'): Promise<KPIData> {
  const now = new Date();
  let startDate: Date;
  
  // Determine the start date based on the filter
  switch (dateFilter) {
    case 'today':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate = subDays(now, 7);
      break;
    case 'month':
      startDate = subDays(now, 30);
      break;
    default:
      startDate = subDays(now, 7); // Default to week
  }
  
  // Calculate daily revenue for the current day regardless of filter
  const dailyRevenue = await calculateDailyRevenue(storeConnectionId);
  
  // Calculate total orders based on the date filter
  const totalOrders = await calculateTotalOrders(storeConnectionId, startDate);
  
  // These values remain the same regardless of filter
  const repeatBuyerRate = await calculateRepeatBuyerRate(storeConnectionId);
  const lowStockProducts = await getInventoryAlerts(storeConnectionId);
  
  const inventoryAlerts = lowStockProducts.map(product => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    // Use default value of 0 if inventory is null
    inventory: product.inventory ?? 0,
    lowStockThreshold: product.lowStockThreshold,
    // Explicitly cast to the correct union type
    status: (product.inventory ?? 0) <= 0 ? 'OUT_OF_STOCK' as const : 'LOW_STOCK' as const
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
  period: string = 'week'
): Promise<{ labels: string[], datasets: { label: string, data: number[] }[] }> {
  const now = new Date();
  let labels: string[] = [];
  const datasets: { label: string, data: number[] }[] = [];
  
  // Determine the period to display
  let days: number;
  let aggregateWeekly = false;
  
  switch (period) {
    case 'today':
      days = 1;
      break;
    case 'week':
      days = 7;
      break;
    case 'month':
      days = 30;
      break;
    case 'quarter':
      days = 90;
      aggregateWeekly = true; // Aggregate data weekly for quarter view
      break;
    default:
      days = 7; // Default to a week
  }

  if (aggregateWeekly) {
    // For quarter view, generate weekly labels (approximately 13 labels)
    const weekCount = Math.ceil(days / 7);
    for (let i = 0; i < weekCount; i++) {
      const startDate = subDays(now, days - (i * 7));
      const endDate = subDays(now, Math.max(days - ((i + 1) * 7) + 1, 0));
      labels.push(format(startDate, 'MMM dd') + ' - ' + format(endDate, 'MMM dd'));
    }
  } else {
    // For other views, generate daily labels
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(now, i);
      
      // Format date labels differently based on the period
      if (days === 1) {
        // For today, show hourly data
        const hour = new Date(now);
        hour.setHours(now.getHours() - i, 0, 0, 0);
        labels.push(format(hour, 'ha')); // Format as 1PM, 2PM, etc.
      } else if (days <= 14) {
        // For short periods (up to 2 weeks), show full date
        labels.push(format(date, 'MMM dd'));
      } else if (days <= 31) {
        // For month view, show every 5 days or only specific days
        // Skip some labels to prevent overcrowding
        if (i % 5 === 0 || i === 0 || i === days - 1) {
          labels.push(format(date, 'MMM dd'));
        } else {
          labels.push(''); // Empty label for days we want to skip
        }
      }
    }
  }
  
  // Get data for each store connection
  for (const connectionId of storeConnectionIds) {
    const connection = await storage.getStoreConnection(connectionId);
    if (!connection) continue;
    
    let data: number[] = [];
    
    if (aggregateWeekly) {
      // For quarter view, aggregate data by week
      const weekCount = Math.ceil(days / 7);
      for (let i = 0; i < weekCount; i++) {
        let weeklyRevenue = 0;
        const weekStart = days - (i * 7);
        const weekEnd = Math.max(days - ((i + 1) * 7) + 1, 0);
        
        // Sum up revenue for each day in the week
        for (let j = weekStart - 1; j >= weekEnd - 1; j--) {
          const date = subDays(now, j);
          const dailyRevenue = await calculateDailyRevenue(connectionId, date);
          weeklyRevenue += dailyRevenue;
        }
        
        data.push(weeklyRevenue);
      }
    } else {
      // For daily views, get data for each day
      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(now, i);
        const revenue = await calculateDailyRevenue(connectionId, date);
        data.push(revenue);
      }
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
