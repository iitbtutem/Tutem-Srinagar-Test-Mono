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

type CurrentRideByRiderId = NonNullable<
  FunctionReturnType<typeof api.routes.rides.getRiderCurrentRideById>
>;

type PulseConfig = {
  kind: 'pulse';
  dot: string;
  border: string;
  bg: string;
  text: string;
  label: string;
  sub: string;
  timestamp: number | undefined;
};

type StaticConfig = {
  kind: 'static';
  border: string;
  bg: string;
  text: string;
  iconBg: string;
  icon: string;
  label: string;
  sub: string;
  timestamp: number | undefined;
};

type RideDetails = CurrentRideByRiderId;

type StatusConfig = PulseConfig | StaticConfig;

function getStatusConfig(ride: RideDetails): StatusConfig | null {
  const { status, requestStatus } = ride;

  if (status === 'Open' && requestStatus === 'Pending') {
    return {
      kind: 'pulse',
      dot: 'bg-yellow-400',
      border: 'border-yellow-500/30',
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      label: 'Requested',
      sub: 'Waiting for driver response',
      timestamp: ride.requestedAt,
    };
  }

  if (status === 'Open' && requestStatus === 'No Response') {
    return {
      kind: 'pulse',
      dot: 'bg-orange-400',
      border: 'border-orange-500/30',
      bg: 'bg-orange-500/10',
      text: 'text-orange-400',
      label: 'No Response',
      sub: "Driver didn't accept the ride",
      timestamp: ride.requestedAt,
    };
  }

  if (status === 'Open' && requestStatus === 'Accepted') {
    return {
      kind: 'pulse',
      dot: 'bg-amber-400',
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      label: 'Accepted',
      sub: 'Driver is on the way',
      timestamp: ride.acceptedAt,
    };
  }

  if (status === 'Driver Arrived') {
    return {
      kind: 'pulse',
      dot: 'bg-purple-400',
      border: 'border-purple-500/30',
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
      label: 'Driver Arrived',
      sub: 'Driver is waiting for you to board',
      timestamp: ride.arrivedAt,
    };
  }

  if (status === 'Active') {
    return {
      kind: 'pulse',
      dot: 'bg-green-400',
      border: 'border-green-500/30',
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      label: 'Ride in Progress',
      sub: 'Heading towards destination',
      timestamp: ride.startedAt,
    };
  }

  if (status === 'Completed') {
    return {
      kind: 'static',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      iconBg: 'bg-emerald-500/20',
      icon: '✓',
      label: 'Completed',
      sub: 'Ride has ended',
      timestamp: ride.completedAt,
    };
  }

  if (status === 'Canceled') {
    return {
      kind: 'static',
      border: 'border-red-500/30',
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      iconBg: 'bg-red-500/20',
      icon: '✕',
      label: 'Canceled',
      sub: 'You canceled the ride',
      timestamp: ride.updatedAt,
    };
  }

  if (status === 'Abort') {
    return {
      kind: 'static',
      border: 'border-orange-500/30',
      bg: 'bg-orange-500/10',
      text: 'text-orange-400',
      iconBg: 'bg-orange-500/20',
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

interface Props {
  ride: RideDetails;
  className?: string;
}

function RideStatusBanner({ ride, className }: Props) {
  const config = getStatusConfig(ride);

  if (!config) return null;

  return (
    <View
      className={cn(
        'flex-row items-center gap-3 rounded-2xl border px-4 py-3',
        config.border,
        config.bg,
        className
      )}>
      {config.kind === 'pulse' ? (
        <PulseDot color={config.dot} />
      ) : (
        <View className={cn('h-7 w-7 items-center justify-center rounded-full', config.iconBg)}>
          <Text className={cn('text-xs font-black', config.text)}>{config.icon}</Text>
        </View>
      )}

      <View className="flex-1">
        <Text className={cn('text-sm font-extrabold', config.text)}>{config.label}</Text>
        <Text className="mt-0.5 text-[11px] font-medium text-slate-500">{config.sub}</Text>
      </View>

      {config.kind === 'pulse' ? (
        <Text className={cn('text-base font-extrabold tabular-nums', config.text)}>
          <LiveTimer startTimestamp={config.timestamp} />
        </Text>
      ) : (
        <Text className={cn('text-xs font-semibold tabular-nums', config.text)}>
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
    <Text className="text-xl font-extrabold tabular-nums tracking-tight text-emerald-400">
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

export { RideStatusBanner, LiveTimer, PulseDot };
