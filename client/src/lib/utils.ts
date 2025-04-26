import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function getInitials(name: string): string {
  if (!name) return "";
  
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function getStatusColor(status: string): {
  variant: "success" | "warning" | "error" | "default";
  icon?: string;
} {
  status = status.toUpperCase();
  
  switch (status) {
    case "COMPLETED":
    case "PAID":
    case "SUCCESS":
      return { variant: "success" };
    case "PROCESSING":
    case "PENDING":
      return { variant: "warning" };
    case "REFUNDED":
    case "CANCELLED":
    case "FAILED":
      return { variant: "error" };
    default:
      return { variant: "default" };
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "…";
}
