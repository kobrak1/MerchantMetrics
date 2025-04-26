import { cn } from "@/lib/utils";

interface InventoryAlertProps {
  name: string;
  inventory: number;
  status: 'OUT_OF_STOCK' | 'LOW_STOCK';
}

export default function InventoryAlert({ name, inventory, status }: InventoryAlertProps) {
  const isOutOfStock = status === 'OUT_OF_STOCK';
  
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-neutral-100">
      <div className="flex items-center">
        <div 
          className={cn(
            "h-2 w-2 rounded-full mr-2", 
            isOutOfStock ? "bg-destructive" : "bg-warning"
          )}
        />
        <span className="text-sm">{name}</span>
      </div>
      <span 
        className={cn(
          "text-sm font-medium", 
          isOutOfStock ? "text-destructive" : "text-warning"
        )}
      >
        {isOutOfStock ? "Out of stock" : `${inventory} left`}
      </span>
    </div>
  );
}
