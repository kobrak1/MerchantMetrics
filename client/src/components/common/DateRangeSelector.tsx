import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Popover, 
  PopoverTrigger, 
  PopoverContent
} from "@/components/ui/popover";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, differenceInDays, addMonths, isBefore, isAfter } from "date-fns";
import { CalendarIcon, AlertCircle } from "lucide-react";

interface DateRangeProps {
  onChange: (dates: { 
    startDate: Date; 
    endDate: Date; 
    rangeName: string;
  }) => void;
  maxCustomDays?: number;
}

export function DateRangeSelector({ onChange, maxCustomDays = 90 }: DateRangeProps) {
  // Pre-defined ranges
  const [selectedRange, setSelectedRange] = useState<string>("7days");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [isCustomDateOpen, setIsCustomDateOpen] = useState<boolean>(false);
  const [isSubscriptionRequired, setIsSubscriptionRequired] = useState<boolean>(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  
  const ranges = {
    "7days": { label: "Last 7 days", days: 7 },
    "30days": { label: "Last 30 days", days: 30 },
    "90days": { label: "Last 90 days", days: 90 },
    "custom": { label: "Custom Range", days: 0 },
  };

  useEffect(() => {
    // Apply default range on mount
    applyPredefinedRange("7days");
  }, []);

  useEffect(() => {
    // Check if both dates are selected for custom range
    if (selectedRange === "custom" && customStartDate && customEndDate) {
      // Check max range limit (90 days)
      const dayDifference = differenceInDays(customEndDate, customStartDate);
      
      if (dayDifference > maxCustomDays) {
        toast({
          title: "Date range too large",
          description: `Please select a range of ${maxCustomDays} days or less.`,
          variant: "destructive"
        });
        return;
      }
      
      // Check if user is in trial period and trying to access more than 14 days
      if (isSubscriptionRequired && dayDifference > 14) {
        toast({
          title: "Subscription Required",
          description: "Please subscribe to access data older than 14 days.",
          variant: "destructive",
        });
        return;
      }
      
      // Valid date range, apply it
      onChange({
        startDate: customStartDate,
        endDate: customEndDate,
        rangeName: "custom"
      });
    }
  }, [customStartDate, customEndDate, maxCustomDays, selectedRange, isSubscriptionRequired]);

  const applyPredefinedRange = (rangeName: string) => {
    if (rangeName === "custom") {
      setSelectedRange("custom");
      return;
    }
    
    const range = ranges[rangeName as keyof typeof ranges];
    if (!range) return;
    
    const endDate = new Date();
    const startDate = subDays(endDate, range.days);
    
    // Check if user is in trial and trying to access more than 14 days of data
    if (isSubscriptionRequired && range.days > 14) {
      toast({
        title: "Subscription Required",
        description: "Please subscribe to access data older than 14 days.",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedRange(rangeName);
    
    // Notify parent about range change
    onChange({
      startDate,
      endDate,
      rangeName
    });
  };

  const handleCustomDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    if (!customStartDate || (customStartDate && customEndDate)) {
      // Start new selection
      setCustomStartDate(date);
      setCustomEndDate(undefined);
    } else {
      // Complete the selection
      if (isBefore(date, customStartDate)) {
        setCustomEndDate(customStartDate);
        setCustomStartDate(date);
      } else {
        setCustomEndDate(date);
      }
    }
  };

  // Get max date for custom selection (3 months)
  const getMaxCustomDate = () => {
    if (!customStartDate) return undefined;
    return addMonths(customStartDate, 3); 
  };
  
  // Check if trial has expired or not
  useEffect(() => {
    // Call API to get subscription status
    const checkSubscriptionStatus = async () => {
      try {
        const res = await fetch("/api/user-subscription");
        if (res.ok) {
          const data = await res.json();
          
          // Determine if this is a trial or if trial has expired
          if (data.subscription) {
            const isTrialExpired = data.subscription.isTrial && 
              new Date(data.subscription.endDate) < new Date();
            
            // If trial has expired and no active paid subscription
            setIsSubscriptionRequired(isTrialExpired);
          }
        }
      } catch (error) {
        console.error("Failed to check subscription status:", error);
      }
    };
    
    if (user) {
      checkSubscriptionStatus();
    }
  }, [user]);

  return (
    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
      <Select value={selectedRange} onValueChange={applyPredefinedRange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select time range" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ranges).map(([key, range]) => (
            <SelectItem key={key} value={key}>
              {range.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedRange === "custom" && (
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <Popover open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !customStartDate && !customEndDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customStartDate && customEndDate ? (
                  <>
                    {format(customStartDate, "LLL dd, y")} - {format(customEndDate, "LLL dd, y")}
                  </>
                ) : (
                  <span>Select date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="single"
                selected={customEndDate || customStartDate}
                onSelect={handleCustomDateSelect}
                disabled={(date) => {
                  // Cannot select future dates
                  if (isAfter(date, new Date())) return true;
                  
                  // If we're selecting the end date, limit to 3 months from start
                  if (customStartDate && !customEndDate) {
                    const maxDate = getMaxCustomDate();
                    if (maxDate && isAfter(date, maxDate)) return true;
                  }
                  
                  return false;
                }}
              />
              
              {customStartDate && !customEndDate && (
                <div className="px-4 pb-3 pt-0 text-sm text-blue-600">
                  <p className="flex items-center">
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Now select the end date
                  </p>
                </div>
              )}
              
              {isSubscriptionRequired && (
                <div className="px-4 pb-3 pt-0 text-sm text-amber-600">
                  <p className="flex items-center">
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Free trial allows only 14 days of data
                  </p>
                </div>
              )}
            </PopoverContent>
          </Popover>
          
          {customStartDate && customEndDate && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setCustomStartDate(undefined);
                setCustomEndDate(undefined);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}