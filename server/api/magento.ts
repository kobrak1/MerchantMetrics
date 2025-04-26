import { format } from 'date-fns';
import { 
  InsertOrder, 
  InsertProduct, 
  StoreConnection 
} from '@shared/schema';

interface MagentoOrder {
  entity_id: string;
  increment_id: string;
  customer_id: string;
  grand_total: number;
  order_currency_code: string;
  status: string;
  created_at: string;
}

interface MagentoProduct {
  entity_id: string;
  sku: string;
  name: string;
  price: number;
  qty: number;
}

async function makeMagentoRequest<T>(
  storeConnection: StoreConnection,
  endpoint: string
): Promise<T> {
  const { storeUrl, apiKey } = storeConnection;
  const url = `https://${storeUrl}/rest/V1/${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Magento API error: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

export async function fetchMagentoOrders(
  storeConnection: StoreConnection, 
  since?: Date
): Promise<InsertOrder[]> {
  // Construct search criteria
  let searchCriteria = '';
  if (since) {
    const formattedDate = format(since, 'yyyy-MM-dd');
    searchCriteria = `searchCriteria[filter_groups][0][filters][0][field]=created_at&searchCriteria[filter_groups][0][filters][0][value]=${formattedDate}&searchCriteria[filter_groups][0][filters][0][condition_type]=gt`;
  }
  
  const endpoint = `orders?${searchCriteria}`;
  const data = await makeMagentoRequest<{ items: MagentoOrder[] }>(
    storeConnection,
    endpoint
  );
  
  return data.items.map(order => ({
    storeConnectionId: storeConnection.id,
    orderId: order.entity_id,
    customerId: order.customer_id,
    orderNumber: order.increment_id,
    totalAmount: order.grand_total,
    currency: order.order_currency_code,
    status: order.status,
    orderDate: new Date(order.created_at)
  }));
}

export async function fetchMagentoProducts(
  storeConnection: StoreConnection
): Promise<InsertProduct[]> {
  const endpoint = 'products?searchCriteria';
  const data = await makeMagentoRequest<{ items: MagentoProduct[] }>(
    storeConnection,
    endpoint
  );
  
  return data.items.map(product => ({
    storeConnectionId: storeConnection.id,
    productId: product.entity_id,
    name: product.name,
    sku: product.sku,
    price: product.price,
    currency: 'USD', // Magento doesn't include currency at product level by default
    inventory: product.qty,
    lowStockThreshold: 10 // Default threshold
  }));
}

export async function testMagentoConnection(
  storeUrl: string,
  apiKey: string
): Promise<boolean> {
  try {
    const url = `https://${storeUrl}/rest/V1/store/storeConfigs`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('Magento connection test failed:', error);
    return false;
  }
}
