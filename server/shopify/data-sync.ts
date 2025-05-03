import { storage } from '../storage';
import { InsertOrder, InsertProduct } from '@shared/schema';

/**
 * Synchronize data from a Shopify store after initial connection
 * This performs a one-time sync of historical data
 */
export async function syncShopifyData(
  shopDomain: string, 
  accessToken: string, 
  storeConnectionId: number
): Promise<{
  orders: number;
  products: number;
}> {
  console.log(`Starting initial data sync for ${shopDomain} (connection ID: ${storeConnectionId})`);
  
  try {
    // Track stats for reporting
    const stats = {
      orders: 0,
      products: 0
    };
    
    // Fetch and sync products
    await syncProducts(shopDomain, accessToken, storeConnectionId, stats);
    
    // Fetch and sync orders
    await syncOrders(shopDomain, accessToken, storeConnectionId, stats);
    
    // Update connection status
    await storage.updateStoreConnection(storeConnectionId, {
      lastSyncAt: new Date(),
      totalOrdersProcessed: stats.orders
    });
    
    console.log(`Completed initial sync for ${shopDomain}: ${stats.orders} orders, ${stats.products} products`);
    return stats;
  } catch (error) {
    console.error(`Error during initial sync for ${shopDomain}:`, error);
    throw error;
  }
}

/**
 * Sync products from Shopify to our database
 */
async function syncProducts(
  shopDomain: string, 
  accessToken: string, 
  storeConnectionId: number,
  stats: { products: number }
): Promise<void> {
  try {
    console.log(`Fetching products for ${shopDomain}`);
    
    // Use GraphQL to get products
    const query = `{
      products(first: 50) {
        edges {
          node {
            id
            title
            createdAt
            updatedAt
            variants(first: 1) {
              edges {
                node {
                  id
                  price
                  sku
                  inventoryQuantity
                }
              }
            }
          }
        }
      }
    }`;
    
    const response = await fetch(`https://${shopDomain}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch products from Shopify: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    
    if (!data.data?.products?.edges) {
      console.error('Unexpected response format from Shopify Products API');
      return;
    }
    
    // Process products and save to database
    for (const edge of data.data.products.edges) {
      const product = edge.node;
      const variant = product.variants.edges[0]?.node;
      
      if (!variant) {
        console.log(`Skipping product ${product.id} with no variants`);
        continue;
      }
      
      const productId = product.id.replace('gid://shopify/Product/', '');
      
      // Prepare product data
      const productData: InsertProduct = {
        storeConnectionId,
        name: product.title,
        productId,
        price: parseFloat(variant.price),
        sku: variant.sku || null,
        inventory: variant.inventoryQuantity ?? null,
        lowStockThreshold: 10, // Default value
        currency: 'USD', // Default currency (can be improved by fetching shop settings)
      };
      
      // Save to database
      await storage.createProduct(productData);
      stats.products++;
    }
    
    console.log(`Synced ${stats.products} products from ${shopDomain}`);
  } catch (error) {
    console.error('Error syncing products:', error);
  }
}

/**
 * Sync orders from Shopify to our database
 */
async function syncOrders(
  shopDomain: string, 
  accessToken: string, 
  storeConnectionId: number,
  stats: { orders: number }
): Promise<void> {
  try {
    console.log(`Fetching orders for ${shopDomain}`);
    
    // Use GraphQL to get orders
    const query = `{
      orders(first: 50) {
        edges {
          node {
            id
            name
            createdAt
            displayFinancialStatus
            customer {
              id
            }
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }`;
    
    const response = await fetch(`https://${shopDomain}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch orders from Shopify: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    
    if (!data.data?.orders?.edges) {
      console.error('Unexpected response format from Shopify Orders API');
      return;
    }
    
    // Process orders and save to database
    for (const edge of data.data.orders.edges) {
      const order = edge.node;
      
      const orderId = order.id.replace('gid://shopify/Order/', '');
      const customerId = order.customer?.id?.replace('gid://shopify/Customer/', '') || 'guest';
      
      // Map Shopify financial status to our status
      let status = 'PENDING';
      switch (order.displayFinancialStatus) {
        case 'PAID':
          status = 'COMPLETED';
          break;
        case 'REFUNDED':
          status = 'REFUNDED';
          break;
        case 'PENDING':
          status = 'PROCESSING';
          break;
        default:
          status = 'PENDING';
      }
      
      // Prepare order data
      const orderData: InsertOrder = {
        storeConnectionId,
        orderId,
        orderNumber: order.name,
        customerId,
        status,
        totalAmount: parseFloat(order.totalPriceSet.shopMoney.amount),
        currency: order.totalPriceSet.shopMoney.currencyCode,
        orderDate: new Date(order.createdAt),
      };
      
      // Save to database
      await storage.createOrder(orderData);
      stats.orders++;
    }
    
    console.log(`Synced ${stats.orders} orders from ${shopDomain}`);
  } catch (error) {
    console.error('Error syncing orders:', error);
  }
}