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
      setStoreConnections(connectionsData.connections);
      // Set the first active connection as the default
      const activeConnection = connectionsData.connections.find((conn: StoreConnection) => conn.isActive);
      if (activeConnection) {
        setActiveConnectionId(activeConnection.id);
      } else if (connectionsData.connections.length > 0) {
        setActiveConnectionId(connectionsData.connections[0].id);
      }
      setIsLoading(false);
    }
  }, [connectionsData]);
  
  const getActiveConnection = () => {
    if (!activeConnectionId) return null;
    return storeConnections.find(conn => conn.id === activeConnectionId) || null;
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
  
  return {
    isLoading: isLoading || isConnectionsLoading,
    storeConnections,
    activeConnectionId,
    setActiveConnectionId,
    getActiveConnection,
    addStoreConnection,
    removeStoreConnection
  };
}
