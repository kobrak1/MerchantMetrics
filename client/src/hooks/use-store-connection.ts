import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { StoreConnection } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export function useStoreConnections() {
  const [isLoading, setIsLoading] = useState(true);
  const [storeConnections, setStoreConnections] = useState<StoreConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<number | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Fetch the user's store connections from the API
  const { data: connectionsData, isLoading: isConnectionsLoading } = useQuery({
    queryKey: ['/api/store-connections'],
    queryFn: async () => {
      if (!user) return { connections: [] };
      
      try {
        const res = await apiRequest('GET', '/api/store-connections');
        return await res.json();
      } catch (error) {
        console.error('Failed to fetch store connections:', error);
        return { connections: [] };
      }
    },
    enabled: !!user,
    staleTime: 60000 // 1 minute
  });
  
  useEffect(() => {
    if (connectionsData && connectionsData.connections) {
      console.log('Store connections loaded:', connectionsData.connections);
      setStoreConnections(connectionsData.connections);
      // Set the first active connection as the default
      const activeConnection = connectionsData.connections.find((conn: StoreConnection) => conn.isActive);
      if (activeConnection) {
        console.log('Setting active connection ID to active connection:', activeConnection.id);
        setActiveConnectionId(activeConnection.id);
      } else if (connectionsData.connections.length > 0) {
        console.log('Setting active connection ID to first connection:', connectionsData.connections[0].id);
        setActiveConnectionId(connectionsData.connections[0].id);
      }
      setIsLoading(false);
    }
  }, [connectionsData]);
  
  const getActiveConnection = () => {
    if (!activeConnectionId) return null;
    return storeConnections.find(conn => conn.id === activeConnectionId) || null;
  };
  
  const connectWithOAuth = async (platform: string, shop: string) => {
    try {
      // For Shopify OAuth, we need to redirect the browser directly instead of using fetch
      if (platform === 'shopify') {
        // Create the redirect URL directly
        window.location.href = `/api/shopify/oauth/begin?shop=${encodeURIComponent(shop)}`;
        // This will return but the page will be redirecting
        return { success: true };
      } else {
        // For other platforms, use the original approach
        const response = await apiRequest('GET', `/api/${platform}/oauth/begin?shop=${shop}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to start OAuth flow');
        }
        
        const result = await response.json();
        
        if (result.success && result.url) {
          // Redirect the user to the OAuth page
          window.location.href = result.url;
          return { success: true };
        } else {
          throw new Error(result.message || 'Failed to start OAuth flow');
        }
      }
    } catch (error: any) {
      console.error('Failed to start OAuth flow:', error);
      
      toast({
        title: "OAuth Failed",
        description: error.message || "Could not start authorization process.",
        variant: "destructive"
      });
      
      return { success: false, error };
    }
  };
  
  const addStoreConnection = async (connectionData: {
    name: string;
    platform: string;
    storeUrl: string;
    apiKey: string;
    apiSecret: string;
  }) => {
    try {
      const response = await apiRequest('POST', '/api/store-connections', connectionData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to connect store');
      }
      
      const result = await response.json();
      
      if (result.success && result.connection) {
        // Add the new connection to the state
        const newConnection = result.connection;
        setStoreConnections(prev => [...prev, newConnection]);
        
        // If this is the first connection, make it active
        if (!activeConnectionId) {
          setActiveConnectionId(newConnection.id);
        }
        
        // Invalidate the store connections query to refetch
        queryClient.invalidateQueries({ queryKey: ['/api/store-connections'] });
        
        toast({
          title: "Success",
          description: `Successfully connected ${connectionData.name}.`,
        });
        
        return { success: true, data: newConnection };
      } else {
        throw new Error(result.message || 'Failed to connect store');
      }
    } catch (error: any) {
      console.error('Failed to add store connection:', error);
      
      toast({
        title: "Connection Failed",
        description: error.message || "Could not connect to store. Please check your credentials.",
        variant: "destructive"
      });
      
      return { success: false, error };
    }
  };
  
  const removeStoreConnection = async (connectionId: number) => {
    try {
      // First, ensure we're not trying to remove the active connection
      if (connectionId === activeConnectionId) {
        // Find another connection to make active
        const otherConnection = storeConnections.find(conn => conn.id !== connectionId);
        if (otherConnection) {
          setActiveConnectionId(otherConnection.id);
        } else {
          setActiveConnectionId(null);
        }
      }
      
      const response = await apiRequest('DELETE', `/api/store-connections/${connectionId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to remove store');
      }
      
      // Remove the connection from local state
      setStoreConnections(prev => prev.filter(conn => conn.id !== connectionId));
      
      // Invalidate the store connections query to refetch
      queryClient.invalidateQueries({ queryKey: ['/api/store-connections'] });
      
      toast({
        title: "Store Removed",
        description: "The store has been successfully disconnected.",
      });
      
      return { success: true };
      
    } catch (error: any) {
      console.error('Failed to remove store connection:', error);
      
      toast({
        title: "Removal Failed",
        description: error.message || "Could not remove store connection.",
        variant: "destructive"
      });
      
      return { success: false, error };
    }
  };
  
  // Check if we have an OAuth callback in the URL
  useEffect(() => {
    // This should run once on component mount
    const urlParams = new URLSearchParams(window.location.search);
    const shop = urlParams.get('shop');
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    // If we have OAuth callback parameters and we're on the callback route
    if (shop && code && state && window.location.pathname.includes('/callback')) {
      // OAuth callback has been processed by the server, we can redirect back to the dashboard
      // The server should have already created the store connection
      toast({
        title: "Store Connected",
        description: `Successfully connected to ${shop}`,
      });
      
      // Remove the query parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Refresh the connections data
      queryClient.invalidateQueries({ queryKey: ['/api/store-connections'] });
    }
  }, [toast]);
  
  return {
    isLoading: isLoading || isConnectionsLoading,
    storeConnections,
    activeConnectionId,
    setActiveConnectionId,
    getActiveConnection,
    addStoreConnection,
    connectWithOAuth,
    removeStoreConnection
  };
}
