"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { format, subDays, startOfDay, addDays } from "date-fns";
import { useMemo } from "react";

interface RidesChartProps {
  rides: Array<{
    requestedAt: number;
    status: string;
  }>;
  startDate?: Date;
  endDate?: Date;
  label?: string;
}

export function RidesChart({ rides, startDate, endDate, label }: RidesChartProps) {
  const data = useMemo(() => {
    const end = endDate ? startOfDay(endDate) : startOfDay(new Date());
    const start = startDate ? startOfDay(startDate) : startOfDay(subDays(new Date(), 13));
    const dayCount = Math.max(
      1,
      Math.min(90, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    );

    return [...Array(dayCount)].map((_, i) => {
      const day = startOfDay(addDays(start, i));
      const nextDay = startOfDay(addDays(start, i + 1));

      const dayRides = rides.filter(
        (r) => r.requestedAt >= day.getTime() && r.requestedAt < nextDay.getTime()
      );

      return {
        date: format(day, "MMM d"),
        Total: dayRides.length,
        Completed: dayRides.filter((r) => r.status === "Completed").length,
        Cancelled: dayRides.filter(
          (r) => r.status === "Canceled" || r.status === "Abort"
        ).length,
      };
    });
  }, [rides, startDate, endDate]);

  return (
    <div className="card-glass p-5">
      <div className="mb-4">
        <h3 className="font-semibold">Daily Rides</h3>
        <p className="text-sm text-muted-foreground">{label ?? "Last 14 days"}</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Area
            type="monotone"
            dataKey="Total"
            stroke="#8b5cf6"
            strokeWidth={2}
            fill="url(#totalGrad)"
          />
          <Area
            type="monotone"
            dataKey="Completed"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#completedGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface RegistrationChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  riders: Array<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  drivers: Array<any>;
  startDate?: Date;
  endDate?: Date;
  label?: string;
}

export function RegistrationChart({
  riders,
  drivers,
  startDate,
  endDate,
  label,
}: RegistrationChartProps) {
  const data = useMemo(() => {
    const end = endDate ? startOfDay(endDate) : startOfDay(new Date());
    const start = startDate ? startOfDay(startDate) : startOfDay(subDays(new Date(), 13));
    const dayCount = Math.max(
      1,
      Math.min(90, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    );

    return [...Array(dayCount)].map((_, i) => {
      const day = startOfDay(addDays(start, i));
      const nextDay = startOfDay(addDays(start, i + 1));

      return {
        date: format(day, "MMM d"),
        Riders: riders.filter(
          (r) => r._creationTime >= day.getTime() && r._creationTime < nextDay.getTime()
        ).length,
        Drivers: drivers.filter(
          (d) => d._creationTime >= day.getTime() && d._creationTime < nextDay.getTime()
        ).length,
      };
    });
  }, [riders, drivers, startDate, endDate]);

  return (
    <div className="card-glass p-5">
      <div className="mb-4">
        <h3 className="font-semibold">New Registrations</h3>
        <p className="text-sm text-muted-foreground">{label ?? "Last 14 days"}</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar dataKey="Riders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Drivers" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

