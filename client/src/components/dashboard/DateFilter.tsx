import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { useState, useEffect } from "react";

interface DateFilterProps {
  onFilterChange: (filter: string) => void;
  defaultFilter?: string;
}

export default function DateFilter({
  onFilterChange,
  defaultFilter = "week",
}: DateFilterProps) {
  const [activeFilter, setActiveFilter] = useState(defaultFilter);

  // Apply default filter on initial render
  useEffect(() => {
    onFilterChange(activeFilter);
  }, []);

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    onFilterChange(filter);
  };

  return (
    <div className="mb-4 flex justify-between items-center">
      <h3 className="text-xl font-medium">Analytics Overview</h3>

      <div className="flex items-center bg-white border border-neutral-200 dark:border-gray-400 rounded-lg shadow-sm">
        <Button
          variant="ghost"
          className={`px-3 py-1.5 text-sm font-medium rounded-none ${
            activeFilter === "today"
              ? "text-primary border-b-2 border-primary"
              : "text-neutral-500"
          }`}
          onClick={() => handleFilterChange("today")}
        >
          Today
        </Button>

        <Button
          variant="ghost"
          className={`px-3 py-1.5 text-sm font-medium rounded-none ${
            activeFilter === "week"
              ? "text-primary border-b-2 border-primary"
              : "text-neutral-500"
          }`}
          onClick={() => handleFilterChange("week")}
        >
          Week
        </Button>

        <Button
          variant="ghost"
          className={`px-3 py-1.5 text-sm font-medium rounded-none ${
            activeFilter === "month"
              ? "text-primary border-b-2 border-primary"
              : "text-neutral-500"
          }`}
          onClick={() => handleFilterChange("month")}
        >
          Month
        </Button>

        <Button
          variant="ghost"
          className={`px-3 py-1.5 text-sm flex items-center rounded-none ${
            activeFilter === "custom"
              ? "text-primary border-b-2 border-primary"
              : "text-neutral-500"
          }`}
          onClick={() => handleFilterChange("custom")}
        >
          Last 3 Months
        </Button>
      </div>
    </div>
  );
}
