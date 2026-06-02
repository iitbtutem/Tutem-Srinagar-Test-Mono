import { View, Text } from "react-native";
import { cn } from "@/lib/utils";
import PulseDot from "./PulseDot";
import LiveTimer from "./LiveTimer";
import { FunctionReturnType } from "convex/server";
import { api } from "@tutem/api";

type CurrentRide = NonNullable<FunctionReturnType<typeof api.routes.rides.getDriverCurrentRideByDriverId>>;

type PulseConfig = {
  kind: "pulse";
  dot: string;
  border: string;
  bg: string;
  text: string;
  label: string;
  sub: string;
  timestamp: number | undefined;
};

type StaticConfig = {
  kind: "static";
  border: string;
  bg: string;
  text: string;
  iconBg: string;
  icon: string;
  label: string;
  sub: string;
  timestamp: number | undefined;
};

type StatusConfig = PulseConfig | StaticConfig;

function getStatusConfig(ride: CurrentRide): StatusConfig | null {
  const { status, requestStatus } = ride;

  if (status === "Open" && requestStatus === "Pending") {
    return {
      kind: "pulse",
      dot: "bg-yellow-400",
      border: "border-yellow-500/30",
      bg: "bg-yellow-500/10",
      text: "text-yellow-400",
      label: "Searching",
      sub: "Looking for a driver",
      timestamp: ride.requestedAt,
    };
  }

  if (status === "Open" && requestStatus === "Accepted") {
    return {
      kind: "pulse",
      dot: "bg-amber-400",
      border: "border-amber-500/30",
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      label: "Accepted",
      sub: "Reaching towards pickup",
      timestamp: ride.acceptedAt,
    };
  }

  if (status === "Driver Arrived") {
    return {
      kind: "pulse",
      dot: "bg-purple-400",
      border: "border-purple-500/30",
      bg: "bg-purple-500/10",
      text: "text-purple-400",
      label: "Driver Arrived",
      sub: "Waiting to pick up rider",
      timestamp: ride.arrivedAt,
    };
  }

  if (status === "Active") {
    return {
      kind: "pulse",
      dot: "bg-green-400",
      border: "border-green-500/30",
      bg: "bg-green-500/10",
      text: "text-green-400",
      label: "Ride in Progress",
      sub: "Rider is in the vehicle",
      timestamp: ride.startedAt,
    };
  }

  if (status === "Completed") {
    return {
      kind: "static",
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      iconBg: "bg-emerald-500/20",
      icon: "✓",
      label: "Completed",
      sub: "Ride has ended",
      timestamp: ride.completedAt,
    };
  }

  if (status === "Canceled") {
    return {
      kind: "static",
      border: "border-red-500/30",
      bg: "bg-red-500/10",
      text: "text-red-400",
      iconBg: "bg-red-500/20",
      icon: "✕",
      label: "Canceled",
      sub: "Ride was canceled",
      timestamp: ride.updatedAt,
    };
  }

  if (status === "Abort") {
    return {
      kind: "static",
      border: "border-orange-500/30",
      bg: "bg-orange-500/10",
      text: "text-orange-400",
      iconBg: "bg-orange-500/20",
      icon: "!",
      label: "Aborted",
      sub: "Ride was aborted",
      timestamp: ride.updatedAt,
    };
  }

  return null;
}

function formatDate(ts: number | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  ride: CurrentRide;
  className?: string;
}

export function RideStatusBanner({ ride, className }: Props) {
  const config = getStatusConfig(ride);

  if (!config) return null;

  return (
    <View
      className={cn(
        "flex-row items-center gap-3 rounded-2xl border px-4 py-3",
        config.border,
        config.bg,
        className
      )}
    >
      {config.kind === "pulse" ? (
        <PulseDot color={config.dot} />
      ) : (
        <View className={cn("h-7 w-7 items-center justify-center rounded-full", config.iconBg)}>
          <Text className={cn("text-xs font-black", config.text)}>{config.icon}</Text>
        </View>
      )}

      <View className="flex-1">
        <Text className={cn("text-sm font-extrabold", config.text)}>
          {config.label}
        </Text>
        <Text className="mt-0.5 text-[11px] font-medium text-slate-500">
          {config.sub}
        </Text>
      </View>

      {config.kind === "pulse" ? (
        <Text className={cn("text-base font-extrabold tabular-nums", config.text)}>
          <LiveTimer startTimestamp={config.timestamp} />
        </Text>
      ) : (
        <Text className={cn("text-xs font-semibold tabular-nums", config.text)}>
          {formatDate(config.timestamp)}
        </Text>
      )}
    </View>
  );
}