"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const colorMap = {
  blue: "bg-blue-500/10 text-blue-500",
  purple: "bg-purple-500/10 text-purple-500",
  green: "bg-green-500/10 text-green-500",
  orange: "bg-orange-500/10 text-orange-500",
  red: "bg-red-500/10 text-red-500",
  indigo: "bg-indigo-500/10 text-indigo-500",
  cyan: "bg-cyan-500/10 text-cyan-500",
  teal: "bg-teal-500/10 text-teal-500",
  emerald: "bg-emerald-500/10 text-emerald-500",
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: keyof typeof colorMap;
  trend?: string;
  description?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  color,
  trend,
  description,
  onClick,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "stat-card group text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        onClick && "cursor-pointer hover:border-primary/40 hover:shadow-md active:scale-[0.98] transition-all duration-200"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </span>
        <div
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center",
            colorMap[color]
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>

      <div className="text-3xl font-bold tracking-tight">{value}</div>

      {(trend || description) && (
        <p className="text-xs text-muted-foreground">
          {trend || description}
        </p>
      )}
    </div>
  );
}
