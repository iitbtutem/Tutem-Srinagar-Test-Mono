import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
  interpolate,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { Text } from './ui/text';

/**
 * A premium loading screen with smooth animations and themed aesthetics.
 * Uses pulsing rings and a rotating icon to provide a modern, high-end feel.
 */
export default function LoadingScreen({ message = "Loading…" }: { message?: string }) {
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2500, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: pulse.value }
    ],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value * 1.1 }],
    opacity: interpolate(pulse.value, [1, 1.15], [0.15, 0.05]),
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value * 1.3 }],
    opacity: interpolate(pulse.value, [1, 1.15], [0.1, 0.02]),
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(600)}
      className="flex-1 items-center justify-center bg-background p-6">

      {/* Dynamic Pulsing Background Elements */}
      <View className="items-center justify-center">
        <Animated.View
          style={ring2Style}
          className="absolute w-64 h-64 rounded-full bg-primary"
        />
        <Animated.View
          style={ring1Style}
          className="absolute w-48 h-48 rounded-full bg-primary"
        />

        {/* Central Icon container */}
        <View className="p-10 rounded-[48px] bg-white dark:bg-zinc-900 shadow-2xl shadow-primary/30 items-center justify-center">
          <MaterialIcons name="local-taxi" size={56} className="text-primary" />
        </View>
      </View>

      {/* Text Elements */}
      <View className="mt-12 items-center gap-3">
        <Text className="text-2xl font-bold text-foreground">
          {message}
        </Text>
        <Text className="text-muted-foreground text-base text-center max-w-[280px]">
          We're preparing your safe and comfortable ride
        </Text>
      </View>

      {/* Bottom hint or branding (optional) */}
      <View className="absolute bottom-16">
        <View className="flex-row items-center gap-2">
          <View className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <Text className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground opacity-50">
            Tutem Driver App
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
