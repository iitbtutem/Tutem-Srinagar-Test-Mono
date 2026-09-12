import { View, Text } from 'react-native';
import { FunctionReturnType } from 'convex/server';
import { api } from '@tutem/api';
import { useEffect, useState } from 'react';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { cn } from '@tutem/ui';
import { useAuthenticatedQuery } from '@/hooks/customApi';

type CurrentRideByRiderId = NonNullable<
  FunctionReturnType<typeof api.routes.rides.getRiderCurrentRideById>
>;

type CurrentRide = NonNullable<
  FunctionReturnType<typeof api.routes.rides.getRiderCurrentRideByRiderId>
>;

type PulseConfig = {
  kind: 'pulse';
  label: string;
  sub: string;
  timestamp: number | undefined;
};

type StaticConfig = {
  kind: 'static';
  icon: string;
  label: string;
  sub: string;
  timestamp: number | undefined;
};

type RideDetails = CurrentRideByRiderId | CurrentRide;

type StatusConfig = PulseConfig | StaticConfig;

function getStatusConfig(ride: RideDetails): StatusConfig | null {
  const { status, requestStatus } = ride;

  if (status === 'Open' && requestStatus === 'Pending') {
    return {
      kind: 'pulse',
      label: 'Requested',
      sub: 'Waiting for driver response',
      timestamp: ride.requestedAt,
    };
  }

  if (status === 'Open' && requestStatus === 'No Response') {
    return {
      kind: 'pulse',
      label: 'No Response',
      sub: "Driver didn't accept the ride",
      timestamp: ride.requestedAt,
    };
  }

  if (status === 'Open' && requestStatus === 'Accepted') {
    return {
      kind: 'pulse',
      label: 'Accepted',
      sub: 'Driver is on the way',
      timestamp: ride.acceptedAt,
    };
  }

  if (status === 'Driver Arrived') {
    return {
      kind: 'pulse',
      label: 'Driver Arrived',
      sub: 'Driver is waiting for you to board',
      timestamp: ride.arrivedAt,
    };
  }

  if (status === 'Active') {
    return {
      kind: 'pulse',
      label: 'Ride in Progress',
      sub: 'Heading towards destination',
      timestamp: ride.startedAt,
    };
  }

  if (status === 'Completed') {
    return {
      kind: 'static',
      icon: '✓',
      label: 'Completed',
      sub: 'Ride has ended',
      timestamp: ride.completedAt,
    };
  }

  if (status === 'Canceled') {
    return {
      kind: 'static',
      icon: '✕',
      label: 'Canceled',
      sub: 'You canceled the ride',
      timestamp: ride.updatedAt,
    };
  }

  if (status === 'Abort') {
    return {
      kind: 'static',
      icon: '!',
      label: 'Aborted',
      sub: 'Ride was aborted',
      timestamp: ride.updatedAt,
    };
  }

  return null;
}

function formatDate(ts: number | undefined) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

interface Props {
  ride: RideDetails;
  className?: string;
  driverResponseTime?: number;
}

function RideStatusBanner({ ride, className, driverResponseTime: propDriverResponseTime }: Props) {
  const settings = useAuthenticatedQuery(
    api.routes.settings.rideSettings,
    propDriverResponseTime !== undefined ? 'skip' : {}
  );
  // Don't show timer with a stale default — wait until we have the real setting.
  const driverResponseTimeResolved =
    propDriverResponseTime !== undefined ? propDriverResponseTime : settings?.driverResponseTime;
  const driverResponseTime = driverResponseTimeResolved ?? 10;

  const config = getStatusConfig(ride);

  if (!config) return null;

  const isPending = ride.status === 'Open' && ride.requestStatus === 'Pending';

  return (
    <View
      className={cn(
        'flex-row items-center gap-3 rounded-2xl border px-4 py-3 border-emerald-500/30 bg-white',
        className
      )}>
      {config.kind === 'pulse' ? (
        <PulseDot color="bg-primary" />
      ) : (
        <View className="h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20">
          <Text className="text-xs font-black text-emerald-400">{config.icon}</Text>
        </View>
      )}

      <View className="flex-1">
        <Text className="text-sm font-extrabold text-primary">{config.label}</Text>
        <Text className="mt-0.5 text-[11px] font-medium text-slate-500">{config.sub}</Text>
      </View>

      {config.kind === 'pulse' ? (
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

function formatElapsed(startTimestamp: number | undefined): string {
  if (startTimestamp === undefined) return '--';
  const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function LiveTimer({ startTimestamp }: { startTimestamp: number | undefined }) {
  const [display, setDisplay] = useState(() => formatElapsed(startTimestamp));
  useEffect(() => {
    const id = setInterval(() => setDisplay(formatElapsed(startTimestamp)), 1000);
    return () => clearInterval(id);
  }, [startTimestamp]);
  return (
    <Text className="text-xl font-extrabold tabular-nums tracking-tight text-primary">
      {display}
    </Text>
  );
}

function CountdownTimer({
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
      className="text-xl font-extrabold tabular-nums tracking-tight text-primary">
      {display}
    </Text>
  );
}

function PulseDot({ color = 'bg-emerald-400' }: { color?: string }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1400 }), -1, false);
  }, []);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.6, 1], [0.65, 0.15, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 2.4], Extrapolation.CLAMP) }],
  }));
  return (
    <View className="h-5 w-5 items-center justify-center">
      <Animated.View style={ringStyle} className={`absolute h-5 w-5 rounded-full ${color}`} />
      <View className={`h-3 w-3 rounded-full ${color} border-2 border-slate-950`} />
    </View>
  );
}

export { RideStatusBanner, LiveTimer, CountdownTimer, PulseDot };
