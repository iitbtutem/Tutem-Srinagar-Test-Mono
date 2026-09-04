import { cn, getStatusColor } from "@/lib/utils";

interface BadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: BadgeProps) {
  return (
    <span className={cn("badge-status", getStatusColor(status), className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {status}
    </span>
  );
}

interface VerificationBadgeProps {
  status: "Pending" | "Unverified" | "Verified" | "Rejected";
}

export function VerificationBadge({ status }: VerificationBadgeProps) {
  return <StatusBadge status={status} />;
}

interface OnlineBadgeProps {
  isOnline: boolean;
}

export function OnlineBadge({ isOnline }: OnlineBadgeProps) {
  return (
    <span
      className={cn(
        "badge-status",
        isOnline
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400"
        )}
      />
      {isOnline ? "Online" : "Offline"}
    </span>
  );
}
