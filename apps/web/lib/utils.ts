import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(timestamp: number | string | Date) {
  return format(new Date(timestamp), "MMM dd, yyyy");
}

export function formatDateTime(timestamp: number | string | Date) {
  return format(new Date(timestamp), "MMM dd, yyyy HH:mm");
}

export function formatTimeAgo(timestamp: number | string | Date) {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/** Converts any parseable date string to YYYY-MM-DD for use as an <input type="date"> value. */
export function toDateInputValue(dob: string | undefined | null): string {
  if (!dob) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) return dob; // already YYYY-MM-DD
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

export function getInitials(firstName: string, lastName?: string) {
  const first = firstName?.[0]?.toUpperCase() ?? "";
  const last = lastName?.[0]?.toUpperCase() ?? "";
  return first + last || "?";
}

export function getStatusColor(status: string) {
  switch (status) {
    case "Open":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "Active":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "Driver Arrived":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "Completed":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "Canceled":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "Abort":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "Verified":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "Pending":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "Rejected":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  }
}
