import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { X } from "lucide-react";
import { SiShopify, SiMagento } from "react-icons/si";

interface ConnectStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (data: {
    name: string;
    platform: string;
    storeUrl: string;
    apiKey: string;
    apiSecret: string;
  }) => Promise<{ success: boolean; error?: any }>;
}

export default function ConnectStoreModal({ 
  isOpen, 
  onClose,
  onConnect 
}: ConnectStoreModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<"shopify" | "magento" | null>("shopify");
  const [name, setName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async () => {
    if (!selectedPlatform || !name || !storeUrl || !apiKey || !apiSecret) {
      setError("Please fill all fields");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await onConnect({
        name,
        platform: selectedPlatform,
        storeUrl,
        apiKey,
        apiSecret
      });
      
      if (result.success) {
        // Reset and close on success
        resetForm();
        onClose();
      } else {
        setError("Failed to connect to store. Please check your credentials.");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetForm = () => {
    setSelectedPlatform("shopify");
    setName("");
    setStoreUrl("");
    setApiKey("");
    setApiSecret("");
    setError(null);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Connect New Store</DialogTitle>
        </DialogHeader>
        
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button
              type="button"
              variant="outline"
              className={`flex-1 flex flex-col items-center py-3 px-2 h-auto ${
                selectedPlatform === "shopify" ? "border-primary bg-primary/10 text-primary" : ""
              }`}
              onClick={() => setSelectedPlatform("shopify")}
            >
              <SiShopify className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Shopify</span>
            </Button>
            
            <Button
              type="button"
              variant="outline"
              className={`flex-1 flex flex-col items-center py-3 px-2 h-auto ${
                selectedPlatform === "magento" ? "border-primary bg-primary/10 text-primary" : ""
              }`}
              onClick={() => setSelectedPlatform("magento")}
            >
              <SiMagento className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Magento</span>
            </Button>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="storeName">Store Name</Label>
              <Input
                id="storeName"
                placeholder="My Store"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="storeUrl">Store URL</Label>
              <Input
                id="storeUrl"
                placeholder={selectedPlatform === "shopify" ? "your-store.myshopify.com" : "store.example.com"}
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="apiSecret">API Secret</Label>
              <Input
                id="apiSecret"
                type="password"
                placeholder="Enter your API secret"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
              />
            </div>
            
            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Connecting..." : "Connect Store"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
