import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TopProduct } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

interface TopProductsProps {
  products: TopProduct[];
  isLoading?: boolean;
}

export default function TopProducts({ products, isLoading = false }: TopProductsProps) {
  return (
    <Card className="bg-white rounded-lg shadow-sm border border-neutral-200 h-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">Top Products</h4>
          <Button variant="link" className="text-primary text-sm">View All</Button>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-[240px]">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="flex items-center justify-center h-[240px]">
            <p className="text-neutral-400">No products data available</p>
          </div>
        ) : (
          products.map((product, index) => (
            <div key={product.id} className={`flex items-center justify-between py-2 ${
              index < products.length - 1 ? 'border-b border-neutral-100' : ''
            }`}>
              <div className="flex items-center">
                <div className="h-8 w-8 bg-neutral-100 rounded-md mr-2 flex items-center justify-center text-xs text-neutral-500">
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-neutral-400">{product.orders} orders</p>
                </div>
              </div>
              <span className="text-sm font-medium">
                {formatCurrency(product.revenue, product.currency)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
