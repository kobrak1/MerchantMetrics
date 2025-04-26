import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecentOrder } from "@shared/schema";
import { useState } from "react";

interface RecentOrdersProps {
  orders: RecentOrder[];
  isLoading?: boolean;
  totalOrdersCount?: number;
}

export default function RecentOrders({ 
  orders, 
  isLoading = false,
  totalOrdersCount = 248
}: RecentOrdersProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  const getStatusVariant = (status: string): "success" | "warning" | "error" => {
    switch (status) {
      case "COMPLETED": return "success";
      case "PROCESSING": return "warning";
      case "REFUNDED": 
      case "CANCELLED": return "error";
      default: return "warning";
    }
  };
  
  const filteredOrders = searchTerm 
    ? orders.filter(order => 
        order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : orders;
  
  return (
    <Card className="mt-6 bg-white rounded-lg shadow-sm border border-neutral-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">Recent Orders</h4>
          <div className="flex items-center">
            <div className="relative mr-2">
              <SearchIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input 
                className="pl-8 pr-2 py-1 h-8 text-sm" 
                placeholder="Search orders"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="link" className="text-primary text-sm">View All</Button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-neutral-100 text-neutral-500 text-sm uppercase">
                <th className="px-4 py-2 text-left font-medium">Order ID</th>
                <th className="px-4 py-2 text-left font-medium">Customer</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Amount</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Store</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center">Loading orders...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center">No orders found</td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-neutral-100">
                    <td className="px-4 py-3 text-primary font-medium">#{order.orderNumber}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <Avatar className="h-7 w-7 mr-2">
                          <AvatarFallback className="bg-neutral-200 text-xs">
                            {order.customer.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span>{order.customer.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{order.date}</td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(order.amount, order.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(order.status)}>
                        {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {order.storePlatform.charAt(0) + order.storePlatform.slice(1).toLowerCase()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            Showing {Math.min(orders.length, 5)} of {totalOrdersCount} orders
          </p>
          <div className="flex items-center">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8 p-0 mr-2"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            
            <Button 
              variant={currentPage === 1 ? "default" : "outline"} 
              className="w-8 h-8 p-0"
              onClick={() => setCurrentPage(1)}
            >
              1
            </Button>
            
            <Button 
              variant={currentPage === 2 ? "default" : "outline"} 
              className="w-8 h-8 p-0 mx-1"
              onClick={() => setCurrentPage(2)}
            >
              2
            </Button>
            
            <Button 
              variant={currentPage === 3 ? "default" : "outline"} 
              className="w-8 h-8 p-0"
              onClick={() => setCurrentPage(3)}
            >
              3
            </Button>
            
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8 p-0 ml-2"
              disabled={currentPage === 3}
              onClick={() => setCurrentPage(p => Math.min(p + 1, 3))}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
