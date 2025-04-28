import { format } from "date-fns";
import {
  InsertOrder,
  InsertProduct,
  Order,
  Product,
  StoreConnection,
} from "@shared/schema";

interface ShopifyOrder {
  id: string;
  order_number: string;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  financial_status: string;
  created_at: string;
  total_price: string;
  currency: string;
  line_items: Array<{
    id: string;
    product_id: string;
    title: string;
    quantity: number;
    price: string;
  }>;
}

interface ShopifyProduct {
  id: string;
  title: string;
  variants: Array<{
    id: string;
    sku: string;
    price: string;
    inventory_quantity: number;
    inventory_management: string | null;
  }>;
}

async function makeShopifyRequest<T>(
  storeConnection: StoreConnection,
  endpoint: string,
): Promise<T> {
  const { storeUrl, apiKey, apiSecret: accessToken } = storeConnection;
  // Ensure storeUrl doesn't already contain the protocol and remove any trailing slashes
  const cleanStoreUrl = storeUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const url = `https://${cleanStoreUrl}/admin/api/2025-01/${endpoint}`;

  console.log(`Making Shopify request to: ${url}`);

  const response = await fetch(url, {
    headers: {
      // Using the access token stored in apiSecret field for authentication
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Shopify API error: ${response.status} ${response.statusText}`,
    );
  }

  return await response.json();
}

export async function fetchShopifyOrders(
  storeConnection: StoreConnection,
  since?: Date,
): Promise<InsertOrder[]> {
  const sinceParam = since
    ? `&created_at_min=${format(since, "yyyy-MM-dd")}`
    : "";
  const data = await makeShopifyRequest<{ orders: ShopifyOrder[] }>(
    storeConnection,
    `orders.json?status=any${sinceParam}`,
  );

  return data.orders.map((order) => ({
    storeConnectionId: storeConnection.id,
    orderId: order.id,
    customerId: order.customer.id,
    orderNumber: order.order_number,
    totalAmount: parseFloat(order.total_price),
    currency: order.currency,
    status: order.financial_status,
    orderDate: new Date(order.created_at),
  }));
}

export async function fetchShopifyProducts(
  storeConnection: StoreConnection,
): Promise<InsertProduct[]> {
  const data = await makeShopifyRequest<{ products: ShopifyProduct[] }>(
    storeConnection,
    "products.json",
  );

  const products: InsertProduct[] = [];

  for (const product of data.products) {
    // For simplicity, we'll use the first variant's information
    const mainVariant = product.variants[0];

    products.push({
      storeConnectionId: storeConnection.id,
      productId: product.id,
      name: product.title,
      sku: mainVariant?.sku || "",
      price: mainVariant ? parseFloat(mainVariant.price) : null,
      currency: "USD", // Shopify doesn't always include currency at product level
      inventory:
        mainVariant?.inventory_management === "shopify"
          ? mainVariant.inventory_quantity
          : null,
      lowStockThreshold: 10, // Default threshold
    });
  }

  return products;
}

export async function testShopifyConnection(
  storeUrl: string,
  apiKey: string,
  accessToken: string, // This is actually the Admin API access token, not API secret
): Promise<boolean> {
  try {
    // Ensure storeUrl doesn't already contain the protocol and remove any trailing slashes
    const cleanStoreUrl = storeUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    
    // Use the latest API version from the documentation (2025-01)
    const url = `https://${cleanStoreUrl}/admin/api/2025-01/graphql.json`;
    
    console.log(`Testing Shopify connection with URL: ${url}`);
    
    // Simple query to get shop information
    const query = {
      query: `{
        shop {
          name
        }
      }`
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        // Using the access token for authentication with Shopify Admin API
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(query)
    });
    
    if (!response.ok) {
      console.error(`Shopify API responded with status: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Response: ${errorText}`);
    } else {
      const data = await response.json();
      console.log('Shopify connection successful:', data);
    }
    
    return response.ok;
  } catch (error) {
    console.error("Shopify connection test failed:", error);
    return false;
  }
}
