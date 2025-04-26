import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

interface KPICardProps {
  title: string;
  value: string | number;
  percentageChange?: number;
  chartData?: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      borderColor?: string;
      backgroundColor?: string;
    }[];
  };
  type?: 'currency' | 'number' | 'percentage';
  chartType?: 'line' | 'bar';
  currency?: string;
  children?: React.ReactNode;
}

export default function KPICard({
  title,
  value,
  percentageChange,
  chartData,
  type = 'number',
  chartType = 'line',
  currency = 'USD',
  children
}: KPICardProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  
  // Format the value based on type
  const formattedValue = (() => {
    if (type === 'currency') {
      return formatCurrency(Number(value), currency);
    } else if (type === 'percentage') {
      return `${Number(value).toFixed(1)}%`;
    } else {
      return value.toString();
    }
  })();
  
  useEffect(() => {
    if (chartRef.current && chartData) {
      // Destroy existing chart if it exists
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      
      const ctx = chartRef.current.getContext('2d');
      
      if (ctx) {
        chartInstance.current = new Chart(ctx, {
          type: chartType,
          data: {
            labels: chartData.labels,
            datasets: chartData.datasets.map(dataset => ({
              ...dataset,
              borderColor: dataset.borderColor || '#3f51b5',
              backgroundColor: dataset.backgroundColor || 'rgba(63, 81, 181, 0.1)',
              borderWidth: 2,
              tension: 0.4,
              fill: chartType === 'line',
              ...(chartType === 'bar' && { 
                borderRadius: 4,
                backgroundColor: '#3f51b5'
              })
            }))
          },
          options: {
            plugins: {
              legend: {
                display: false
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                display: false
              },
              x: {
                display: false
              }
            },
            maintainAspectRatio: false,
            elements: {
              point: {
                radius: 0
              }
            }
          }
        });
      }
    }
    
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [chartData, chartType]);
  
  return (
    <Card className="bg-white rounded-lg shadow-sm border border-neutral-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-medium text-neutral-400 mb-1">{title}</h4>
            <p className="text-2xl font-medium">{formattedValue}</p>
          </div>
          
          {percentageChange !== undefined && (
            <Badge variant={percentageChange >= 0 ? "success" : "error"} className="flex items-center">
              {percentageChange >= 0 ? (
                <ArrowUpIcon className="h-3 w-3 mr-0.5" />
              ) : (
                <ArrowDownIcon className="h-3 w-3 mr-0.5" />
              )}
              {Math.abs(percentageChange).toFixed(1)}%
            </Badge>
          )}
        </div>
        
        {chartData ? (
          <div className="mt-4 h-[200px] chart-container">
            <canvas ref={chartRef}></canvas>
          </div>
        ) : children ? (
          <div className="mt-4 h-[200px] overflow-auto">
            {children}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
