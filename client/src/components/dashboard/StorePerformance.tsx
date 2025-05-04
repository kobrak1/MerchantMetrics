import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

interface StorePerformanceProps {
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
    }[];
  };
  isLoading?: boolean;
  onPeriodChange?: (period: string) => void;
  defaultPeriod?: string;
}

export default function StorePerformance({ 
  data, 
  isLoading = false, 
  onPeriodChange, 
  defaultPeriod = "7days"
}: StorePerformanceProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  
  const handlePeriodChange = (value: string) => {
    if (onPeriodChange) {
      let periodValue = 'week';
      
      switch (value) {
        case '7days':
          periodValue = 'week';
          break;
        case '30days':
          periodValue = 'month';
          break;
        case 'quarter':
          periodValue = 'quarter';
          break;
      }
      
      onPeriodChange(periodValue);
    }
  };
  
  useEffect(() => {
    if (chartRef.current && !isLoading && data) {
      // Destroy existing chart if it exists
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      
      const ctx = chartRef.current.getContext('2d');
      
      if (ctx) {
        // Determine if we're using weekly aggregated data based on label format
        // Weekly labels contain " - " (e.g. "Mar 01 - Mar 07")
        const isWeeklyData = data.labels.some(label => label && label.includes(' - '));
        
        chartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: data.labels,
            datasets: data.datasets.map((dataset, index) => ({
              label: dataset.label,
              data: dataset.data,
              borderColor: index === 0 ? '#3f51b5' : '#f50057',
              backgroundColor: 'transparent',
              borderWidth: 3,
              tension: 0.4,
              pointRadius: isWeeklyData ? 5 : 3, // Larger points for weekly data
              pointHoverRadius: isWeeklyData ? 7 : 5
            }))
          },
          options: {
            plugins: {
              legend: {
                position: 'top'
              },
              tooltip: {
                callbacks: {
                  title: (tooltipItems) => {
                    // Use the label from the data
                    return tooltipItems[0].label;
                  },
                  label: (context) => {
                    // Format the value as currency
                    let value = context.raw as number;
                    return `Revenue: $${value.toFixed(2)}`;
                  }
                }
              }
            },
            scales: {
              x: {
                ticks: {
                  autoSkip: true,
                  maxRotation: 45,
                  minRotation: 45
                }
              },
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Revenue ($)'
                }
              }
            },
            maintainAspectRatio: false
          }
        });
      }
    }
    
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, isLoading]);
  
  return (
    <Card className="bg-white rounded-lg shadow-sm border border-neutral-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">Store Performance</h4>
          <Select 
            defaultValue={defaultPeriod} 
            onValueChange={handlePeriodChange}
          >
            <SelectTrigger className="w-[150px] h-8 text-sm">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="quarter">Last quarter</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="h-64 chart-container">
            <canvas ref={chartRef}></canvas>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
