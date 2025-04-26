import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { StoreConnection } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { fetchDemoData } from "@/lib/api";

export function useStoreConnections() {
  const [isLoading, setIsLoading] = useState(true);
  const [storeConnections, setStoreConnections] = useState<StoreConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<number | null>(null);
  
  const { data: demoData, isLoading: isDemoLoading } = useQuery({
    queryKey: ['/api/demo-data'],
    staleTime: Infinity
  });
  
  useEffect(() => {
    if (demoData && demoData.storeConnections) {
      setStoreConnections(demoData.storeConnections);
      // Set the first active connection as the default
      const activeConnection = demoData.storeConnections.find((conn: StoreConnection) => conn.isActive);
      if (activeConnection) {
        setActiveConnectionId(activeConnection.id);
      } else if (demoData.storeConnections.length > 0) {
        setActiveConnectionId(demoData.storeConnections[0].id);
      }
      setIsLoading(false);
    }
  }, [demoData]);
  
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
      const userId = demoData?.user?.id || 1;
      const response = await apiRequest('POST', '/api/store-connections', {
        ...connectionData,
        userId
      });
      
      const newConnection = await response.json();
      setStoreConnections(prev => [...prev, newConnection]);
      
      if (!activeConnectionId) {
        setActiveConnectionId(newConnection.id);
      }
      
      return { success: true, data: newConnection };
    } catch (error) {
      console.error('Failed to add store connection:', error);
      return { success: false, error };
    }
  };
  
  return {
    isLoading: isLoading || isDemoLoading,
    storeConnections,
    activeConnectionId,
    setActiveConnectionId,
    getActiveConnection,
    addStoreConnection
  };
}
