import { View, Text } from "react-native";
import { cn } from "@/lib/utils";
import PulseDot from "./PulseDot";
import LiveTimer from "./LiveTimer";
import { FunctionReturnType } from "convex/server";
import { api } from "@tutem/api";
import { useEffect, useState } from "react";
import { useAuthenticatedQuery } from "@/hooks/customApi";

type CurrentRide = NonNullable<FunctionReturnType<typeof api.routes.rides.getDriverCurrentRideByDriverId>>;

type PulseConfig = {
  kind: "pulse";
  label: string;
  sub: string;
  timestamp: number | undefined;
};

type StaticConfig = {
  kind: "static";
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
      label: "Searching",
      sub: "Looking for a driver",
      timestamp: ride.requestedAt,
    };
  }

  if (status === "Open" && requestStatus === "Accepted") {
    return {
      kind: "pulse",
      label: "Accepted",
      sub: "Reaching towards pickup",
      timestamp: ride.acceptedAt,
    };
  }

  if (status === "Driver Arrived") {
    return {
      kind: "pulse",
      label: "Driver Arrived",
      sub: "Waiting to pick up rider",
      timestamp: ride.arrivedAt,
    };
  }

  if (status === "Active") {
    return {
      kind: "pulse",
      label: "Ride in Progress",
      sub: "Rider is in the vehicle",
      timestamp: ride.startedAt,
    };
  }

  if (status === "Completed") {
    return {
      kind: "static",
      icon: "✓",
      label: "Completed",
      sub: "Ride has ended",
      timestamp: ride.completedAt,
    };
  }

  if (status === "Canceled") {
    return {
      kind: "static",
      icon: "✕",
      label: "Canceled",
      sub: "Ride was canceled",
      timestamp: ride.updatedAt,
    };
  }

  if (status === "Abort") {
    return {
      kind: "static",
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

function getCountdownRemainingSeconds(
  requestedAt: number | undefined,
  driverResponseTimeMinutes: number
): number {
  if (!requestedAt) return Math.max(0, Math.round(driverResponseTimeMinutes * 60));
  const expiryTimestamp = requestedAt + driverResponseTimeMinutes * 60 * 1000;
  return Math.max(0, Math.floor((expiryTimestamp - Date.now()) / 1000));
}

function formatMinutesAndSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CountdownTimer({
  startTimestamp,
  driverResponseTimeMinutes = 10,
}: {
  startTimestamp: number | undefined;
  driverResponseTimeMinutes?: number;
}) {
  const [remainingSec, setRemainingSec] = useState(() =>
    getCountdownRemainingSeconds(startTimestamp, driverResponseTimeMinutes)
  );

  useEffect(() => {
    setRemainingSec(getCountdownRemainingSeconds(startTimestamp, driverResponseTimeMinutes));
    const id = setInterval(() => {
      setRemainingSec(getCountdownRemainingSeconds(startTimestamp, driverResponseTimeMinutes));
    }, 1000);
    return () => clearInterval(id);
  }, [startTimestamp, driverResponseTimeMinutes]);

  const display = formatMinutesAndSeconds(remainingSec);

  return (
    <Text
      className="text-xl font-extrabold tabular-nums tracking-tight text-primary"
    >
      {display}
    </Text>
  );
}

interface Props {
  ride: CurrentRide;
  className?: string;
  driverResponseTime?: number;
}

export function RideStatusBanner({ ride, className, driverResponseTime: propDriverResponseTime }: Props) {
  const settings = useAuthenticatedQuery(
    api.routes.settings.rideSettings,
    propDriverResponseTime !== undefined ? "skip" : {}
  );

  // Don't show timer with a stale default — wait until we have the real setting.
  const driverResponseTimeResolved =
    propDriverResponseTime !== undefined ? propDriverResponseTime : settings?.driverResponseTime;
  const driverResponseTime = driverResponseTimeResolved ?? 10;

  const config = getStatusConfig(ride);

  if (!config) return null;

  const isPending = ride.status === "Open" && ride.requestStatus === "Pending";

  return (
    <View
      className={cn(
        "flex-row items-center gap-3 rounded-2xl border px-4 py-3 border-emerald-500/30 bg-emerald-500/10",
        className
      )}
    >
      {config.kind === "pulse" ? (
        <PulseDot color="bg-primary" />
      ) : (
        <View className="h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20">
          <Text className="text-xs font-black text-emerald-400">{config.icon}</Text>
        </View>
      )}

      <View className="flex-1">
        <Text className="text-sm font-extrabold text-primary">
          {config.label}
        </Text>
        <Text className="mt-0.5 text-[11px] font-medium text-slate-500">
          {config.sub}
        </Text>
      </View>

      {config.kind === "pulse" ? (
        isPending ? (
          driverResponseTimeResolved !== undefined ? (
            <CountdownTimer
              startTimestamp={config.timestamp}
              driverResponseTimeMinutes={driverResponseTime}
            />
          ) : null
        ) : (
          <Text className="text-base font-extrabold tabular-nums text-primary">
            <LiveTimer startTimestamp={config.timestamp} />
          </Text>
        )
      ) : (
        <Text className="text-xs font-semibold tabular-nums text-primary">
          {formatDate(config.timestamp)}
        </Text>
      )}
    </View>
  );
}
