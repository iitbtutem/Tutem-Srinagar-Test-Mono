import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";


export default function PulseDot({ color = 'bg-emerald-400' }: { color?: string }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1400 }), -1, false);
  }, []);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.6, 1], [0.65, 0.15, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 2.4], Extrapolation.CLAMP) }],
  }));
  return (
    <View className="items-center justify-center w-5 h-5">
      <Animated.View style={ringStyle} className={`absolute w-5 h-5 rounded-full ${color}`} />
      <View className={`w-3 h-3 rounded-full ${color} border-2 border-slate-950`} />
    </View>
  );
}